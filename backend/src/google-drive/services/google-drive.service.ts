import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { google, drive_v3 } from 'googleapis';
import { GoogleAuthService } from './google-auth.service';

@Injectable()
export class GoogleDriveService {
  private readonly logger = new Logger(GoogleDriveService.name);
  private drive: drive_v3.Drive;
  private rootFolderId: string;

  constructor(
    private googleAuthService: GoogleAuthService,
    private configService: ConfigService,
  ) {
    this.rootFolderId = this.configService.get<string>(
      'GOOGLE_DRIVE_ROOT_FOLDER_ID',
    );
    this.initializeDrive();
  }

  private initializeDrive() {
    const auth = this.googleAuthService.getOAuth2Client();
    this.drive = google.drive({ version: 'v3', auth });
    this.logger.log('Google Drive service initialized');
  }

  /**
   * Crea una carpeta en Google Drive
   * @param folderName - Nombre de la carpeta a crear
   * @param parentFolderId - ID de la carpeta padre (opcional, por defecto usa GOOGLE_DRIVE_ROOT_FOLDER_ID)
   * @returns Objeto con id, name y webViewLink de la carpeta creada
   */
  async createFolder(
    folderName: string,
    parentFolderId?: string,
  ): Promise<{ id: string; name: string; webViewLink: string }> {
    try {
      if (!this.googleAuthService.isAuthenticated()) {
        throw new BadRequestException(
          'Usuario no autenticado con Google Drive. Visita /api/google/auth',
        );
      }

      const parentId = parentFolderId || this.rootFolderId;

      const fileMetadata: drive_v3.Schema$File = {
        name: folderName,
        mimeType: 'application/vnd.google-apps.folder',
        parents: [parentId],
      };

      const response = await this.drive.files.create({
        requestBody: fileMetadata,
        fields: 'id, name, webViewLink',
      });

      this.logger.log(`Folder created: ${response.data.name} (${response.data.id})`);

      return {
        id: response.data.id,
        name: response.data.name,
        webViewLink: response.data.webViewLink,
      };
    } catch (error) {
      this.logger.error('Error creating folder in Google Drive', error);
      throw new BadRequestException(
        `Error al crear carpeta en Google Drive: ${error.message}`,
      );
    }
  }

  /**
   * Lista los archivos/carpetas dentro de una carpeta
   * @param folderId - ID de la carpeta a listar
   * @returns Lista de archivos/carpetas
   */
  async listFilesInFolder(folderId: string): Promise<drive_v3.Schema$File[]> {
    try {
      if (!this.googleAuthService.isAuthenticated()) {
        throw new BadRequestException(
          'Usuario no autenticado con Google Drive. Visita /api/google/auth',
        );
      }

      const response = await this.drive.files.list({
        q: `'${folderId}' in parents and trashed = false`,
        fields: 'files(id, name, mimeType, createdTime, modifiedTime, webViewLink)',
        orderBy: 'name',
      });

      this.logger.log(`Listed ${response.data.files.length} files in folder ${folderId}`);

      return response.data.files || [];
    } catch (error) {
      this.logger.error('Error listing files in Google Drive', error);
      throw new BadRequestException(
        `Error al listar archivos en Google Drive: ${error.message}`,
      );
    }
  }

  /**
   * Obtiene la información de un archivo/carpeta
   * @param fileId - ID del archivo/carpeta
   * @returns Información del archivo/carpeta
   */
  async getFile(fileId: string): Promise<drive_v3.Schema$File> {
    try {
      if (!this.googleAuthService.isAuthenticated()) {
        throw new BadRequestException(
          'Usuario no autenticado con Google Drive. Visita /api/google/auth',
        );
      }

      const response = await this.drive.files.get({
        fileId,
        fields: 'id, name, mimeType, createdTime, modifiedTime, webViewLink, parents',
      });

      this.logger.log(`File info retrieved: ${response.data.name}`);

      return response.data;
    } catch (error) {
      this.logger.error('Error getting file info from Google Drive', error);
      throw new BadRequestException(
        `Error al obtener información del archivo: ${error.message}`,
      );
    }
  }

  /**
   * Elimina un archivo/carpeta de Google Drive
   * @param fileId - ID del archivo/carpeta a eliminar
   * @param checkEmpty - Si es true, verifica que la carpeta esté vacía antes de eliminar
   */
  async deleteFile(fileId: string, checkEmpty: boolean = false): Promise<void> {
    try {
      if (!this.googleAuthService.isAuthenticated()) {
        throw new BadRequestException(
          'Usuario no autenticado con Google Drive. Visita /api/google/auth',
        );
      }

      // Si se debe verificar que esté vacía
      if (checkEmpty) {
        const files = await this.listFilesInFolder(fileId);
        if (files.length > 0) {
          throw new BadRequestException(
            `La carpeta contiene ${files.length} archivo(s). Elimínalos primero antes de eliminar la carpeta.`,
          );
        }
      }

      await this.drive.files.delete({ fileId });

      this.logger.log(`File/Folder deleted from Drive: ${fileId}`);
    } catch (error) {
      this.logger.error('Error deleting file from Google Drive', error);
      
      if (error instanceof BadRequestException) {
        throw error;
      }
      
      throw new BadRequestException(
        `Error al eliminar archivo de Google Drive: ${error.message}`,
      );
    }
  }

  /**
   * Sube un archivo a Google Drive
   * @param fileBuffer - Buffer del archivo
   * @param fileName - Nombre del archivo
   * @param mimeType - Tipo MIME del archivo
   * @param folderId - ID de la carpeta donde subir el archivo
   * @returns Información del archivo subido
   */
  async uploadFile(
    fileBuffer: Buffer,
    fileName: string,
    mimeType: string,
    folderId: string,
  ): Promise<drive_v3.Schema$File> {
    try {
      if (!this.googleAuthService.isAuthenticated()) {
        throw new BadRequestException(
          'Usuario no autenticado con Google Drive. Visita /api/google/auth',
        );
      }

      const { Readable } = require('stream');
      const media = {
        mimeType: mimeType,
        body: Readable.from(fileBuffer),
      };

      const fileMetadata = {
        name: fileName,
        parents: [folderId],
      };

      const response = await this.drive.files.create({
        requestBody: fileMetadata,
        media: media,
        fields: 'id, name, mimeType, webViewLink, createdTime',
      });

      this.logger.log(`File uploaded to Drive: ${response.data.name} (${response.data.id})`);

      return response.data;
    } catch (error) {
      this.logger.error('Error uploading file to Google Drive', error);
      throw new BadRequestException(
        `Error al subir archivo a Google Drive: ${error.message}`,
      );
    }
  }

  /**
   * Obtiene o crea la carpeta "Processing" para archivos en cola
   * @returns ID de la carpeta "Processing"
   */
  async getOrCreateProcessingFolder(): Promise<string> {
    try {
      if (!this.googleAuthService.isAuthenticated()) {
        throw new BadRequestException(
          'Usuario no autenticado con Google Drive. Visita /api/google/auth',
        );
      }

      // Buscar si ya existe la carpeta "Processing"
      const response = await this.drive.files.list({
        q: `name = 'Processing' and '${this.rootFolderId}' in parents and mimeType = 'application/vnd.google-apps.folder' and trashed = false`,
        fields: 'files(id, name)',
      });

      if (response.data.files && response.data.files.length > 0) {
        const folderId = response.data.files[0].id;
        this.logger.log(`Carpeta "Processing" encontrada: ${folderId}`);
        return folderId;
      }

      // Si no existe, crear la carpeta
      this.logger.log('Carpeta "Processing" no encontrada, creando...');
      const folder = await this.createFolder('Processing', this.rootFolderId);
      return folder.id;
    } catch (error) {
      this.logger.error('Error getting/creating Processing folder', error);
      throw new BadRequestException(
        `Error al obtener/crear carpeta Processing: ${error.message}`,
      );
    }
  }

  /**
   * Obtiene la URL pública de un archivo en Google Drive
   * @param fileId - ID del archivo
   * @returns URL pública del archivo
   */
  async getPublicUrl(fileId: string): Promise<string> {
    try {
      if (!this.googleAuthService.isAuthenticated()) {
        throw new BadRequestException(
          'Usuario no autenticado con Google Drive. Visita /api/google/auth',
        );
      }

      // Hacer el archivo público
      await this.drive.permissions.create({
        fileId: fileId,
        requestBody: {
          role: 'reader',
          type: 'anyone',
        },
      });

      // Obtener la URL pública directa
      const file = await this.drive.files.get({
        fileId: fileId,
        fields: 'webContentLink, webViewLink',
      });

      // Para PDFs e imágenes, usar webContentLink (descarga directa)
      // Si no está disponible, usar webViewLink
      const publicUrl = file.data.webContentLink || file.data.webViewLink;

      this.logger.log(`URL pública generada para archivo ${fileId}: ${publicUrl}`);

      return publicUrl;
    } catch (error) {
      this.logger.error('Error getting public URL from Google Drive', error);
      throw new BadRequestException(
        `Error al obtener URL pública: ${error.message}`,
      );
    }
  }

  /**
   * Mueve un archivo a otra carpeta en Google Drive
   * @param fileId - ID del archivo a mover
   * @param targetFolderId - ID de la carpeta destino
   */
  async moveFile(fileId: string, targetFolderId: string): Promise<void> {
    try {
      if (!this.googleAuthService.isAuthenticated()) {
        throw new BadRequestException(
          'Usuario no autenticado con Google Drive. Visita /api/google/auth',
        );
      }

      // Obtener los padres actuales del archivo
      const file = await this.drive.files.get({
        fileId: fileId,
        fields: 'parents',
      });

      const previousParents = file.data.parents ? file.data.parents.join(',') : '';

      // Mover el archivo
      await this.drive.files.update({
        fileId: fileId,
        addParents: targetFolderId,
        removeParents: previousParents,
        fields: 'id, parents',
      });

      this.logger.log(`Archivo ${fileId} movido a carpeta ${targetFolderId}`);
    } catch (error) {
      this.logger.error('Error moving file in Google Drive', error);
      throw new BadRequestException(
        `Error al mover archivo en Google Drive: ${error.message}`,
      );
    }
  }

  /**
   * Retorna el ID de la carpeta raíz configurada
   */
  getRootFolderId(): string {
    return this.rootFolderId;
  }
}

