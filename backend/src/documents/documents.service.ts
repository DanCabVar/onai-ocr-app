import {
  Injectable,
  BadRequestException,
  NotFoundException,
  Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import { Document } from '../database/entities/document.entity';
import { User } from '../database/entities/user.entity';
import { DocumentProcessingService } from './services/document-processing.service';
import { StorageService } from '../storage/storage.service';


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
    private readonly configService: ConfigService,
    private readonly documentProcessingService: DocumentProcessingService,
    private readonly storageService: StorageService,
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

    // Delete from R2 if stored there
    if (document.storageProvider === 'r2' && document.storageKey) {
      try {
        await this.storageService.deleteFile(document.storageKey);
        this.logger.log(`✅ Archivo eliminado de R2: ${document.storageKey}`);

        // Also try to delete extracted JSON
        const extractedPrefix = `${user.id}/extracted/`;
        const extractedFiles = await this.storageService.listUserFiles(user.id, 'extracted');
        // Best effort — delete matching extracted files
        for (const ef of extractedFiles) {
          if (ef.filename?.includes(document.filename.replace(/\.[^.]+$/, ''))) {
            await this.storageService.deleteFile(ef.key).catch(() => {});
          }
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

    // ─── Async batch: upload all to R2, create DB records, process in background ───
    const documentIds: number[] = [];

    for (const file of files) {
      const originalKey = this.storageService.buildKey(user.id, 'originals', file.originalname);
      await this.storageService.uploadFile(file.buffer, originalKey, file.mimetype);

      const document = this.documentRepository.create({
        userId: user.id,
        filename: file.originalname,
        storageKey: originalKey,
        storageProvider: 'r2',
        status: 'processing',
      });
      await this.documentRepository.save(document);
      documentIds.push(document.id);
    }

    // Fire-and-forget: process full batch in background
    this.processBatchInBackground(files, user);

    return {
      success: true,
      message: `${files.length} documentos recibidos. Procesando en segundo plano.`,
      total: files.length,
      documentIds,
      processing: true,
    };
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

    // Fire and forget
    (async () => {
      try {
        const fileBuffer = await this.storageService.downloadFile(document.storageKey);
        const mimeType = document.filename.toLowerCase().endsWith('.pdf') ? 'application/pdf' : 'image/jpeg';
        await this.documentProcessingService.processDocument(fileBuffer, document.filename, mimeType, user);
        // Remove old record — processDocument creates a new one
        await this.documentRepository.delete(documentId).catch(() => {});
      } catch (e: any) {
        this.logger.error(`Reprocess failed for doc ${documentId}: ${e.message}`);
        await this.documentRepository.update(documentId, { status: 'error' }).catch(() => {});
      }
    })();

    return { success: true, message: `"${document.filename}" está siendo re-procesado.` };
  }
}
