import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Document } from '../../database/entities/document.entity';
import { DocumentType } from '../../database/entities/document-type.entity';
import { MistralOCRService } from '../../ai-services/mistral-ocr.service';
import { GeminiClassifierService } from '../../ai-services/gemini-classifier.service';
import { OCRCacheService } from '../../ai-services/ocr-cache.service';
import { PipelineMetricsService, PipelineMetrics } from '../../ai-services/pipeline-metrics.service';
import { StorageService } from '../../storage/storage.service';
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

  /** In-memory cache of document types (avoids DB query per upload) */
  private documentTypesCache: { data: DocumentType[]; timestamp: number } | null = null;
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
  ) {}

  private async getAvailableTypes(): Promise<DocumentType[]> {
    const now = Date.now();
    if (this.documentTypesCache && (now - this.documentTypesCache.timestamp) < this.CACHE_TTL) {
      return this.documentTypesCache.data;
    }
    const types = await this.documentTypeRepository.find();
    this.documentTypesCache = { data: types, timestamp: now };
    return types;
  }

  public invalidateTypesCache(): void {
    this.documentTypesCache = null;
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
          this.getAvailableTypes(),
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
      const availableTypes = await this.getAvailableTypes();
      if (availableTypes.length === 0) {
        throw new Error(
          'No hay tipos de documento configurados. Crea al menos un tipo antes de subir documentos.',
        );
      }

      // ─── PASO 4: Classification with Gemini ───
      const classifyMetric = this.metrics.startStage(ctx, 'classify');
      const classification = await this.geminiClassifierService.classifyDocument(
        ocrResult.text,
        availableTypes,
      );
      this.metrics.endStage(classifyMetric, {
        inputChars: Math.min(ocrResult.text.length, 3000) + 500, // prompt overhead
        outputChars: 200,
        provider: 'gemini',
      });

      let documentType: DocumentType;
      let createdOthersFolder = false;
      let inferredData: any = null;

      // ─── Resolve document type ───
      if (classification.isOthers) {
        this.logger.log('Clasificado como "Otros" — infiriendo campos con Vision...');
        documentType = await this.getOrCreateOthersType(user);
        createdOthersFolder = !documentType.id;

        const inferMetric = this.metrics.startStage(ctx, 'infer-fields-vision');
        inferredData = await this.geminiClassifierService.inferFieldsForUnclassifiedWithVision(
          fileBuffer,
          mimeType,
        );
        this.metrics.endStage(inferMetric, { isVision: true, provider: 'gemini' });
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

          const inferMetric = this.metrics.startStage(ctx, 'infer-fields-vision-fallback');
          inferredData = await this.geminiClassifierService.inferFieldsForUnclassifiedWithVision(
            fileBuffer,
            mimeType,
          );
          this.metrics.endStage(inferMetric, { isVision: true, provider: 'gemini' });
        } else {
          this.logger.log(`✅ Clasificado: "${documentType.name}" (ID: ${documentType.id})`);
        }
      }

      // ─── PASO 5: Structured data extraction ───
      const extractMetric = this.metrics.startStage(ctx, 'extract-data');
      let extractedData: any;

      if (classification.isOthers) {
        extractedData = {
          summary: inferredData?.summary || 'Sin resumen',
          key_fields: inferredData?.key_fields || [],
        };
        this.metrics.endStage(extractMetric); // Already accounted for in infer step
      } else {
        // Use Vision for structured extraction
        extractedData = await this.geminiClassifierService.extractDataWithVision(
          fileBuffer,
          mimeType,
          documentType,
        );
        this.metrics.endStage(extractMetric, { isVision: true, provider: 'gemini' });
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

      throw error;
    }
  }

  /**
   * Get or create the "Otros Documentos" catch-all type.
   */
  private async getOrCreateOthersType(user: User): Promise<DocumentType> {
    const othersName = process.env.OTHERS_FOLDER_NAME || 'Otros Documentos';

    let othersType = await this.documentTypeRepository.findOne({
      where: { name: othersName },
    });

    if (othersType) return othersType;

    othersType = this.documentTypeRepository.create({
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

    await this.documentTypeRepository.save(othersType);
    this.logger.log('✅ Tipo "Otros Documentos" creado');

    return othersType;
  }
}
