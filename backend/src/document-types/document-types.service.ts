import {
  Injectable,
  NotFoundException,
  ConflictException,
  ForbiddenException,
  Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { DocumentType } from '../database/entities/document-type.entity';
import { User } from '../database/entities/user.entity';
import { CreateDocumentTypeDto } from './dto/create-document-type.dto';
import { UpdateDocumentTypeDto } from './dto/update-document-type.dto';
import { GoogleDriveService } from '../google-drive/services/google-drive.service';

@Injectable()
export class DocumentTypesService {
  private readonly logger = new Logger(DocumentTypesService.name);

  constructor(
    @InjectRepository(DocumentType)
    private readonly documentTypeRepository: Repository<DocumentType>,
    private readonly googleDriveService: GoogleDriveService,
  ) {}

  async create(createDto: CreateDocumentTypeDto, user: User) {
    // Verificar si ya existe un tipo con ese nombre para este usuario
    const existing = await this.documentTypeRepository.findOne({
      where: { name: createDto.name, userId: user.id },
    });

    if (existing) {
      throw new ConflictException(
        `Ya existe un tipo de documento con el nombre "${createDto.name}"`,
      );
    }

    // Crear carpeta en Google Drive
    let googleDriveFolderId: string | null = null;
    let folderPath: string | null = null;

    try {
      this.logger.log(`Creando carpeta en Google Drive: ${createDto.name}`);
      const folder = await this.googleDriveService.createFolder(createDto.name);
      
      googleDriveFolderId = folder.id;
      folderPath = folder.webViewLink;
      
      this.logger.log(
        `Carpeta creada exitosamente: ${folder.name} (${folder.id})`,
      );
    } catch (error) {
      this.logger.warn(
        `No se pudo crear la carpeta en Google Drive: ${error.message}`,
      );
      // Continuamos sin la carpeta, pero lo registramos
    }

    // Crear el tipo de documento
    const documentType = this.documentTypeRepository.create({
      name: createDto.name,
      description: createDto.description,
      fieldSchema: { fields: createDto.fields },
      userId: user.id,
      googleDriveFolderId,
      folderPath,
    });

    await this.documentTypeRepository.save(documentType);

    return {
      id: documentType.id,
      name: documentType.name,
      description: documentType.description,
      fieldSchema: documentType.fieldSchema,
      googleDriveFolderId: documentType.googleDriveFolderId,
      folderPath: documentType.folderPath,
      createdAt: documentType.createdAt,
      updatedAt: documentType.updatedAt,
    };
  }

  async findAll(user: User) {
    const documentTypes = await this.documentTypeRepository.find({
      where: { userId: user.id },
      order: { createdAt: 'DESC' },
    });

    return documentTypes.map((dt) => ({
      id: dt.id,
      name: dt.name,
      description: dt.description,
      fieldSchema: dt.fieldSchema,
      folderPath: dt.folderPath,
      googleDriveFolderId: dt.googleDriveFolderId,
      createdAt: dt.createdAt,
      updatedAt: dt.updatedAt,
    }));
  }

  async findOne(id: number, user: User) {
    const documentType = await this.documentTypeRepository.findOne({
      where: { id, userId: user.id },
    });

    if (!documentType) {
      throw new NotFoundException('Tipo de documento no encontrado');
    }

    return {
      id: documentType.id,
      name: documentType.name,
      description: documentType.description,
      fieldSchema: documentType.fieldSchema,
      folderPath: documentType.folderPath,
      googleDriveFolderId: documentType.googleDriveFolderId,
      createdAt: documentType.createdAt,
      updatedAt: documentType.updatedAt,
    };
  }

  async update(id: number, updateDto: UpdateDocumentTypeDto, user: User) {
    const documentType = await this.documentTypeRepository.findOne({
      where: { id, userId: user.id },
    });

    if (!documentType) {
      throw new NotFoundException('Tipo de documento no encontrado');
    }

    // Si se está cambiando el nombre, verificar que no exista otro con ese nombre
    if (updateDto.name && updateDto.name !== documentType.name) {
      const existing = await this.documentTypeRepository.findOne({
        where: { name: updateDto.name, userId: user.id },
      });

      if (existing) {
        throw new ConflictException(
          `Ya existe un tipo de documento con el nombre "${updateDto.name}"`,
        );
      }
    }

    // Actualizar campos
    if (updateDto.name) documentType.name = updateDto.name;
    if (updateDto.description !== undefined)
      documentType.description = updateDto.description;
    if (updateDto.fields)
      documentType.fieldSchema = { fields: updateDto.fields };

    await this.documentTypeRepository.save(documentType);

    return {
      id: documentType.id,
      name: documentType.name,
      description: documentType.description,
      fieldSchema: documentType.fieldSchema,
      createdAt: documentType.createdAt,
      updatedAt: documentType.updatedAt,
    };
  }

  async remove(id: number, user: User) {
    const documentType = await this.documentTypeRepository.findOne({
      where: { id, userId: user.id },
      relations: ['documents'],
    });

    if (!documentType) {
      throw new NotFoundException('Tipo de documento no encontrado');
    }

    const documentCount = documentType.documents?.length || 0;

    // Construir mensajes de advertencia
    const warnings: string[] = [];

    if (documentCount > 0) {
      warnings.push(
        `⚠️ Se eliminarán automáticamente ${documentCount} documento(s) asociado(s) de la base de datos.`,
      );
    }

    if (documentType.googleDriveFolderId) {
      warnings.push(
        `⚠️ La carpeta en Google Drive (y sus archivos) NO será eliminada por seguridad. Puedes eliminarla manualmente si lo deseas.`,
      );
    }

    this.logger.warn(
      `Eliminando tipo de documento: ${documentType.name} (ID: ${documentType.id})`,
    );

    if (documentCount > 0) {
      this.logger.warn(
        `Se eliminarán en cascada ${documentCount} documentos asociados.`,
      );
    }

    if (documentType.googleDriveFolderId) {
      this.logger.warn(
        `La carpeta de Google Drive (${documentType.googleDriveFolderId}) no será eliminada.`,
      );
    }

    await this.documentTypeRepository.remove(documentType);

    return {
      message: `Tipo de documento "${documentType.name}" eliminado exitosamente.`,
      deletedDocumentsCount: documentCount,
      warnings: warnings.length > 0 ? warnings : undefined,
      googleDriveFolderId: documentType.googleDriveFolderId,
      folderPath: documentType.folderPath,
    };
  }
}

