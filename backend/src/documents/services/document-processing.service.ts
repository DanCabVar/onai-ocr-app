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
}
