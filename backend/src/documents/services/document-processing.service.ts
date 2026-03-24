import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Document } from '../../database/entities/document.entity';
import { DocumentType } from '../../database/entities/document-type.entity';
import { MistralOCRService } from '../../ai-services/mistral-ocr.service';
import { GeminiClassifierService } from '../../ai-services/gemini-classifier.service';
import { StorageService } from '../../storage/storage.service';
import { User } from '../../database/entities/user.entity';

// NOTE: GoogleDriveService import removed — module disabled but not deleted.
// import { GoogleDriveService } from '../../google-drive/services/google-drive.service';

export interface ProcessingResult {
  document: Document;
  wasClassified: boolean;
  createdOthersFolder: boolean;
  message: string;
}

@Injectable()
export class DocumentProcessingService {
  private readonly logger = new Logger(DocumentProcessingService.name);

  private documentTypesCache: { data: DocumentType[]; timestamp: number } | null = null;
  private readonly CACHE_TTL = 5 * 60 * 1000; // 5 minutes

  constructor(
    @InjectRepository(Document)
    private readonly documentRepository: Repository<Document>,
    @InjectRepository(DocumentType)
    private readonly documentTypeRepository: Repository<DocumentType>,
    private readonly mistralOCRService: MistralOCRService,
    private readonly geminiClassifierService: GeminiClassifierService,
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
   * Pipeline completo de procesamiento de documentos (R2 Storage)
   * 1. Subir original a R2 ({user_id}/originals/{filename})
   * 2. Generar presigned URL para OCR
   * 3. OCR con Mistral (usando presigned URL)
   * 4. Clasificación con Gemini
   * 5. Extracción de datos con Gemini
   * 6. Guardar extracted data como JSON en R2
   * 7. Guardar en Base de Datos
   */
  async processDocument(
    fileBuffer: Buffer,
    originalName: string,
    mimeType: string,
    user: User,
  ): Promise<ProcessingResult> {
    this.logger.log(`Iniciando procesamiento de documento: ${originalName}`);

    // Build storage key for the original file
    const originalKey = this.storageService.buildKey(user.id, 'originals', originalName);
    let uploaded = false;

    try {
      // PASO 1: Subir a R2
      this.logger.log('Paso 1/6: Subiendo archivo a R2...');
      await this.storageService.uploadFile(fileBuffer, originalKey, mimeType);
      uploaded = true;
      this.logger.log(`✅ Archivo subido a R2: ${originalKey}`);

      // PASO 2: Generar presigned URL para que Mistral pueda leer el archivo
      this.logger.log('Paso 2/6: Generando presigned URL...');
      const presignedUrl = await this.storageService.getPresignedUrl(originalKey, 600); // 10 min
      this.logger.log('✅ Presigned URL generada');

      // PASO 3 & 4: Run OCR and load document types in parallel
      this.logger.log('Paso 3/6: Extracción de texto (OCR) + carga de tipos...');
      const [ocrResult, availableTypes] = await Promise.all([
        this.mistralOCRService.extractTextSmart(presignedUrl, mimeType),
        this.getAvailableTypes(),
      ]);
      this.logger.log(
        `✅ OCR completado: ${ocrResult.text.length} caracteres (método: ${ocrResult.metadata?.method || 'standard'})`,
      );

      if (availableTypes.length === 0) {
        throw new Error(
          'No hay tipos de documento configurados. Por favor, crea al menos un tipo antes de subir documentos.',
        );
      }

      // PASO 4: Clasificación con Gemini
      this.logger.log('Paso 4/6: Clasificación del documento...');
      const classification = await this.geminiClassifierService.classifyDocument(
        ocrResult.text,
        availableTypes,
      );

      let documentType: DocumentType;
      let createdOthersFolder = false;
      let inferredData: any = null;

      // Determinar o crear tipo de documento
      if (classification.isOthers) {
        this.logger.log('Documento clasificado como "Otros". Buscando/creando tipo "Otros"...');
        documentType = await this.getOrCreateOthersType(user);
        createdOthersFolder = !documentType.id;

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
            return typeName.includes(classifiedTypeName) || classifiedTypeName.includes(typeName);
          });
        }

        // Si aún no hay coincidencia, clasificar como "Otros"
        if (!documentType) {
          this.logger.warn(
            `No se encontró tipo de documento para "${classification.documentTypeName}". Clasificando como "Otros"...`,
          );
          documentType = await this.getOrCreateOthersType(user);

          inferredData = await this.geminiClassifierService.inferFieldsForUnclassifiedWithVision(
            fileBuffer,
            mimeType,
          );

          classification.isOthers = true;
        } else {
          this.logger.log(
            `✅ Documento clasificado como "${documentType.name}" (ID: ${documentType.id})`,
          );
        }
      }

      // PASO 5: Extracción de datos estructurados
      this.logger.log('Paso 5/6: Extracción de datos estructurados...');
      let extractedData: any;

      if (classification.isOthers) {
        extractedData = {
          summary: inferredData?.summary || 'Sin resumen',
          key_fields: inferredData?.key_fields || [],
        };
      } else {
        this.logger.log('🔍 Usando Gemini Vision para extracción de datos...');
        extractedData = await this.geminiClassifierService.extractDataWithVision(
          fileBuffer,
          mimeType,
          documentType,
        );
      }

      // PASO 6: Guardar extracted data como JSON en R2
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
      this.logger.log(`✅ Datos extraídos guardados en R2: ${extractedKey}`);

      // Generate a presigned URL for the original file (valid 7 days for viewing)
      const viewUrl = await this.storageService.getPresignedUrl(originalKey, 7 * 24 * 3600);

      // PASO 7: Guardar en Base de Datos
      this.logger.log('Paso 6/6: Guardando en base de datos...');
      const document = this.documentRepository.create({
        userId: user.id,
        documentTypeId: documentType.id,
        filename: originalName,
        storageKey: originalKey,
        storageProvider: 'r2',
        // Keep legacy fields null for R2-stored docs
        googleDriveLink: viewUrl,   // Backwards-compat: use presigned URL here
        googleDriveFileId: null,
        ocrRawText: ocrResult.text,
        extractedData: extractedData,
        inferredData: classification.isOthers ? inferredData : null,
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
          ? `Documento guardado en R2. El modelo sugiere que podría ser: "${inferredData?.inferred_type || 'Documento Sin Clasificar'}"`
          : `Documento clasificado como "${documentType.name}" con ${(classification.confidence * 100).toFixed(1)}% de confianza`,
      };
    } catch (error) {
      this.logger.error(`Error procesando documento: ${error.message}`, error.stack);

      // Limpiar archivo temporal si hubo error
      if (uploaded) {
        try {
          await this.storageService.deleteFile(originalKey);
          this.logger.log('✅ Archivo temporal eliminado de R2 después de error');
        } catch (cleanupError) {
          this.logger.error(`Error eliminando archivo temporal de R2: ${cleanupError.message}`);
        }
      }

      throw error;
    }
  }

  /**
   * Obtiene o crea el tipo "Otros Documentos" para documentos sin clasificación.
   * Ya no crea carpetas en Google Drive.
   */
  private async getOrCreateOthersType(user: User): Promise<DocumentType> {
    const othersName = process.env.OTHERS_FOLDER_NAME || 'Otros Documentos';

    let othersType = await this.documentTypeRepository.findOne({
      where: { name: othersName },
    });

    if (othersType) {
      return othersType;
    }

    othersType = this.documentTypeRepository.create({
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
      // No Google Drive folder — R2 handles storage
      googleDriveFolderId: null,
      folderPath: null,
    });

    await this.documentTypeRepository.save(othersType);
    this.logger.log('✅ Tipo "Otros Documentos" creado exitosamente');

    return othersType;
  }
}
