import {
  Injectable,
  BadRequestException,
  NotFoundException,
  Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import { Document } from '../database/entities/document.entity';
import { User } from '../database/entities/user.entity';
import { DocumentProcessingService } from './services/document-processing.service';

@Injectable()
export class DocumentsService {
  private readonly logger = new Logger(DocumentsService.name);

  constructor(
    @InjectRepository(Document)
    private readonly documentRepository: Repository<Document>,
    private readonly configService: ConfigService,
    private readonly documentProcessingService: DocumentProcessingService,
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
          googleDriveFileId: result.document.googleDriveFileId,
          googleDriveLink: result.document.googleDriveLink,
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

  async getDocuments(user: User) {
    const documents = await this.documentRepository.find({
      order: { createdAt: 'DESC' },
      relations: ['documentType'],
    });

    return documents.map((doc) => ({
      id: doc.id,
      filename: doc.filename,
      documentTypeId: doc.documentTypeId,
      documentTypeName: doc.documentType?.name || null,
      googleDriveLink: doc.googleDriveLink,
      googleDriveFileId: doc.googleDriveFileId,
      extractedData: doc.extractedData,
      inferredData: doc.inferredData, // Para documentos "Otros"
      confidenceScore: doc.confidenceScore,
      status: doc.status,
      createdAt: doc.createdAt,
      updatedAt: doc.updatedAt,
    }));
  }

  async getDocumentById(documentId: number, user: User) {
    const document = await this.documentRepository.findOne({
      where: { id: documentId },
      relations: ['documentType'],
    });

    if (!document) {
      throw new NotFoundException('Documento no encontrado');
    }

    return {
      id: document.id,
      filename: document.filename,
      documentTypeId: document.documentTypeId,
      documentTypeName: document.documentType?.name || null,
      googleDriveLink: document.googleDriveLink,
      googleDriveFileId: document.googleDriveFileId,
      extractedData: document.extractedData,
      inferredData: document.inferredData,
      ocrRawText: document.ocrRawText,
      confidenceScore: document.confidenceScore,
      status: document.status,
      createdAt: document.createdAt,
      updatedAt: document.updatedAt,
    };
  }

  async deleteDocument(documentId: number, user: User) {
    const document = await this.documentRepository.findOne({
      where: { id: documentId },
      relations: ['documentType'],
    });

    if (!document) {
      throw new NotFoundException('Documento no encontrado');
    }

    this.logger.log(`Eliminando documento ${documentId} (${document.filename}) de usuario ${user.id}`);

    // Eliminar de la base de datos
    await this.documentRepository.remove(document);

    this.logger.log(`✅ Documento eliminado de BD: ${document.filename}`);

    return {
      success: true,
      message: 'Documento eliminado exitosamente de la base de datos',
      warning: 'NOTA: El archivo en Google Drive NO ha sido eliminado por seguridad. Puedes eliminarlo manualmente si lo deseas.',
      document: {
        id: document.id,
        filename: document.filename,
        googleDriveFileId: document.googleDriveFileId,
        googleDriveLink: document.googleDriveLink,
      },
    };
  }
}

