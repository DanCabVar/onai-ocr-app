import {
  Injectable,
  Logger,
  BadRequestException,
  HttpException,
  HttpStatus,
  PayloadTooLargeException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Document } from '../../database/entities/document.entity';
import { DocumentType } from '../../database/entities/document-type.entity';
import { MistralOCRService } from '../../ai-services/mistral-ocr.service';
import { GeminiClassifierService } from '../../ai-services/gemini-classifier.service';
import { OCRCacheService } from '../../ai-services/ocr-cache.service';
import { PipelineMetricsService, PipelineMetrics } from '../../ai-services/pipeline-metrics.service';
import { StorageService } from '../../storage/storage.service';
import { SubscriptionsService } from '../../subscriptions/subscriptions.service';
import { User } from '../../database/entities/user.entity';

export interface ProcessingResult {
  document: Document;
  wasClassified: boolean;
  createdOthersFolder: boolean;
  message: string;
}

export interface BatchDocResult {
  filename: string;
  status: 'processed' | 'pending_confirmation' | 'error';
  documentId?: number;
  documentTypeId?: number;
  documentTypeName?: string;
  suggestedType?: string;
  confidence?: number;
  ocrText?: string;
  extractedData?: any;
  error?: string;
}

export interface BatchUploadResult {
  total: number;
  processed: number;
  pendingConfirmation: number;
  errors: number;
  results: BatchDocResult[];
}

/**
 * Document Processing Pipeline (Optimized)
 * 
 * Flow: Upload → OCR (cached) → Classify → Extract → Store
 * 
 * Optimizations applied:
 * - OCR caching by content hash (skip OCR for duplicate documents)
 * - Rate limiting on all AI API calls (Mistral + Gemini)
 * - Automatic retry with exponential backoff on transient failures
 * - Parallel execution of independent steps (OCR + type loading)
 * - Pipeline metrics: timing, token estimates, cost tracking per stage
 * - Optimized prompts (~40-50% fewer tokens)
 * - Reduced OCR text sent to classification (3000 chars vs 5000)
 */
@Injectable()
export class DocumentProcessingService {
  private readonly logger = new Logger(DocumentProcessingService.name);

  /** In-memory cache of document types per user (avoids DB query per upload) */
  private documentTypesCache: Map<number, { data: DocumentType[]; timestamp: number }> = new Map();
  private readonly CACHE_TTL = 5 * 60 * 1000; // 5 minutes

  constructor(
    @InjectRepository(Document)
    private readonly documentRepository: Repository<Document>,
    @InjectRepository(DocumentType)
    private readonly documentTypeRepository: Repository<DocumentType>,
    private readonly mistralOCRService: MistralOCRService,
    private readonly geminiClassifierService: GeminiClassifierService,
    private readonly ocrCache: OCRCacheService,
    private readonly metrics: PipelineMetricsService,
    private readonly storageService: StorageService,
    private readonly subscriptionsService: SubscriptionsService,
  ) {}

  private async getAvailableTypes(userId: number): Promise<DocumentType[]> {
    const now = Date.now();
    const cached = this.documentTypesCache.get(userId);
    if (cached && (now - cached.timestamp) < this.CACHE_TTL) {
      return cached.data;
    }
    const types = await this.documentTypeRepository.find({ where: { userId } });
    this.documentTypesCache.set(userId, { data: types, timestamp: now });
    return types;
  }

  public invalidateTypesCache(): void {
    this.documentTypesCache.clear();
  }

  /** Formatos de archivo soportados */
  private readonly SUPPORTED_MIME_TYPES = [
    'application/pdf',
    'image/jpeg',
    'image/jpg',
    'image/png',
    'image/webp',
  ];

  /** Tamaño máximo de archivo: 10MB */
  private readonly MAX_FILE_SIZE = 10 * 1024 * 1024;

  /**
   * Valida el archivo antes de procesarlo.
   * Lanza excepciones HTTP apropiadas si no pasa validación.
   */
  private validateFile(fileBuffer: Buffer, mimeType: string, originalName: string): void {
    // Validar tamaño
    if (fileBuffer.length > this.MAX_FILE_SIZE) {
      const sizeMB = (fileBuffer.length / (1024 * 1024)).toFixed(1);
      throw new PayloadTooLargeException(
        `El archivo "${originalName}" pesa ${sizeMB}MB. El tamaño máximo permitido es 10MB.`,
      );
    }

    // Validar formato
    if (!this.SUPPORTED_MIME_TYPES.includes(mimeType)) {
      throw new BadRequestException(
        `Formato no soportado: "${mimeType}". Solo se permiten archivos PDF e imágenes (JPEG, PNG, WebP).`,
      );
    }
  }

  /**
   * Main document processing pipeline.
   * 
   * Steps:
   * 1. Upload original to R2
   * 2. Generate presigned URL for OCR
   * 3. OCR with Mistral (check cache first by content hash)
   * 4. Classify with Gemini
   * 5. Extract structured data with Gemini Vision
   * 6. Save extracted JSON to R2
   * 7. Save document record in DB
   */
  async processDocument(
    fileBuffer: Buffer,
    originalName: string,
    mimeType: string,
    user: User,
  ): Promise<ProcessingResult> {
    // ─── Validaciones previas ───
    this.validateFile(fileBuffer, mimeType, originalName);

    this.logger.log(`📄 Procesando: ${originalName}`);

    // Initialize metrics tracking
    const ctx = this.metrics.createContext(originalName);

    const originalKey = this.storageService.buildKey(user.id, 'originals', originalName);
    let uploaded = false;

    try {
      // ─── PASO 1: Upload to R2 ───
      const uploadMetric = this.metrics.startStage(ctx, 'upload-r2');
      await this.storageService.uploadFile(fileBuffer, originalKey, mimeType);
      uploaded = true;
      this.metrics.endStage(uploadMetric);
      this.logger.log(`✅ R2 upload: ${originalKey}`);

      // ─── PASO 2: Presigned URL ───
      const presignMetric = this.metrics.startStage(ctx, 'presign-url');
      const presignedUrl = await this.storageService.getPresignedUrl(originalKey, 600);
      this.metrics.endStage(presignMetric);

      // ─── PASO 3: OCR (with cache check) ───
      const ocrMetric = this.metrics.startStage(ctx, 'ocr');
      const contentHash = this.ocrCache.computeHash(fileBuffer);
      let ocrResult = await this.ocrCache.get(contentHash);

      if (ocrResult) {
        // Cache hit — skip the OCR API call entirely
        ctx.cacheHit = true;
        this.logger.log(`🎯 OCR cache HIT — skipping Mistral API call`);
        this.metrics.endStage(ocrMetric, { provider: 'mistral' });
      } else {
        // Cache miss — run OCR and load types in parallel
        const [freshOCR, availableTypesPreload] = await Promise.all([
          this.mistralOCRService.extractTextSmart(presignedUrl, mimeType),
          this.getAvailableTypes(user.id),
        ]);
        ocrResult = {
          text: freshOCR.text,
          confidence: freshOCR.confidence,
          metadata: freshOCR.metadata,
        };
        // Cache the result for future use
        this.ocrCache.set(contentHash, ocrResult);
        this.metrics.endStage(ocrMetric, {
          outputChars: ocrResult.text.length,
          pages: freshOCR.metadata?.pages,
          provider: 'mistral',
        });
      }

      this.logger.log(`✅ OCR: ${ocrResult.text.length} chars`);

      // Load available types (may already be loaded in parallel above)
      const availableTypes = await this.getAvailableTypes(user.id);
      if (availableTypes.length === 0) {
        throw new BadRequestException(
          'No hay tipos de documento configurados. Crea al menos un tipo antes de subir documentos.',
        );
      }

      // ─── PASO 4+5: Unified classify + extract in a SINGLE Vision call ───
      const classifyExtractMetric = this.metrics.startStage(ctx, 'classify-and-extract');
      const unified = await this.geminiClassifierService.classifyAndExtract(
        fileBuffer,
        mimeType,
        availableTypes,
      );
      this.metrics.endStage(classifyExtractMetric, {
        isVision: true,
        provider: 'gemini',
      });

      const classification = unified.classification;
      let documentType: DocumentType;
      let createdOthersFolder = false;
      let inferredData = unified.inferredData;
      let extractedData: any;

      // ─── Resolve document type ───
      if (classification.isOthers) {
        this.logger.log('Clasificado como "Otros"');
        documentType = await this.getOrCreateOthersType(user);
        createdOthersFolder = !documentType.id;

        extractedData = {
          summary: inferredData?.summary || 'Sin resumen',
          key_fields: inferredData?.key_fields || [],
        };
      } else {
        // Match by name (case-insensitive, partial match fallback)
        const classifiedName = classification.documentTypeName.toLowerCase().trim();

        documentType = availableTypes.find(
          (t) => t.name.toLowerCase().trim() === classifiedName,
        );

        if (!documentType) {
          this.logger.warn(`No exact match for "${classification.documentTypeName}", trying partial...`);
          documentType = availableTypes.find((t) => {
            const n = t.name.toLowerCase().trim();
            return n.includes(classifiedName) || classifiedName.includes(n);
          });
        }

        if (!documentType) {
          this.logger.warn(`No match for "${classification.documentTypeName}" → falling back to "Otros"`);
          documentType = await this.getOrCreateOthersType(user);
          classification.isOthers = true;

          // Re-use unified fields as inferred data
          inferredData = {
            inferred_type: classification.inferredType || 'Documento Sin Clasificar',
            summary: unified.extraction?.summary || 'Sin resumen',
            key_fields: unified.extraction?.fields || [],
          };
          extractedData = {
            summary: inferredData.summary,
            key_fields: inferredData.key_fields,
          };
        } else {
          this.logger.log(`✅ Clasificado: "${documentType.name}" (ID: ${documentType.id})`);
          extractedData = unified.extraction || { summary: 'Sin resumen', fields: [] };
        }
      }

      // ─── PASO 6: Save extracted JSON to R2 ───
      const saveJsonMetric = this.metrics.startStage(ctx, 'save-json-r2');
      const extractedKey = this.storageService.buildKey(
        user.id,
        'extracted',
        `${Date.now()}-${originalName.replace(/\.[^.]+$/, '')}.json`,
      );
      await this.storageService.uploadFile(
        Buffer.from(JSON.stringify(extractedData, null, 2)),
        extractedKey,
        'application/json',
      );
      this.metrics.endStage(saveJsonMetric);

      // Generate view URL (7 days)
      const viewUrl = await this.storageService.getPresignedUrl(originalKey, 7 * 24 * 3600);

      // ─── PASO 7: Save to database ───
      const dbMetric = this.metrics.startStage(ctx, 'save-db');
      const document = this.documentRepository.create({
        userId: user.id,
        documentTypeId: documentType.id,
        filename: originalName,
        storageKey: originalKey,
        storageProvider: 'r2',
        googleDriveLink: viewUrl,
        googleDriveFileId: null,
        ocrRawText: ocrResult.text,
        extractedData,
        inferredData: classification.isOthers ? inferredData : null,
        confidenceScore: classification.confidence,
        status: 'completed',
      });

      await this.documentRepository.save(document);
      this.metrics.endStage(dbMetric);

      // ─── Finalize metrics ───
      this.metrics.finalize(ctx, document.id);

      // Log cache stats periodically
      const cacheStats = this.ocrCache.getStats();
      if ((cacheStats.hits + cacheStats.misses) % 10 === 0) {
        this.logger.log(`📊 OCR Cache: ${cacheStats.hitRate} hit rate (${cacheStats.size} entries)`);
      }

      // Increment subscription usage
      await this.subscriptionsService.incrementUsage(user.id);

      this.logger.log(`✅ Documento procesado: ${document.id}`);

      return {
        document,
        wasClassified: !classification.isOthers,
        createdOthersFolder,
        message: classification.isOthers
          ? `Documento guardado en R2. Tipo sugerido: "${inferredData?.inferred_type || 'Sin Clasificar'}"`
          : `Clasificado como "${documentType.name}" (${(classification.confidence * 100).toFixed(1)}%)`,
      };
    } catch (error) {
      this.logger.error(`❌ Error procesando: ${error.message}`, error.stack);

      // Cleanup uploaded file on error
      if (uploaded) {
        try {
          await this.storageService.deleteFile(originalKey);
          this.logger.log('🗑️ Archivo temporal eliminado de R2');
        } catch (cleanupError) {
          this.logger.error(`Error limpiando R2: ${cleanupError.message}`);
        }
      }

      // Finalize metrics even on error
      this.metrics.finalize(ctx);

      // Re-throw si ya es una HttpException (BadRequest, PayloadTooLarge, etc.)
      if (error instanceof HttpException) {
        throw error;
      }

      // Errores de Mistral OCR → 422
      if (
        error.message?.includes('No se pudo extraer texto') ||
        error.message?.includes('Mistral') ||
        error.message?.includes('OCR')
      ) {
        throw new HttpException(
          {
            statusCode: HttpStatus.UNPROCESSABLE_ENTITY,
            message: `No se pudo procesar el documento "${originalName}". El servicio OCR no logró extraer texto. Verifica que el archivo no esté corrupto o protegido.`,
            error: 'Unprocessable Entity',
          },
          HttpStatus.UNPROCESSABLE_ENTITY,
        );
      }

      // Errores de Gemini (clasificación/extracción) → 422
      if (
        error.message?.includes('Gemini') ||
        error.message?.includes('Failed to parse') ||
        error.message?.includes('generateContent')
      ) {
        throw new HttpException(
          {
            statusCode: HttpStatus.UNPROCESSABLE_ENTITY,
            message: `No se pudo procesar el documento "${originalName}". El servicio de clasificación no pudo analizar el contenido.`,
            error: 'Unprocessable Entity',
          },
          HttpStatus.UNPROCESSABLE_ENTITY,
        );
      }

      // Error genérico → 422 con mensaje descriptivo
      throw new HttpException(
        {
          statusCode: HttpStatus.UNPROCESSABLE_ENTITY,
          message: `No se pudo procesar el documento "${originalName}". Error: ${error.message}`,
          error: 'Unprocessable Entity',
        },
        HttpStatus.UNPROCESSABLE_ENTITY,
      );
    }
  }

  /**
   * Get or create the "Otros Documentos" catch-all type.
   */
  /**
   * Atomic get-or-create for the "Otros Documentos" type.
   * Uses advisory lock via pg_advisory_xact_lock to prevent duplicates
   * under concurrent requests.
   */
  private async getOrCreateOthersType(user: User): Promise<DocumentType> {
    const othersName = process.env.OTHERS_FOLDER_NAME || 'Otros Documentos';

    // Fast path: already exists for this user
    const existing = await this.documentTypeRepository.findOne({
      where: { name: othersName, userId: user.id },
    });
    if (existing) return existing;

    // Slow path: acquire advisory lock and double-check
    const queryRunner =
      this.documentTypeRepository.manager.connection.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      // Advisory lock keyed on a fixed hash to serialize "Otros" creation
      // 0x4F54524F53 = "OTROS" in hex, truncated to 32-bit int
      await queryRunner.query('SELECT pg_advisory_xact_lock(1330857043)');

      // Double-check inside the lock (scoped to this user)
      const locked = await queryRunner.manager.findOne(DocumentType, {
        where: { name: othersName, userId: user.id },
      });
      if (locked) {
        await queryRunner.commitTransaction();
        return locked;
      }

      const storagePrefix = 'types/otros-documentos/';

      const othersType = queryRunner.manager.create(DocumentType, {
        userId: user.id,
        name: othersName,
        description:
          process.env.OTHERS_FOLDER_DESCRIPTION ||
          'Documentos sin clasificación automática. La IA identifica el tipo y campos clave.',
        fieldSchema: {
          fields: [
            {
              name: 'document_title',
              type: 'string',
              label: 'Título del Documento',
              required: false,
              description: 'Tipo o título identificado por IA',
            },
            {
              name: 'document_category',
              type: 'string',
              label: 'Categoría',
              required: false,
              description: 'Categoría general del documento',
            },
            {
              name: 'key_entities',
              type: 'string',
              label: 'Resumen/Entidades Clave',
              required: false,
              description: 'Resumen o entidades principales',
            },
          ],
        },
        googleDriveFolderId: null,
        folderPath: null,
      });

      await queryRunner.manager.save(othersType);
      await queryRunner.commitTransaction();

      this.logger.log('✅ Tipo "Otros Documentos" creado (con lock)');
      return othersType;
    } catch (error) {
      await queryRunner.rollbackTransaction();
      this.logger.error(
        `Error en getOrCreateOthersType: ${error.message}`,
        error.stack,
      );

      // Final fallback: maybe another transaction created it
      const fallback = await this.documentTypeRepository.findOne({
        where: { name: othersName, userId: user.id },
      });
      if (fallback) return fallback;

      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // BATCH PROCESSING
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Run promises with a concurrency limit using Promise.allSettled semantics.
   */
  private async runWithConcurrency<T>(
    items: T[],
    concurrency: number,
    fn: (item: T) => Promise<any>,
  ): Promise<PromiseSettledResult<any>[]> {
    const results: PromiseSettledResult<any>[] = [];
    for (let i = 0; i < items.length; i += concurrency) {
      const batch = items.slice(i, i + concurrency);
      const batchResults = await Promise.allSettled(batch.map(fn));
      results.push(...batchResults);
    }
    return results;
  }

  /**
   * Process multiple documents in batch.
   *
   * Flow:
   * 1. Validate all files
   * 2. OCR in parallel (max 3)
   * 3. Classify each doc against user types (max 5)
   * 4. Matched docs → extract + save
   * 5. Unmatched docs → return as pending_confirmation
   * 6. If 5+ docs, apply type grouping/homogenization
   */
  async processBatch(
    files: Express.Multer.File[],
    user: User,
  ): Promise<BatchUploadResult> {
    this.logger.log(`📦 Batch: procesando ${files.length} archivos para usuario ${user.id}`);

    // ─── PASO 1: Validar todos los archivos ───
    for (const file of files) {
      this.validateFile(file.buffer, file.mimetype, file.originalname);
    }

    // ─── PASO 2: Upload originals to R2 + OCR in parallel (max 3) ───
    interface OcrItem {
      file: Express.Multer.File;
      ocrText: string;
      storageKey: string;
    }

    const ocrResults = await this.runWithConcurrency(files, 3, async (file) => {
      // Upload original
      const storageKey = this.storageService.buildKey(user.id, 'originals', file.originalname);
      await this.storageService.uploadFile(file.buffer, storageKey, file.mimetype);

      // Presigned URL for OCR
      const presignedUrl = await this.storageService.getPresignedUrl(storageKey, 600);

      // OCR (with cache)
      const contentHash = this.ocrCache.computeHash(file.buffer);
      let ocr = await this.ocrCache.get(contentHash);
      if (!ocr) {
        const freshOCR = await this.mistralOCRService.extractTextSmart(presignedUrl, file.mimetype);
        ocr = { text: freshOCR.text, confidence: freshOCR.confidence, metadata: freshOCR.metadata };
        this.ocrCache.set(contentHash, ocr);
      }

      return { file, ocrText: ocr.text, storageKey } as OcrItem;
    });

    // Separate successful OCRs from failures
    const ocrSuccesses: OcrItem[] = [];
    const batchResults: BatchDocResult[] = [];

    for (let i = 0; i < ocrResults.length; i++) {
      const r = ocrResults[i];
      if (r.status === 'fulfilled') {
        ocrSuccesses.push(r.value);
      } else {
        batchResults.push({
          filename: files[i].originalname,
          status: 'error',
          error: r.reason?.message || 'OCR failed',
        });
      }
    }

    if (ocrSuccesses.length === 0) {
      return {
        total: files.length,
        processed: 0,
        pendingConfirmation: 0,
        errors: batchResults.length,
        results: batchResults,
      };
    }

    // ─── PASO 3: Load user types ───
    const availableTypes = await this.getAvailableTypes(user.id);

    // ─── PASO 4: Classify each doc (max 5 in parallel) ───
    interface ClassifiedItem extends OcrItem {
      classification: import('../../ai-services/gemini-classifier.service').ClassifyAndExtractResult;
    }

    const classifyResults = await this.runWithConcurrency(ocrSuccesses, 5, async (item) => {
      const classification = await this.geminiClassifierService.classifyAndExtract(
        item.file.buffer,
        item.file.mimetype,
        availableTypes,
      );
      return { ...item, classification } as ClassifiedItem;
    });

    const classifiedItems: ClassifiedItem[] = [];
    for (let i = 0; i < classifyResults.length; i++) {
      const r = classifyResults[i];
      if (r.status === 'fulfilled') {
        classifiedItems.push(r.value);
      } else {
        batchResults.push({
          filename: ocrSuccesses[i].file.originalname,
          status: 'error',
          error: r.reason?.message || 'Classification failed',
        });
      }
    }

    // ─── PASO 5: Separate matched vs unmatched ───
    const matched: ClassifiedItem[] = [];
    const unmatched: ClassifiedItem[] = [];

    for (const item of classifiedItems) {
      const c = item.classification.classification;
      if (c.isOthers) {
        unmatched.push(item);
      } else {
        // Verify the matched type actually exists
        const matchedType = availableTypes.find(
          (t) => t.name.toLowerCase().trim() === c.documentTypeName.toLowerCase().trim(),
        ) || availableTypes.find((t) => {
          const n = t.name.toLowerCase().trim();
          const cn = c.documentTypeName.toLowerCase().trim();
          return n.includes(cn) || cn.includes(n);
        });

        if (matchedType) {
          matched.push(item);
        } else {
          unmatched.push(item);
        }
      }
    }

    // ─── PASO 5a: If 5+ docs, apply grouping/homogenization for unmatched ───
    if (unmatched.length >= 5) {
      await this.homogenizeAndGroupBatch(unmatched, batchResults, user);
    } else {
      // Return unmatched as pending_confirmation
      for (const item of unmatched) {
        const c = item.classification.classification;
        const inferredData = item.classification.inferredData;

        // Save doc with status pending_confirmation
        const viewUrl = await this.storageService.getPresignedUrl(item.storageKey, 7 * 24 * 3600);
        const document = this.documentRepository.create({
          userId: user.id,
          documentTypeId: null,
          filename: item.file.originalname,
          storageKey: item.storageKey,
          storageProvider: 'r2',
          googleDriveLink: viewUrl,
          googleDriveFileId: null,
          ocrRawText: item.ocrText,
          extractedData: null,
          inferredData: inferredData || {
            inferred_type: c.inferredType || 'Desconocido',
            summary: 'Pendiente de confirmación',
            key_fields: [],
          },
          confidenceScore: c.confidence,
          status: 'pending_confirmation',
        });
        await this.documentRepository.save(document);

        batchResults.push({
          filename: item.file.originalname,
          status: 'pending_confirmation',
          documentId: document.id,
          suggestedType: c.inferredType || inferredData?.inferred_type || 'Desconocido',
          confidence: c.confidence,
        });
      }
    }

    // ─── PASO 6: Process matched docs (extract + save, max 3 parallel) ───
    const extractResults = await this.runWithConcurrency(matched, 3, async (item) => {
      const c = item.classification.classification;
      const matchedType = availableTypes.find(
        (t) => t.name.toLowerCase().trim() === c.documentTypeName.toLowerCase().trim(),
      ) || availableTypes.find((t) => {
        const n = t.name.toLowerCase().trim();
        const cn = c.documentTypeName.toLowerCase().trim();
        return n.includes(cn) || cn.includes(n);
      });

      const extractedData = item.classification.extraction || { summary: 'Sin resumen', fields: [] };

      // Save extracted JSON to R2
      const extractedKey = this.storageService.buildKey(
        user.id,
        'extracted',
        `${Date.now()}-${item.file.originalname.replace(/\.[^.]+$/, '')}.json`,
      );
      await this.storageService.uploadFile(
        Buffer.from(JSON.stringify(extractedData, null, 2)),
        extractedKey,
        'application/json',
      );

      // Also copy to typed storage path
      const typedKey = this.storageService.buildTypedKey(
        user.id,
        matchedType!.name,
        item.file.originalname,
      );
      await this.storageService.uploadFile(item.file.buffer, typedKey, item.file.mimetype);

      const viewUrl = await this.storageService.getPresignedUrl(item.storageKey, 7 * 24 * 3600);

      const document = this.documentRepository.create({
        userId: user.id,
        documentTypeId: matchedType!.id,
        filename: item.file.originalname,
        storageKey: item.storageKey,
        storageProvider: 'r2',
        googleDriveLink: viewUrl,
        googleDriveFileId: null,
        ocrRawText: item.ocrText,
        extractedData,
        inferredData: null,
        confidenceScore: c.confidence,
        status: 'completed',
      });
      await this.documentRepository.save(document);
      await this.subscriptionsService.incrementUsage(user.id);

      return {
        filename: item.file.originalname,
        status: 'processed' as const,
        documentId: document.id,
        documentTypeId: matchedType!.id,
        documentTypeName: matchedType!.name,
        confidence: c.confidence,
        extractedData,
      } as BatchDocResult;
    });

    for (const r of extractResults) {
      if (r.status === 'fulfilled') {
        batchResults.push(r.value);
      } else {
        // Find the original filename
        const idx = extractResults.indexOf(r);
        batchResults.push({
          filename: matched[idx]?.file?.originalname || 'unknown',
          status: 'error',
          error: r.reason?.message || 'Extraction failed',
        });
      }
    }

    const processed = batchResults.filter((r) => r.status === 'processed').length;
    const pending = batchResults.filter((r) => r.status === 'pending_confirmation').length;
    const errors = batchResults.filter((r) => r.status === 'error').length;

    this.logger.log(`✅ Batch completo: ${processed} procesados, ${pending} pendientes, ${errors} errores`);

    return {
      total: files.length,
      processed,
      pendingConfirmation: pending,
      errors,
      results: batchResults,
    };
  }

  /**
   * Homogenize type names and group docs for large batches (5+ unmatched).
   * Uses Gemini to consolidate similar type names, then extracts with unified schema.
   */
  private async homogenizeAndGroupBatch(
    items: Array<{
      file: Express.Multer.File;
      ocrText: string;
      storageKey: string;
      classification: import('../../ai-services/gemini-classifier.service').ClassifyAndExtractResult;
    }>,
    batchResults: BatchDocResult[],
    user: User,
  ): Promise<void> {
    // Group by inferred type
    const typeGroups = new Map<string, typeof items>();
    for (const item of items) {
      const typeName =
        item.classification.classification.inferredType ||
        item.classification.inferredData?.inferred_type ||
        'Desconocido';
      if (!typeGroups.has(typeName)) {
        typeGroups.set(typeName, []);
      }
      typeGroups.get(typeName)!.push(item);
    }

    // If multiple type names, try to homogenize
    const typeNames = Array.from(typeGroups.keys());
    let homogenizedGroups = typeGroups;

    if (typeNames.length > 1) {
      try {
        // Use Gemini to find equivalences
        const genAI = new (await import('@google/generative-ai')).GoogleGenerativeAI(
          process.env.GOOGLE_AI_API_KEY || '',
        );
        const model = genAI.getGenerativeModel({ model: process.env.GEMINI_MODEL || 'gemini-2.5-flash' });

        const prompt = `Given these document type names, group equivalent ones and return a canonical name for each group.
Types: ${JSON.stringify(typeNames)}
Return JSON: {"merges":[{"canonical":"Name","variants":["name1","name2"]}]}
If no merges needed, return {"merges":[]}. JSON only.`;

        const result = await model.generateContent(prompt);
        const response = result.response.text();
        const jsonMatch = response.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          const parsed = JSON.parse(jsonMatch[0]);
          if (parsed.merges?.length > 0) {
            homogenizedGroups = new Map<string, typeof items>();
            const merged = new Set<string>();

            for (const merge of parsed.merges) {
              const allItems: typeof items = [];
              for (const variant of merge.variants || []) {
                if (typeGroups.has(variant)) {
                  allItems.push(...typeGroups.get(variant)!);
                  merged.add(variant);
                }
              }
              if (allItems.length > 0) {
                homogenizedGroups.set(merge.canonical, allItems);
              }
            }
            // Add non-merged groups
            for (const [name, groupItems] of typeGroups) {
              if (!merged.has(name)) {
                homogenizedGroups.set(name, groupItems);
              }
            }
          }
        }
      } catch (e) {
        this.logger.warn(`Homogenization failed, using original groups: ${e.message}`);
      }
    }

    // Process each group: save as pending_confirmation but with grouped info
    for (const [typeName, groupItems] of homogenizedGroups) {
      for (const item of groupItems) {
        const inferredData = item.classification.inferredData || {
          inferred_type: typeName,
          summary: 'Pendiente de confirmación (batch)',
          key_fields: item.classification.extraction?.fields || [],
        };
        // Override type name with homogenized version
        inferredData.inferred_type = typeName;

        const viewUrl = await this.storageService.getPresignedUrl(item.storageKey, 7 * 24 * 3600);
        const document = this.documentRepository.create({
          userId: user.id,
          documentTypeId: null,
          filename: item.file.originalname,
          storageKey: item.storageKey,
          storageProvider: 'r2',
          googleDriveLink: viewUrl,
          googleDriveFileId: null,
          ocrRawText: item.ocrText,
          extractedData: null,
          inferredData,
          confidenceScore: item.classification.classification.confidence,
          status: 'pending_confirmation',
        });
        await this.documentRepository.save(document);

        batchResults.push({
          filename: item.file.originalname,
          status: 'pending_confirmation',
          documentId: document.id,
          suggestedType: typeName,
          confidence: item.classification.classification.confidence,
        });
      }
    }
  }

  /**
   * Confirm or cancel a pending document type.
   */
  async confirmDocumentType(
    documentId: number,
    action: 'create_type' | 'cancel',
    user: User,
    typeName?: string,
  ): Promise<{ success: boolean; message: string; document?: any; documentType?: any }> {
    const document = await this.documentRepository.findOne({
      where: { id: documentId, userId: user.id },
    });

    if (!document) {
      throw new BadRequestException('Documento no encontrado');
    }

    if (document.status !== 'pending_confirmation') {
      throw new BadRequestException(
        `El documento no está pendiente de confirmación (status: ${document.status})`,
      );
    }

    if (action === 'cancel') {
      // Delete from R2
      if (document.storageKey) {
        try {
          await this.storageService.deleteFile(document.storageKey);
        } catch (e) {
          this.logger.warn(`Error deleting from R2: ${e.message}`);
        }
      }
      await this.documentRepository.remove(document);
      return {
        success: true,
        message: `Documento "${document.filename}" eliminado`,
      };
    }

    // action === 'create_type'
    const finalTypeName =
      typeName || document.inferredData?.inferred_type || 'Tipo Sin Nombre';

    // Check if type already exists
    let documentType = await this.documentTypeRepository.findOne({
      where: { name: finalTypeName, userId: user.id },
    });

    if (!documentType) {
      // Build field schema from inferred data
      const inferredFields = document.inferredData?.key_fields || [];
      const fields = inferredFields.map((f: any) => ({
        name: f.name,
        type: this.normalizeFieldType(f.type || 'string'),
        label: f.label || f.name,
        required: f.required || false,
        description: f.description || '',
      }));

      documentType = this.documentTypeRepository.create({
        userId: user.id,
        name: finalTypeName,
        description: document.inferredData?.summary || `Tipo "${finalTypeName}" creado desde batch`,
        fieldSchema: { fields },
        googleDriveFolderId: null,
        folderPath: null,
      });
      await this.documentTypeRepository.save(documentType);
      this.invalidateTypesCache();
      this.logger.log(`✅ Tipo "${finalTypeName}" creado (ID: ${documentType.id})`);
    }

    // Now extract data using the type schema
    let extractedData: any = null;
    try {
      if (document.storageKey) {
        const fileBuffer = await this.storageService.downloadFile(document.storageKey);
        const mimeType = document.filename.toLowerCase().endsWith('.pdf')
          ? 'application/pdf'
          : 'image/jpeg';
        extractedData = await this.geminiClassifierService.extractDataWithVision(
          fileBuffer,
          mimeType,
          documentType,
        );
      } else if (document.ocrRawText) {
        extractedData = await this.geminiClassifierService.extractData(
          document.ocrRawText,
          documentType,
        );
      }
    } catch (e) {
      this.logger.warn(`Extraction failed for confirmed doc: ${e.message}`);
      extractedData = document.inferredData
        ? { summary: document.inferredData.summary, fields: document.inferredData.key_fields }
        : null;
    }

    // Copy to typed storage
    if (document.storageKey) {
      try {
        const fileBuffer = await this.storageService.downloadFile(document.storageKey);
        const mimeType = document.filename.toLowerCase().endsWith('.pdf')
          ? 'application/pdf'
          : 'image/jpeg';
        const typedKey = this.storageService.buildTypedKey(
          user.id,
          finalTypeName,
          document.filename,
        );
        await this.storageService.uploadFile(fileBuffer, typedKey, mimeType);
      } catch (e) {
        this.logger.warn(`Typed storage copy failed: ${e.message}`);
      }
    }

    // Update document
    document.documentTypeId = documentType.id;
    document.extractedData = extractedData;
    document.status = 'completed';
    await this.documentRepository.save(document);

    await this.subscriptionsService.incrementUsage(user.id);

    return {
      success: true,
      message: `Documento "${document.filename}" confirmado como tipo "${finalTypeName}"`,
      document: {
        id: document.id,
        filename: document.filename,
        documentTypeId: documentType.id,
        extractedData,
        status: 'completed',
      },
      documentType: {
        id: documentType.id,
        name: documentType.name,
      },
    };
  }

  /**
   * Normalize field type from AI output to valid FieldDefinition types.
   */
  private normalizeFieldType(type: string): 'string' | 'number' | 'date' | 'boolean' | 'array' {
    const lower = type.toLowerCase().trim();
    if (['number', 'integer', 'float', 'currency'].includes(lower)) return 'number';
    if (['date', 'datetime', 'timestamp'].includes(lower)) return 'date';
    if (['boolean', 'bool'].includes(lower)) return 'boolean';
    if (['array', 'list'].includes(lower)) return 'array';
    return 'string';
  }
}
