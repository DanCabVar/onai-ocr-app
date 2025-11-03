import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Document } from '../../database/entities/document.entity';
import { DocumentType } from '../../database/entities/document-type.entity';
import { MistralOCRService } from '../../ai-services/mistral-ocr.service';
import { GeminiClassifierService } from '../../ai-services/gemini-classifier.service';
import { GoogleDriveService } from '../../google-drive/services/google-drive.service';
import { User } from '../../database/entities/user.entity';

export interface ProcessingResult {
  document: Document;
  wasClassified: boolean;
  createdOthersFolder: boolean;
  message: string;
}

@Injectable()
export class DocumentProcessingService {
  private readonly logger = new Logger(DocumentProcessingService.name);

  constructor(
    @InjectRepository(Document)
    private readonly documentRepository: Repository<Document>,
    @InjectRepository(DocumentType)
    private readonly documentTypeRepository: Repository<DocumentType>,
    private readonly mistralOCRService: MistralOCRService,
    private readonly geminiClassifierService: GeminiClassifierService,
    private readonly googleDriveService: GoogleDriveService,
  ) {}

  /**
   * Pipeline completo de procesamiento de documentos (NUEVO FLUJO CON URLS)
   * 1. Subir a carpeta "Processing" (temporal)
   * 2. Obtener URL pública del archivo
   * 3. OCR con Mistral (usando URL)
   * 4. Clasificación con Gemini
   * 5. Extracción de datos con Gemini
   * 6. Mover archivo a carpeta del tipo clasificado
   * 7. Eliminar de carpeta "Processing"
   * 8. Guardar en Base de Datos
   */
  async processDocument(
    fileBuffer: Buffer,
    originalName: string,
    mimeType: string,
    user: User,
  ): Promise<ProcessingResult> {
    this.logger.log(`Iniciando procesamiento de documento: ${originalName}`);

    let processingFileId: string | null = null;

    try {
      // PASO 1: Subir a carpeta temporal "Processing"
      this.logger.log('Paso 1/7: Subiendo a carpeta temporal "Processing"...');
      const processingFolderId = await this.googleDriveService.getOrCreateProcessingFolder();
      const processingFile = await this.googleDriveService.uploadFile(
        fileBuffer,
        originalName,
        mimeType,
        processingFolderId,
      );
      processingFileId = processingFile.id;
      this.logger.log(`✅ Archivo subido a Processing: ${processingFileId}`);

      // PASO 2: Obtener URL pública del archivo
      this.logger.log('Paso 2/7: Generando URL pública...');
      const publicUrl = await this.googleDriveService.getPublicUrl(processingFileId);
      this.logger.log(`✅ URL pública generada: ${publicUrl}`);

      // PASO 3: Extracción de texto con OCR inteligente (OCR estándar + Vision fallback)
      this.logger.log('Paso 3/7: Extracción de texto (OCR inteligente)...');
      const ocrResult = await this.mistralOCRService.extractTextSmart(
        publicUrl,
        mimeType,
      );
      this.logger.log(`✅ OCR completado: ${ocrResult.text.length} caracteres (método: ${ocrResult.metadata?.method || 'standard'})`);

      // PASO 4: Obtener tipos de documento disponibles
      const availableTypes = await this.documentTypeRepository.find({
        where: { userId: user.id },
      });

      if (availableTypes.length === 0) {
        throw new Error(
          'No hay tipos de documento configurados. Por favor, crea al menos un tipo antes de subir documentos.',
        );
      }

      // PASO 5: Clasificación con Gemini
      this.logger.log('Paso 4/7: Clasificación del documento...');
      const classification = await this.geminiClassifierService.classifyDocument(
        ocrResult.text,
        availableTypes,
      );

      let documentType: DocumentType;
      let createdOthersFolder = false;
      let inferredData: any = null;

      // PASO 6: Determinar o crear tipo de documento
      if (classification.isOthers) {
        this.logger.log(
          'Documento clasificado como "Otros". Buscando/creando carpeta "Otros"...',
        );
        documentType = await this.getOrCreateOthersFolder(user);
        createdOthersFolder = !documentType.id; // Si no tenía ID, se acaba de crear

        // Inferir campos clave para documentos "Otros" usando VISIÓN
        this.logger.log('🔍 Infiriendo campos clave con Gemini Vision...');
        inferredData = await this.geminiClassifierService.inferFieldsForUnclassifiedWithVision(
          fileBuffer,
          mimeType,
        );
      } else {
        // BUSCAR POR NOMBRE en lugar de por ID (más resiliente)
        const classifiedTypeName = classification.documentTypeName.toLowerCase().trim();
        
        // Intentar coincidencia exacta primero
        documentType = availableTypes.find(
          (t) => t.name.toLowerCase().trim() === classifiedTypeName,
        );

        // Si no hay coincidencia exacta, buscar similitud parcial
        if (!documentType) {
          this.logger.warn(
            `No se encontró coincidencia exacta para "${classification.documentTypeName}". Buscando similitud...`,
          );
          
          documentType = availableTypes.find((t) => {
            const typeName = t.name.toLowerCase().trim();
            // Coincidencia parcial: uno contiene al otro
            return typeName.includes(classifiedTypeName) || classifiedTypeName.includes(typeName);
          });
        }

        // Si aún no hay coincidencia, clasificar como "Otros"
        if (!documentType) {
          this.logger.warn(
            `No se encontró tipo de documento para "${classification.documentTypeName}". Clasificando como "Otros"...`,
          );
          documentType = await this.getOrCreateOthersFolder(user);
          
          // Inferir campos para este documento "Otros"
          inferredData = await this.geminiClassifierService.inferFieldsForUnclassifiedWithVision(
            fileBuffer,
            mimeType,
          );
          
          // Actualizar la clasificación
          classification.isOthers = true;
        } else {
          this.logger.log(
            `✅ Documento clasificado como "${documentType.name}" (ID: ${documentType.id})`,
          );
        }
      }

      // PASO 7: Extracción de datos estructurados
      this.logger.log('Paso 5/7: Extracción de datos estructurados...');
      let extractedData: any;

      if (classification.isOthers) {
        // Para "Otros", usar inferredData directamente
        extractedData = {
          summary: inferredData?.summary || 'Sin resumen',
          key_fields: inferredData?.key_fields || [],
        };
      } else {
        // Para tipos conocidos, usar VISIÓN directa (Gemini ve el PDF/imagen completo)
        this.logger.log('🔍 Usando Gemini Vision para extracción de datos...');
        extractedData = await this.geminiClassifierService.extractDataWithVision(
          fileBuffer,
          mimeType,
          documentType,
        );
      }

      // PASO 8: Mover archivo a carpeta del tipo clasificado
      this.logger.log(`Paso 6/7: Moviendo archivo a carpeta "${documentType.name}"...`);
      await this.googleDriveService.moveFile(
        processingFileId,
        documentType.googleDriveFolderId,
      );
      this.logger.log(`✅ Archivo movido a carpeta ${documentType.name}`);

      // Obtener el link actualizado del archivo
      const finalFile = await this.googleDriveService.getFile(processingFileId);

      // PASO 9: Guardar en Base de Datos
      this.logger.log('Paso 7/7: Guardando en base de datos...');
      const document = this.documentRepository.create({
        userId: user.id,
        documentTypeId: documentType.id,
        filename: originalName,
        googleDriveLink: finalFile.webViewLink || publicUrl,
        googleDriveFileId: processingFileId,
        ocrRawText: ocrResult.text,
        extractedData: extractedData,
        inferredData: classification.isOthers ? inferredData : null, // Nuevo campo
        confidenceScore: classification.confidence,
        status: 'completed',
      });

      await this.documentRepository.save(document);

      this.logger.log(`✅ Documento procesado exitosamente: ${document.id}`);

      return {
        document,
        wasClassified: !classification.isOthers,
        createdOthersFolder,
        message: classification.isOthers
          ? `Documento guardado en carpeta "Otros". El modelo sugiere que podría ser: "${inferredData?.inferred_type || 'Documento Sin Clasificar'}"`
          : `Documento clasificado como "${documentType.name}" con ${(classification.confidence * 100).toFixed(1)}% de confianza`,
      };
    } catch (error) {
      this.logger.error(
        `Error procesando documento: ${error.message}`,
        error.stack,
      );

      // Limpiar archivo temporal si hubo error
      if (processingFileId) {
        try {
          await this.googleDriveService.deleteFile(processingFileId);
          this.logger.log(`✅ Archivo temporal eliminado después de error`);
        } catch (cleanupError) {
          this.logger.error(
            `Error eliminando archivo temporal: ${cleanupError.message}`,
          );
        }
      }

      throw error;
    }
  }

  /**
   * Obtiene o crea la carpeta "Otros Documentos" para documentos sin clasificación
   */
  private async getOrCreateOthersFolder(user: User): Promise<DocumentType> {
    const othersName = process.env.OTHERS_FOLDER_NAME || 'Otros Documentos';

    // Buscar si ya existe
    let othersFolder = await this.documentTypeRepository.findOne({
      where: { userId: user.id, name: othersName },
    });

    if (othersFolder) {
      return othersFolder;
    }

    // Crear carpeta en Google Drive
    const driveFolder = await this.googleDriveService.createFolder(othersName);

    // Crear tipo de documento "Otros" con campos básicos
    othersFolder = this.documentTypeRepository.create({
      userId: user.id,
      name: othersName,
      description:
        process.env.OTHERS_FOLDER_DESCRIPTION ||
        'Documentos sin clasificación automática. La IA identifica automáticamente el tipo y los campos clave de cada documento.',
      fieldSchema: {
        fields: [
          {
            name: 'document_title',
            type: 'string',
            label: 'Título del Documento',
            required: false,
            description: 'Tipo o título del documento identificado por la IA',
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
            description: 'Resumen breve o entidades principales encontradas',
          },
        ],
      },
      googleDriveFolderId: driveFolder.id,
      folderPath: driveFolder.webViewLink,
    });

    await this.documentTypeRepository.save(othersFolder);

    this.logger.log('✅ Carpeta "Otros Documentos" creada exitosamente');

    return othersFolder;
  }

  /**
   * Sube archivo a Google Drive
   */
  private async uploadToGoogleDrive(
    fileBuffer: Buffer,
    fileName: string,
    mimeType: string,
    folderId: string,
  ): Promise<any> {
    return await this.googleDriveService.uploadFile(
      fileBuffer,
      fileName,
      mimeType,
      folderId,
    );
  }
}

