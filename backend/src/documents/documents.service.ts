import {
  Injectable,
  BadRequestException,
  NotFoundException,
  Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DocumentType } from '../database/entities/document-type.entity';
import { GeminiClassifierService } from '../ai-services/gemini-classifier.service';
import { In, Repository } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import { Document } from '../database/entities/document.entity';
import { User } from '../database/entities/user.entity';
import { DocumentProcessingService } from './services/document-processing.service';
import { StorageService } from '../storage/storage.service';
import { SubscriptionsService } from '../subscriptions/subscriptions.service';


/**
 * Normalises a value that may be stored as a Python dict string (single-quoted keys/values,
 * Python True/False/None) into a proper JS object.
 */
function normalisePythonDictString(value: any): any {
  if (value === null || value === undefined) return value;
  if (typeof value !== 'string') return value;
  try {
    return JSON.parse(value);
  } catch {
    try {
      const json = value
        .replace(/'/g, '"')
        .replace(/\bTrue\b/g, 'true')
        .replace(/\bFalse\b/g, 'false')
        .replace(/\bNone\b/g, 'null');
      return JSON.parse(json);
    } catch {
      return value;
    }
  }
}

@Injectable()
export class DocumentsService {
  private readonly logger = new Logger(DocumentsService.name);

  constructor(
    @InjectRepository(Document)
    private readonly documentRepository: Repository<Document>,
    @InjectRepository(DocumentType)
    private readonly documentTypeRepository: Repository<DocumentType>,
    private readonly configService: ConfigService,
    private readonly documentProcessingService: DocumentProcessingService,
    private readonly storageService: StorageService,
    private readonly geminiClassifierService: GeminiClassifierService,
    private readonly subscriptionsService: SubscriptionsService,
  ) {}

  async uploadFile(file: Express.Multer.File, user: User) {
    if (!file) {
      throw new BadRequestException('No se proporcionó ningún archivo');
    }

    // Validar tipo de archivo
    const allowedTypes =
      this.configService
        .get<string>('ALLOWED_FILE_TYPES')
        ?.split(',') || [
        'application/pdf',
        'image/jpeg',
        'image/png',
        'image/jpg',
        'image/webp',
      ];

    if (!allowedTypes.includes(file.mimetype)) {
      throw new BadRequestException(
        `Tipo de archivo no válido. Tipos permitidos: ${allowedTypes.join(', ')}`,
      );
    }

    // Validar tamaño
    const maxSize =
      parseInt(this.configService.get<string>('MAX_FILE_SIZE')) ||
      10 * 1024 * 1024; // 10MB default

    if (file.size > maxSize) {
      throw new BadRequestException(
        `Archivo demasiado grande. Tamaño máximo: ${maxSize / 1024 / 1024}MB`,
      );
    }

    try {
      this.logger.log(`Procesando archivo: ${file.originalname} para usuario ${user.id}`);

      // Procesar documento con el pipeline completo
      const result = await this.documentProcessingService.processDocument(
        file.buffer,
        file.originalname,
        file.mimetype,
        user,
      );

      return {
        success: true,
        message: result.message,
        document: {
          id: result.document.id,
          filename: result.document.filename,
          documentTypeId: result.document.documentTypeId,
          storageKey: result.document.storageKey,
          storageProvider: result.document.storageProvider,
          extractedData: result.document.extractedData,
          confidenceScore: result.document.confidenceScore,
          createdAt: result.document.createdAt,
        },
        wasClassified: result.wasClassified,
        createdOthersFolder: result.createdOthersFolder,
      };
    } catch (error) {
      this.logger.error(`Error procesando documento: ${error.message}`, error.stack);
      throw error;
    }
  }

  /**
   * Background processing — runs the full OCR+classify+extract pipeline
   * outside the HTTP request lifecycle. Updates document status on completion/failure.
   */
  private processInBackground(
    documentId: number,
    fileBuffer: Buffer,
    originalName: string,
    mimeType: string,
    user: User,
  ): void {
    // Intentionally not awaited — runs after HTTP response is sent
    (async () => {
      try {
        const result = await this.documentProcessingService.processDocument(
          fileBuffer,
          originalName,
          mimeType,
          user,
          documentId, // pass existing doc ID so pipeline updates instead of creating
        );
        this.logger.log(`✅ Background processing complete: doc ${documentId}`);
      } catch (error) {
        this.logger.error(
          `❌ Background processing failed for doc ${documentId}: ${error.message}`,
          error.stack,
        );
        // Mark as failed in DB
        try {
          await this.documentRepository.update(documentId, {
            status: 'error',
            extractedData: {
              error: error.message,
              failedAt: new Date().toISOString(),
            } as any,
          });
        } catch (dbError) {
          this.logger.error(`Failed to update error status: ${dbError.message}`);
        }
      }
    })();
  }

  /**
   * Attempt to parse extractedData that may be stored as a Python-style string
   * (single quotes instead of valid JSON). Returns a parsed object or null.
   */
  private sanitizeExtractedData(raw: any): any {
    if (raw === null || raw === undefined) return null;
    if (typeof raw !== 'string') return raw; // already parsed (object/array)

    // Try 1: valid JSON
    try {
      return JSON.parse(raw);
    } catch {
      // Try 2: Python-style single-quote dict → replace ' with "
      try {
        const fixed = raw.replace(/'/g, '"');
        return JSON.parse(fixed);
      } catch {
        // Give up — return null instead of broken string
        return null;
      }
    }
  }

  async getDocuments(user: User, page: number = 1, limit: number = 20) {
    const skip = (page - 1) * limit;

    const [documents, total] = await this.documentRepository.findAndCount({
      where: { userId: user.id },
      order: { createdAt: 'DESC' },
      relations: ['documentType'],
      skip,
      take: limit,
    });

    // Generate fresh presigned URLs for R2-stored docs
    const items = await Promise.all(
      documents.map(async (doc) => {
        let fileUrl: string | null = null;

        if (doc.storageProvider === 'r2' && doc.storageKey) {
          try {
            fileUrl = await this.storageService.getPresignedUrl(doc.storageKey, 3600);
          } catch {
            fileUrl = null;
          }
        }

        return {
          id: doc.id,
          filename: doc.filename,
          documentTypeId: doc.documentTypeId,
          documentTypeName: doc.documentType?.name || null,
          fileUrl,
          storageProvider: doc.storageProvider || 'google_drive',
          extractedData: this.sanitizeExtractedData(doc.extractedData),
          inferredData: doc.inferredData,
          confidenceScore: doc.confidenceScore,
          status: doc.status,
          createdAt: doc.createdAt,
          updatedAt: doc.updatedAt,
          // Legacy fields: only expose for Google Drive documents
          ...(doc.storageProvider !== 'r2' && {
          }),
        };
      }),
    );

    return {
      items,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  /**
   * Lightweight status check for polling during async processing.
   */
  /**
   * Batch status check — returns status of multiple documents at once.
   */
  async getBatchStatus(documentIds: number[], user: User) {
    const documents = await this.documentRepository.find({
      where: { id: In(documentIds), userId: user.id },
      select: ['id', 'status', 'filename', 'documentTypeId', 'confidenceScore', 'updatedAt'],
      relations: ['documentType'],
    });

    const total = documents.length;
    const completed = documents.filter((d) => d.status === 'completed').length;
    const processing = documents.filter((d) => d.status === 'processing').length;
    const errors = documents.filter((d) => d.status === 'error').length;
    const pending = documents.filter((d) => d.status === 'pending_confirmation').length;

    return {
      total,
      completed,
      processing,
      pendingConfirmation: pending,
      errors,
      allDone: processing === 0,
      documents: documents.map((d) => ({
        id: d.id,
        filename: d.filename,
        status: d.status,
        documentTypeName: d.documentType?.name || null,
        confidenceScore: d.confidenceScore,
      })),
    };
  }

  /**
   * Lightweight status check for polling during async processing.
   */
  async getDocumentStatus(documentId: number, user: User) {
    const document = await this.documentRepository.findOne({
      where: { id: documentId, userId: user.id },
      select: ['id', 'status', 'filename', 'documentTypeId', 'confidenceScore', 'updatedAt'],
      relations: ['documentType'],
    });

    if (!document) {
      throw new NotFoundException('Documento no encontrado');
    }

    return {
      id: document.id,
      filename: document.filename,
      status: document.status,
      documentTypeId: document.documentTypeId,
      documentTypeName: document.documentType?.name || null,
      confidenceScore: document.confidenceScore,
      updatedAt: document.updatedAt,
    };
  }

  async getDocumentById(documentId: number, user: User) {
    const document = await this.documentRepository.findOne({
      where: { id: documentId, userId: user.id },
      relations: ['documentType'],
    });

    if (!document) {
      throw new NotFoundException('Documento no encontrado');
    }

    // Generate fresh presigned URL for R2-stored docs
    let fileUrl: string | null = null;
    if (document.storageProvider === 'r2' && document.storageKey) {
      try {
        fileUrl = await this.storageService.getPresignedUrl(document.storageKey, 3600);
      } catch {
        fileUrl = null;
      }
    }

    return {
      id: document.id,
      filename: document.filename,
      documentTypeId: document.documentTypeId,
      documentTypeName: document.documentType?.name || null,
      fileUrl,
      storageProvider: document.storageProvider || 'google_drive',
      storageKey: document.storageKey,
      extractedData: this.sanitizeExtractedData(document.extractedData),
      inferredData: document.inferredData,
      ocrRawText: document.ocrRawText,
      confidenceScore: document.confidenceScore,
      status: document.status,
      createdAt: document.createdAt,
      updatedAt: document.updatedAt,
      // Legacy fields: only expose for Google Drive documents
      ...(document.storageProvider !== 'r2' && {
      }),
    };
  }

  async deleteDocument(documentId: number, user: User) {
    const document = await this.documentRepository.findOne({
      where: { id: documentId, userId: user.id },
      relations: ['documentType'],
    });

    if (!document) {
      throw new NotFoundException('Documento no encontrado');
    }

    this.logger.log(`Eliminando documento ${documentId} (${document.filename}) de usuario ${user.id}`);

    // Delete from R2
    if (document.storageProvider === 'r2' && document.storageKey) {
      try {
        // Delete main file (already in tipos/ or originals/ depending on status)
        await this.storageService.deleteFile(document.storageKey).catch(() => {});
        this.logger.log(`✅ Archivo eliminado de R2: ${document.storageKey}`);

        // Also clean up any lingering copy in originals/ (if file was moved to tipos/)
        if (document.storageKey.includes('/tipos/')) {
          const originalsKey = this.storageService.buildKey(user.id, 'originals', document.filename);
          await this.storageService.deleteFile(originalsKey).catch(() => {});
        }
      } catch (error) {
        this.logger.error(`Error eliminando de R2: ${error.message}`);
      }
    }

    // Eliminar de la base de datos
    await this.documentRepository.remove(document);
    this.logger.log(`✅ Documento eliminado de BD: ${document.filename}`);

    return {
      success: true,
      message: 'Documento eliminado exitosamente',
      document: {
        id: document.id,
        filename: document.filename,
        storageKey: document.storageKey,
        storageProvider: document.storageProvider,
      },
    };
  }

  /**
   * Upload multiple documents in batch.
   */
  async uploadBatch(files: Express.Multer.File[], user: User) {
    this.logger.log(`📦 Batch upload: ${files.length} archivos para usuario ${user.id}`);
    // Use processBatch which handles classification, pending_confirmation, etc.
    return this.documentProcessingService.processBatch(files, user);
  }

  /**
   * Background batch processing.
   */
  private processBatchInBackground(
    files: Express.Multer.File[],
    user: User,
  ): void {
    (async () => {
      try {
        await this.documentProcessingService.processBatch(files, user);
        this.logger.log(`✅ Background batch processing complete: ${files.length} files`);
      } catch (error) {
        this.logger.error(
          `❌ Background batch processing failed: ${error.message}`,
          error.stack,
        );
      }
    })();
  }

  /**
   * Confirm or cancel a pending document type.
   */
  async confirmType(
    documentId: number,
    action: 'create_type' | 'assign_type' | 'cancel',
    user: User,
    typeName?: string,
    typeId?: number,
  ) {
    return this.documentProcessingService.confirmDocumentType(
      documentId,
      action,
      user,
      typeName,
      typeId,
    );
  }

  /**
   * List all files for a user in R2 storage.
   */
  async listUserFiles(user: User) {
    return this.storageService.listUserFiles(user.id);
  }

  /**
   * Get a presigned download URL for a document.
   */
  async getDownloadUrl(documentId: number, user: User): Promise<string> {
    const document = await this.documentRepository.findOne({
      where: { id: documentId, userId: user.id },
    });

    if (!document) {
      throw new NotFoundException('Documento no encontrado');
    }

    if (document.storageProvider !== 'r2' || !document.storageKey) {
      // Fallback to legacy Google Drive link
      throw new BadRequestException('Documento no tiene archivo en R2 ni Google Drive');
    }

    return this.storageService.getPresignedUrl(document.storageKey, 3600);
  }

  /**
   * Upload files to inbox (originals/) without processing.
   * Returns document IDs for polling.
   */
  async uploadToInbox(files: Express.Multer.File[], user: User) {
    this.logger.log(`📥 Inbox upload: ${files.length} archivos para usuario ${user.id}`);
    const documentIds: number[] = [];

    for (const file of files) {
      const key = this.storageService.buildKey(user.id, 'originals', `${Date.now()}-${file.originalname}`);
      await this.storageService.uploadFile(file.buffer, key, file.mimetype);

      const doc = this.documentRepository.create({
        userId: user.id,
        filename: file.originalname,
        storageKey: key,
        storageProvider: 'r2',
        status: 'queued',
      });
      await this.documentRepository.save(doc);
      documentIds.push(doc.id);
    }

    // Trigger background processing
    this.processQueuedInBackground(user);

    return {
      success: true,
      message: `${files.length} archivo(s) en cola. Procesando en segundo plano.`,
      documentIds,
      processing: true,
    };
  }

  /**
   * Process queued documents for a user in background.
   */
  private processQueuedInBackground(currentUser: User): void {
    const userId = currentUser.id;
    const self = this;
    (async () => {
      try {
        const queued = await self.documentRepository.find({
          where: { userId, status: 'queued' },
          take: 20,
        });
        if (queued.length === 0) return;

        self.logger.log(`⚙️ Processing ${queued.length} queued docs for user ${userId}`);

        for (let i = 0; i < queued.length; i += 5) {
          const batch = queued.slice(i, i + 5);
          await Promise.all(batch.map(async (doc) => {
            if (!doc) return;
            try {
              await self.documentRepository.update(doc.id, { status: 'processing' });
              const fileBuffer = await self.storageService.downloadFile(doc.storageKey);
              const mimeType = doc.filename.toLowerCase().endsWith('.pdf') ? 'application/pdf' : 'image/jpeg';
              await self.documentProcessingService.processDocument(fileBuffer, doc.filename, mimeType, currentUser);
              await self.documentRepository.remove(doc);
            } catch (e: any) {
              self.logger.error(`Failed processing queued doc ${doc.id}: ${e.message}`);
              await self.documentRepository.update(doc.id, { status: 'error' });
            }
          }));
        }
      } catch (e: any) {
        self.logger.error(`processQueuedInBackground error: ${e.message}`);
      }
    })();
  }

  /**
   * Re-process a document that failed or needs re-extraction.
   */
  async reprocessDocument(documentId: number, user: User) {
    const document = await this.documentRepository.findOne({
      where: { id: documentId, userId: user.id },
    });

    if (!document) {
      throw new NotFoundException('Documento no encontrado');
    }

    if (!document.storageKey) {
      throw new BadRequestException('El documento no tiene archivo en R2 para re-procesar');
    }

    // Mark as processing
    await this.documentRepository.update(documentId, { status: 'processing' });

    try {
      const fileBuffer = await this.storageService.downloadFile(document.storageKey);
      const mimeType = document.filename.toLowerCase().endsWith('.pdf') ? 'application/pdf' : 'image/jpeg';
      const result = await this.documentProcessingService.processDocument(fileBuffer, document.filename, mimeType, user, documentId) as any;

      // If processDocument returned pending_confirmation (no types or no match)
      if (result?.pendingConfirmation) {
        // Update existing record instead of creating new one
        await this.documentRepository.update(documentId, {
          status: 'pending_confirmation',
          inferredData: result.inferredData || { inferred_type: 'Sin tipo', summary: 'No se encontró un tipo coincidente.', key_fields: [] },
        });
        return {
          success: false,
          pendingConfirmation: true,
          documentId,
          filename: document.filename,
          suggestedType: result.suggestedType || 'Sin tipo',
          message: 'No se encontró un tipo coincidente. Define cómo procesar este documento.',
        };
      }

      return { success: true, message: `"${document.filename}" re-procesado exitosamente.` };
    } catch (e: any) {
      this.logger.error(`Reprocess failed for doc ${documentId}: ${e.message}`);
      await this.documentRepository.update(documentId, { status: 'error' }).catch(() => {});
      return { success: false, message: `Error al re-procesar: ${e.message}` };
    }
  }
  /**
   * Process pre-created document records (avoids duplicates).
   * Each file already has a DB record + R2 upload — just run the pipeline.
   */
  private processExistingDocsInBackground(
    documentIds: number[],
    files: Express.Multer.File[],
    user: User,
  ): void {
    (async () => {
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const docId = documentIds[i];
        if (!file || !docId) continue;
        try {
          // Download from R2 and process
          const key = this.storageService.buildKey(user.id, 'originals', file.originalname);
          const fileBuffer = await this.storageService.downloadFile(key).catch(() => file.buffer);
          const mimeType = file.mimetype || (file.originalname.endsWith('.pdf') ? 'application/pdf' : 'image/jpeg');
          
          // Process — this creates a NEW record, so delete the placeholder first
          await this.documentRepository.delete(docId).catch(() => {});
          await this.documentProcessingService.processDocument(fileBuffer, file.originalname, mimeType, user);
        } catch (e: any) {
          this.logger.error(`Background process failed for doc ${docId}: ${e.message}`);
          await this.documentRepository.update(docId, { status: 'error' }).catch(() => {});
        }
      }
    })();
  }

  /**
   * Resolve pending_confirmation docs in batch.
   * Creates types if needed, extracts data, moves to tipos/ in R2.
   */
  async resolvePendingBatch(
    assignments: Array<{ documentId: number; typeName: string; typeId?: number }>,
    user: User,
  ) {
    const results: any[] = [];

    for (const assignment of assignments) {
      try {
        const document = await this.documentRepository.findOne({
          where: { id: assignment.documentId, userId: user.id },
        });
        if (!document) { results.push({ documentId: assignment.documentId, status: 'error', message: 'Not found' }); continue; }

        // Find or create type
        let documentType = assignment.typeId
          ? await this.documentTypeRepository.findOne({ where: { id: assignment.typeId, userId: user.id } })
          : await this.documentTypeRepository.findOne({ where: { name: assignment.typeName, userId: user.id } });

        if (!documentType) {
          // Create new type — infer schema from the document if possible
          let inferredFields: any[] = [];
          try {
            if (document.storageKey) {
              const fileBuffer = await this.storageService.downloadFile(document.storageKey);
              const mimeType = document.filename.toLowerCase().endsWith('.pdf') ? 'application/pdf' : 'image/jpeg';
              const inferResult = await this.geminiClassifierService.inferFieldsForUnclassifiedWithVision(fileBuffer, mimeType);
              inferredFields = (inferResult.key_fields || []).map((f: any) => ({
                name: f.name,
                label: f.label || f.name,
                type: f.type || 'string',
                required: f.required ?? false,
                description: f.description || '',
              }));
            }
          } catch (e: any) {
            this.logger.warn(`Schema inference failed for new type "${assignment.typeName}": ${e.message}`);
          }

          documentType = this.documentTypeRepository.create({
            userId: user.id,
            name: assignment.typeName,
            description: `Tipo "${assignment.typeName}" creado desde procesamiento batch`,
            fieldSchema: { fields: inferredFields },
          });
          await this.documentTypeRepository.save(documentType);
          this.documentProcessingService.invalidateTypesCache();
        }

        // Extract data using the type schema
        let extractedData: any = null;
        try {
          if (document.storageKey) {
            const fileBuffer = await this.storageService.downloadFile(document.storageKey);
            const mimeType = document.filename.toLowerCase().endsWith('.pdf') ? 'application/pdf' : 'image/jpeg';
            extractedData = await this.geminiClassifierService.extractDataWithVision(fileBuffer, mimeType, documentType);

            // Move to tipos/ folder
            const typedKey = this.storageService.buildTypedKey(user.id, documentType.name, document.filename);
            await this.storageService.uploadFile(fileBuffer, typedKey, mimeType);
            await this.storageService.deleteFile(document.storageKey).catch(() => {});

            await this.documentRepository.update(document.id, {
              documentTypeId: documentType.id,
              storageKey: typedKey,
              extractedData: extractedData || {},
              status: 'completed',
            });
          }
        } catch (e: any) {
          this.logger.warn(`Extraction failed for doc ${document.id}: ${e.message}`);
          await this.documentRepository.update(document.id, {
            documentTypeId: documentType.id,
            extractedData: {},
            status: 'completed',
          });
        }

        await this.subscriptionsService.incrementUsage(user.id);
        results.push({ documentId: document.id, status: 'completed', typeName: documentType.name });
      } catch (e: any) {
        results.push({ documentId: assignment.documentId, status: 'error', message: e.message });
      }
    }

    return { success: true, results, total: results.length, completed: results.filter(r => r.status === 'completed').length };
  }
}
