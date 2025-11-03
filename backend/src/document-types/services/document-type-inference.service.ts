import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { DocumentType } from '../../database/entities/document-type.entity';
import { Document } from '../../database/entities/document.entity';
import { User } from '../../database/entities/user.entity';
import { GeminiClassifierService } from '../../ai-services/gemini-classifier.service';
import { GoogleDriveService } from '../../google-drive/services/google-drive.service';
import {
  ProcessedDocument,
  DocumentTypeGroup,
  ConsolidatedType,
  CreatedDocumentType,
  ConsolidatedField,
} from '../dto/infer-from-samples.dto';

@Injectable()
export class DocumentTypeInferenceService {
  private readonly logger = new Logger(DocumentTypeInferenceService.name);
  private genAI: GoogleGenerativeAI;
  private model: any;
  private modelName: string;

  constructor(
    @InjectRepository(DocumentType)
    private readonly documentTypeRepository: Repository<DocumentType>,
    @InjectRepository(Document)
    private readonly documentRepository: Repository<Document>,
    private readonly geminiClassifierService: GeminiClassifierService,
    private readonly googleDriveService: GoogleDriveService,
    private readonly configService: ConfigService,
  ) {
    const apiKey = this.configService.get<string>('GOOGLE_AI_API_KEY');
    if (!apiKey) {
      throw new Error('GOOGLE_AI_API_KEY no está configurada');
    }

    this.genAI = new GoogleGenerativeAI(apiKey);
    this.modelName = this.configService.get<string>('GEMINI_MODEL') || 'gemini-2.5-flash';
    this.model = this.genAI.getGenerativeModel({ model: this.modelName });

    this.logger.log(`Document Type Inference Service inicializado con modelo: ${this.modelName}`);
  }

  /**
   * Normaliza tipos de campo de Gemini a tipos válidos de FieldDefinition
   * @param type - Tipo inferido por Gemini (puede ser "email", "phone", "currency", etc.)
   * @returns Tipo válido para FieldDefinition
   */
  private normalizeFieldType(type: string): 'string' | 'number' | 'date' | 'boolean' | 'array' {
    const lowerType = type.toLowerCase().trim();
    
    // Mapeo de tipos
    if (lowerType === 'number' || lowerType === 'integer' || lowerType === 'float' || lowerType === 'currency') {
      return 'number';
    }
    
    if (lowerType === 'date' || lowerType === 'datetime' || lowerType === 'timestamp') {
      return 'date';
    }
    
    if (lowerType === 'boolean' || lowerType === 'bool') {
      return 'boolean';
    }
    
    if (lowerType === 'array' || lowerType === 'list') {
      return 'array';
    }
    
    // Por defecto, todo lo demás es string (email, phone, text, etc.)
    return 'string';
  }

  /**
   * MÉTODO 1 (NUEVO): Solo clasifica documentos (identifica tipo, sin extraer campos)
   * @param files - Array de archivos
   * @param user - Usuario para verificar tipos existentes
   * @returns Map de tipo → documentos
   */
  async classifyAndGroupDocuments(
    files: Express.Multer.File[],
    user: User,
  ): Promise<Map<string, { files: Express.Multer.File[], existingType: DocumentType | null }>> {
    this.logger.log(`🔍 Clasificando ${files.length} documentos...`);

    // Obtener todos los tipos existentes del usuario
    const existingTypes = await this.documentTypeRepository.find({
      where: { userId: user.id },
    });

    const classifications = new Map<string, { files: Express.Multer.File[], existingType: DocumentType | null }>();

    // Procesar documentos en paralelo (máximo 3 a la vez)
    const batchSize = 3;
    for (let i = 0; i < files.length; i += batchSize) {
      const batch = files.slice(i, i + batchSize);
      
      await Promise.all(
        batch.map(async (file, index) => {
          try {
            this.logger.log(`   📄 Clasificando ${i + index + 1}/${files.length}: ${file.originalname}`);

            // Solo extraer el tipo (sin campos completos)
            const inferredData = await this.geminiClassifierService.inferFieldsForUnclassifiedWithVision(
              file.buffer,
              file.mimetype,
            );

            const inferredType = inferredData.inferred_type;
            this.logger.log(`   ✅ ${file.originalname}: "${inferredType}"`);

            // Buscar si este tipo ya existe en BD
            const existingType = existingTypes.find(
              t => t.name.toLowerCase().trim() === inferredType.toLowerCase().trim()
            );

            if (existingType) {
              this.logger.log(`   📌 Tipo "${inferredType}" ya existe en BD (ID: ${existingType.id})`);
            } else {
              this.logger.log(`   🆕 Tipo "${inferredType}" es nuevo`);
            }

            // Agrupar por tipo
            if (!classifications.has(inferredType)) {
              classifications.set(inferredType, { files: [], existingType: existingType || null });
            }
            classifications.get(inferredType)!.files.push(file);

          } catch (error) {
            this.logger.error(`   ❌ Error clasificando ${file.originalname}: ${error.message}`);
            throw error;
          }
        }),
      );
    }

    this.logger.log(`✅ ${files.length} documentos clasificados en ${classifications.size} tipo(s)`);
    return classifications;
  }

  /**
   * MÉTODO 2: Agrupa documentos por tipo (consolida nombres similares)
   * @param processedDocs - Documentos procesados del método anterior
   * @returns Map de tipo consolidado -> documentos
   */
  async groupDocumentsByType(
    processedDocs: ProcessedDocument[],
  ): Promise<Map<string, ProcessedDocument[]>> {
    this.logger.log(`🔍 Agrupando ${processedDocs.length} documentos por tipo...`);

    // Extraer tipos únicos
    const uniqueTypes = [...new Set(processedDocs.map((doc) => doc.inferredType))];
    this.logger.log(`   📋 Tipos identificados: ${uniqueTypes.join(', ')}`);

    // Si solo hay un tipo, devolver directamente
    if (uniqueTypes.length === 1) {
      this.logger.log(`   ℹ️  Solo un tipo identificado, no es necesario agrupar`);
      return new Map([[uniqueTypes[0], processedDocs]]);
    }

    // Usar Gemini para agrupar tipos similares
    const prompt = `Eres un experto en clasificación de documentos.

Tengo estos tipos de documentos identificados:
${uniqueTypes.map((t, i) => `${i + 1}. "${t}"`).join('\n')}

**TAREA:** Agrupa los tipos que son EQUIVALENTES (mismo tipo de documento con nombres diferentes).

**EJEMPLOS:**
- "Orden de Compra", "Purchase Order", "Orden Compra" → MISMO TIPO
- "Factura", "Invoice", "Boleta" → MISMO TIPO
- "Orden de Compra" vs "Factura" → TIPOS DIFERENTES

**INSTRUCCIONES:**
1. Identifica grupos de tipos equivalentes
2. Para cada grupo, elige un nombre consolidado (preferiblemente en español)
3. Si un tipo no tiene equivalentes, créale su propio grupo

**FORMATO DE RESPUESTA (JSON):**
{
  "groups": [
    {
      "consolidatedName": "Nombre definitivo en español",
      "equivalents": ["tipo1", "tipo2", ...]
    }
  ]
}

Responde SOLO con el JSON, sin texto adicional.`;

    try {
      const result = await this.model.generateContent(prompt);
      const response = result.response.text();

      // Extraer JSON de la respuesta
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error('No se pudo parsear la respuesta de agrupación');
      }

      const groupingResult = JSON.parse(jsonMatch[0]);
      this.logger.log(`   ✅ Gemini identificó ${groupingResult.groups.length} grupos`);

      // Construir el Map de grupos
      const typeGroups = new Map<string, ProcessedDocument[]>();

      for (const group of groupingResult.groups) {
        const consolidatedName = group.consolidatedName;
        const equivalents = [consolidatedName, ...(group.equivalents || [])];

        this.logger.log(`   📁 Grupo "${consolidatedName}": ${equivalents.join(', ')}`);

        // Filtrar documentos que pertenecen a este grupo
        const docsInGroup = processedDocs.filter((doc) =>
          equivalents.some(
            (equiv) => equiv.toLowerCase().trim() === doc.inferredType.toLowerCase().trim(),
          ),
        );

        if (docsInGroup.length > 0) {
          typeGroups.set(consolidatedName, docsInGroup);
          this.logger.log(`      → ${docsInGroup.length} documentos en este grupo`);
        }
      }

      return typeGroups;
    } catch (error) {
      this.logger.error(`❌ Error agrupando tipos: ${error.message}`);
      
      // Fallback: agrupar exactamente por nombre
      this.logger.warn(`⚠️  Usando agrupación por nombre exacto como fallback`);
      const fallbackGroups = new Map<string, ProcessedDocument[]>();
      
      for (const type of uniqueTypes) {
        const docs = processedDocs.filter((doc) => doc.inferredType === type);
        fallbackGroups.set(type, docs);
      }
      
      return fallbackGroups;
    }
  }

  /**
   * MÉTODO 3: Consolida campos de documentos del mismo tipo
   * @param typeName - Nombre del tipo de documento
   * @param documents - Documentos de ese tipo
   * @returns Tipo consolidado con campos homologados
   */
  async consolidateFieldsByType(
    typeName: string,
    documents: ProcessedDocument[],
  ): Promise<ConsolidatedType> {
    this.logger.log(`🔧 Consolidando campos para tipo "${typeName}" (${documents.length} documentos)...`);

    // Preparar descripción de campos de cada documento
    const documentsDescription = documents.map((doc, index) => {
      const fieldsStr = doc.fields
        .map(
          (f) =>
            `  - ${f.name} (${f.type}): "${f.label}"${f.required ? ' [REQUERIDO]' : ''}`,
        )
        .join('\n');
      return `DOCUMENTO ${index + 1} (${doc.filename}):\n${fieldsStr}`;
    }).join('\n\n');

    const prompt = `Eres un experto en diseño de schemas de datos.

Tengo ${documents.length} documentos tipo "${typeName}" con estos campos extraídos:

${documentsDescription}

**TAREA:** Consolida estos campos en UN SOLO SCHEMA definitivo para el tipo "${typeName}".

**INSTRUCCIONES:**
1. **Identificar campos equivalentes** (mismo concepto, nombres diferentes)
   - Ejemplo: "numero_orden", "order_number", "nro_orden" → MISMO CAMPO
   
2. **Elegir mejor nombre** (snake_case, español, descriptivo)
   - Ejemplo: "numero_orden"
   
3. **Elegir mejor tipo** (el más común o más apropiado)
   - Si hay conflicto (string vs number), elegir el más apropiado semánticamente
   - Tipos disponibles: string, number, date, boolean, email, phone, currency, array
   
4. **Determinar si es required**:
   - required: true si aparece en ≥50% de documentos
   - required: false si aparece en <50%
   
5. **Generar label y descripción útiles en español**

6. **Limitar a máximo 20 campos** (los más importantes y comunes)

7. **Ordenar por importancia** (campos más críticos primero)

**FORMATO DE RESPUESTA (JSON):**
{
  "typeDescription": "Descripción breve del tipo de documento (1-2 líneas)",
  "consolidatedFields": [
    {
      "name": "nombre_campo",
      "type": "string|number|date|boolean|email|phone|currency|array",
      "label": "Etiqueta en español",
      "required": true|false,
      "description": "Descripción clara del campo",
      "frequency": 0.85
    }
  ]
}

Responde SOLO con el JSON, sin texto adicional ni explicaciones.`;

    try {
      const result = await this.model.generateContent(prompt);
      const response = result.response.text();

      // Extraer JSON de la respuesta
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error('No se pudo parsear la respuesta de consolidación');
      }

      const consolidationResult = JSON.parse(jsonMatch[0]);

      this.logger.log(`   ✅ Consolidados ${consolidationResult.consolidatedFields.length} campos`);

      return {
        typeName,
        description: consolidationResult.typeDescription || `Tipo de documento "${typeName}" creado automáticamente a partir de ${documents.length} ejemplos`,
        consolidatedFields: consolidationResult.consolidatedFields,
        sampleDocuments: documents,
        sampleCount: documents.length,
      };
    } catch (error) {
      this.logger.error(`❌ Error consolidando campos para "${typeName}": ${error.message}`);
      throw error;
    }
  }

  /**
   * MÉTODO 4: Crea tipos de documento en BD y Google Drive
   * @param consolidatedTypes - Tipos consolidados del método anterior
   * @param user - Usuario que crea los tipos
   * @param uploadSamples - Si se deben subir los documentos de ejemplo a Drive
   * @returns Tipos creados con IDs y folders
   */
  async createDocumentTypesFromInference(
    consolidatedTypes: ConsolidatedType[],
    user: User,
    uploadSamples: boolean = false,
  ): Promise<CreatedDocumentType[]> {
    this.logger.log(`💾 Creando ${consolidatedTypes.length} tipos de documento en BD y Drive...`);

    const createdTypes: CreatedDocumentType[] = [];

    for (const consolidated of consolidatedTypes) {
      try {
        this.logger.log(`   📁 Creando tipo "${consolidated.typeName}"...`);

        // 1. Verificar si ya existe un tipo con ese nombre
        const existingType = await this.documentTypeRepository.findOne({
          where: { userId: user.id, name: consolidated.typeName },
        });

        let documentType: DocumentType;
        let isNewType = false;

        if (existingType) {
          this.logger.warn(`   ⚠️  El tipo "${consolidated.typeName}" ya existe.`);
          
          // Si no se van a subir documentos, saltar
          if (!uploadSamples || consolidated.sampleDocuments.length === 0) {
            this.logger.warn(`   ⏭️  No hay documentos para subir. Saltando...`);
            continue;
          }
          
          // Si se van a subir documentos, usar el tipo existente
          this.logger.log(`   ✅ Usando tipo existente (ID: ${existingType.id}) para subir documentos...`);
          documentType = existingType;
        } else {
          // Tipo nuevo: crear carpeta y tipo
          isNewType = true;
          
          // 2. Crear carpeta en Google Drive
          this.logger.log(`   📂 Creando carpeta en Google Drive...`);
          const driveFolder = await this.googleDriveService.createFolder(
            consolidated.typeName,
          );
          this.logger.log(`   ✅ Carpeta creada: ${driveFolder.id}`);

          // 3. Crear DocumentType en BD PRIMERO (para obtener el ID)
          this.logger.log(`   💾 Guardando tipo en base de datos...`);
          
          // Normalizar tipos antes de guardar
          const normalizedFields = consolidated.consolidatedFields.map(({ frequency, ...field }) => ({
            name: field.name,
            type: this.normalizeFieldType(field.type),
            label: field.label,
            required: field.required,
            description: field.description,
          })) as import('../../database/entities/document-type.entity').FieldDefinition[];
          
          documentType = this.documentTypeRepository.create({
            userId: user.id,
            name: consolidated.typeName,
            description: consolidated.description,
            fieldSchema: {
              fields: normalizedFields,
            },
            googleDriveFolderId: driveFolder.id,
            folderPath: driveFolder.webViewLink,
          });

          await this.documentTypeRepository.save(documentType);
          this.logger.log(`   ✅ Tipo "${consolidated.typeName}" creado con ID ${documentType.id}`);
        }

        // 4. (Opcional) Subir documentos de ejemplo Y guardarlos en BD
        if (uploadSamples && consolidated.sampleDocuments.length > 0) {
          this.logger.log(`   📤 Subiendo y procesando ${consolidated.sampleDocuments.length} documentos...`);
          
          for (const doc of consolidated.sampleDocuments) {
            try {
              // Subir a Google Drive (usar el folderId del tipo, nuevo o existente)
              const driveFile = await this.googleDriveService.uploadFile(
                doc.buffer,
                doc.filename, // Nombre original, sin prefijo [EJEMPLO]
                doc.mimeType,
                documentType.googleDriveFolderId,
              );

              // Obtener URL pública
              const publicUrl = await this.googleDriveService.getPublicUrl(driveFile.id);

              // Preparar extractedData en el formato esperado
              const extractedData = {
                summary: `Documento de ejemplo usado para crear el tipo "${consolidated.typeName}"`,
                fields: doc.fields.map(field => ({
                  name: field.name,
                  type: field.type,
                  label: field.label,
                  required: field.required,
                  description: field.description,
                  value: field.value || null, // valor extraído durante el análisis
                })),
              };

              // Guardar en BD como documento real
              const documentRecord = this.documentRepository.create({
                userId: user.id,
                documentTypeId: documentType.id, // Ahora sí existe el documentType
                filename: doc.filename,
                googleDriveLink: publicUrl,
                googleDriveFileId: driveFile.id,
                ocrRawText: null, // No usamos OCR separado, Gemini Vision lo procesó
                extractedData: extractedData,
                inferredData: null, // No es un documento "Otros"
                confidenceScore: 0.95, // Alta confianza porque fue usado para crear el tipo
                status: 'completed',
              });

              await this.documentRepository.save(documentRecord);

              this.logger.log(`   ✅ Documento "${doc.filename}" subido y guardado en BD (ID: ${documentRecord.id})`);
            } catch (uploadError) {
              this.logger.warn(`   ⚠️  Error procesando ${doc.filename}: ${uploadError.message}`);
            }
          }
          
          this.logger.log(`   ✅ ${consolidated.sampleDocuments.length} documentos subidos y procesados como documentos reales`);
        }

        // Solo agregar a la respuesta si es un tipo nuevo O si se subieron documentos
        if (isNewType || (uploadSamples && consolidated.sampleDocuments.length > 0)) {
          createdTypes.push({
            id: documentType.id,
            name: documentType.name,
            description: isNewType 
              ? documentType.description 
              : `${documentType.description} (${consolidated.sampleDocuments.length} documentos agregados)`,
            fieldCount: consolidated.consolidatedFields.length,
            sampleDocumentCount: consolidated.sampleCount,
            googleDriveFolderId: documentType.googleDriveFolderId,
            folderPath: documentType.folderPath,
            fields: consolidated.consolidatedFields,
          });
        }
      } catch (error) {
        this.logger.error(`   ❌ Error creando tipo "${consolidated.typeName}": ${error.message}`);
        throw error;
      }
    }

    if (createdTypes.length > 0) {
      this.logger.log(`✅ ${createdTypes.length} tipo(s) procesado(s) exitosamente`);
    } else {
      this.logger.log(`ℹ️  Todos los tipos ya existían y no se subieron documentos`);
    }
    
    return createdTypes;
  }

  /**
   * NUEVO: Re-extrae datos de documentos usando un schema consolidado
   * @param files - Archivos a re-extraer
   * @param consolidatedSchema - Schema consolidado con campos homologados
   * @param typeName - Nombre del tipo de documento
   * @returns Array de extractedData con el schema unificado
   */
  private async reExtractWithUnifiedSchema(
    files: Array<{ buffer: Buffer; filename: string; mimetype: string }>,
    consolidatedSchema: ConsolidatedField[],
    typeName: string,
  ): Promise<Array<{ filename: string; extractedData: any }>> {
    this.logger.log(`🔄 Re-extrayendo ${files.length} documentos con schema unificado...`);

    // Crear un "pseudo DocumentType" con el schema consolidado
    const normalizedFields = consolidatedSchema.map(({ frequency, ...field }) => ({
      name: field.name,
      type: this.normalizeFieldType(field.type),
      label: field.label,
      required: field.required,
      description: field.description,
    })) as import('../../database/entities/document-type.entity').FieldDefinition[];

    const pseudoType = {
      name: typeName,
      fieldSchema: {
        fields: normalizedFields,
      },
    };

    const results = [];

    // Re-extraer cada documento usando el schema unificado
    for (const file of files) {
      try {
        this.logger.log(`   📄 Re-extrayendo: ${file.filename}`);

        const extractedData = await this.geminiClassifierService.extractDataWithVision(
          file.buffer,
          file.mimetype,
          pseudoType as any, // Gemini usará este schema para extraer
        );

        results.push({
          filename: file.filename,
          extractedData: extractedData,
        });

        this.logger.log(`   ✅ Re-extracción completada para ${file.filename}`);
      } catch (error) {
        this.logger.error(`   ❌ Error re-extrayendo ${file.filename}: ${error.message}`);
        throw error;
      }
    }

    return results;
  }

  /**
   * NUEVO: Homologa nombres de tipos similares
   * @param classifications - Map de clasificaciones iniciales
   * @returns Map con nombres de tipos homologados
   */
  private async homologateTypeNames(
    classifications: Map<string, { files: Express.Multer.File[]; existingType: DocumentType | null }>,
  ): Promise<Map<string, { files: Express.Multer.File[]; existingType: DocumentType | null }>> {
    const typeNames = Array.from(classifications.keys());

    // Si solo hay 1 tipo, no hay nada que homologar
    if (typeNames.length <= 1) {
      this.logger.log(`   ℹ️  Solo ${typeNames.length} tipo detectado, no requiere homologación de nombres`);
      return classifications;
    }

    // Filtrar solo tipos nuevos (sin existingType) para homologar
    const newTypeNames = typeNames.filter(name => !classifications.get(name)?.existingType);

    if (newTypeNames.length <= 1) {
      this.logger.log(`   ℹ️  Solo ${newTypeNames.length} tipo nuevo, no requiere homologación de nombres`);
      return classifications;
    }

    this.logger.log(`🔀 Homologando ${newTypeNames.length} nombres de tipos nuevos...`);

    const prompt = `Eres un experto en clasificación de documentos.

Tengo estos tipos de documentos NUEVOS identificados:
${newTypeNames.map((t, i) => `${i + 1}. "${t}"`).join('\n')}

**TAREA:** Agrupa los tipos que son SEMÁNTICAMENTE EQUIVALENTES (mismo tipo de documento con nombres ligeramente diferentes).

**EJEMPLOS DE EQUIVALENCIAS:**
- "Orden de Compra" ≈ "Orden Compra" ≈ "Purchase Order" → MISMO TIPO
- "Orden de Retiro" ≈ "Orden de Despacho / Retiro" ≈ "Guía de Retiro" → MISMO TIPO
- "Factura" ≈ "Invoice" ≈ "Boleta de Venta" → MISMO TIPO

**EJEMPLOS DE NO EQUIVALENCIAS:**
- "Orden de Compra" ≠ "Factura" → TIPOS DIFERENTES
- "Contrato de Trabajo" ≠ "Certificado Laboral" → TIPOS DIFERENTES

**INSTRUCCIONES:**
1. Identifica grupos de tipos que son REALMENTE EQUIVALENTES (mismo documento)
2. Para cada grupo, elige el nombre MÁS CLARO Y ESPECÍFICO en español
3. Si un tipo no tiene equivalentes reales, créale su propio grupo
4. SÉ CONSERVADOR: solo agrupa si estás seguro que son el mismo tipo

**FORMATO DE RESPUESTA (JSON):**
{
  "merges": [
    {
      "canonical_name": "Nombre definitivo elegido",
      "variants": ["nombre1", "nombre2"]
    }
  ]
}

Si NO hay tipos equivalentes, responde: {"merges": []}

Responde SOLO con el JSON, sin texto adicional.`;

    try {
      const result = await this.model.generateContent(prompt);
      const response = result.response.text();

      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        this.logger.warn(`⚠️  No se pudo parsear homologación, usando nombres originales`);
        return classifications;
      }

      const homologationResult = JSON.parse(jsonMatch[0]);

      if (!homologationResult.merges || homologationResult.merges.length === 0) {
        this.logger.log(`   ✅ No se detectaron tipos equivalentes`);
        return classifications;
      }

      this.logger.log(`   🔗 Gemini detectó ${homologationResult.merges.length} fusión(es)`);

      // Crear nuevo Map con tipos fusionados
      const homologatedMap = new Map<string, { files: Express.Multer.File[]; existingType: DocumentType | null }>();

      // Primero, copiar todos los tipos existentes (no se homologan)
      for (const [name, data] of classifications.entries()) {
        if (data.existingType) {
          homologatedMap.set(name, data);
        }
      }

      // Procesar fusiones de tipos nuevos
      const processedTypes = new Set<string>();

      for (const merge of homologationResult.merges) {
        const canonicalName = merge.canonical_name;
        const variants = merge.variants || [];

        this.logger.log(`   🔀 Fusionando: ${variants.join(', ')} → "${canonicalName}"`);

        // Reunir todos los archivos de las variantes
        const allFiles: Express.Multer.File[] = [];

        for (const variant of variants) {
          const variantData = classifications.get(variant);
          if (variantData && !variantData.existingType) {
            allFiles.push(...variantData.files);
            processedTypes.add(variant);
          }
        }

        if (allFiles.length > 0) {
          homologatedMap.set(canonicalName, {
            files: allFiles,
            existingType: null,
          });
        }
      }

      // Agregar tipos nuevos que NO fueron fusionados
      for (const [name, data] of classifications.entries()) {
        if (!data.existingType && !processedTypes.has(name)) {
          homologatedMap.set(name, data);
        }
      }

      this.logger.log(`   ✅ Homologación completa: ${classifications.size} → ${homologatedMap.size} tipos`);
      return homologatedMap;

    } catch (error) {
      this.logger.error(`❌ Error en homologación de nombres: ${error.message}`);
      this.logger.warn(`⚠️  Usando nombres originales como fallback`);
      return classifications;
    }
  }

  /**
   * MÉTODO PRINCIPAL: Orquesta todo el proceso de inferencia
   * @param files - Archivos de ejemplo (hasta 10)
   * @param user - Usuario que crea los tipos
   * @param uploadSamples - Si se deben subir los documentos de ejemplo
   * @returns Tipos creados
   */
  async inferDocumentTypesFromSamples(
    files: Express.Multer.File[],
    user: User,
    uploadSamples: boolean = false,
  ): Promise<CreatedDocumentType[]> {
    this.logger.log(`🚀 Iniciando inferencia de tipos desde ${files.length} documentos de ejemplo`);

    try {
      // ========================================================================
      // PASO 1: Clasificar y agrupar documentos (detectando tipos existentes)
      // ========================================================================
      const initialClassifications = await this.classifyAndGroupDocuments(files, user);

      // ========================================================================
      // PASO 2: Homologar nombres de tipos similares (NUEVO)
      // ========================================================================
      const classifications = await this.homologateTypeNames(initialClassifications);

      const results: CreatedDocumentType[] = [];

      // ========================================================================
      // PASO 3: Procesar cada grupo (tipos existentes y nuevos)
      // ========================================================================
      for (const [typeName, { files: groupFiles, existingType }] of classifications.entries()) {
        this.logger.log(`\n📦 Procesando grupo "${typeName}" (${groupFiles.length} documentos)...`);

        if (existingType) {
          // ============================================================
          // TIPO EXISTENTE: Usar schema existente (sin homologación)
          // ============================================================
          this.logger.log(`   ✅ Tipo "${typeName}" ya existe. Usando schema existente...`);

          if (uploadSamples) {
            this.logger.log(`   📤 Subiendo ${groupFiles.length} documentos con schema existente...`);

            for (const file of groupFiles) {
              try {
                // Extraer datos usando el schema existente (como upload normal)
                const extractedData = await this.geminiClassifierService.extractDataWithVision(
                  file.buffer,
                  file.mimetype,
                  existingType,
                );

                // Subir a Google Drive
                const driveFile = await this.googleDriveService.uploadFile(
                  file.buffer,
                  file.originalname,
                  file.mimetype,
                  existingType.googleDriveFolderId,
                );

                const publicUrl = await this.googleDriveService.getPublicUrl(driveFile.id);

                // Guardar en BD
                const documentRecord = this.documentRepository.create({
                  userId: user.id,
                  documentTypeId: existingType.id,
                  filename: file.originalname,
                  googleDriveLink: publicUrl,
                  googleDriveFileId: driveFile.id,
                  ocrRawText: null,
                  extractedData: extractedData,
                  inferredData: null,
                  confidenceScore: 0.95,
                  status: 'completed',
                });

                await this.documentRepository.save(documentRecord);
                this.logger.log(`   ✅ "${file.originalname}" procesado y guardado (ID: ${documentRecord.id})`);
              } catch (error) {
                this.logger.error(`   ❌ Error procesando "${file.originalname}": ${error.message}`);
              }
            }

            // Agregar a resultados
            results.push({
              id: existingType.id,
              name: existingType.name,
              description: `${existingType.description} (${groupFiles.length} documentos agregados)`,
              fieldCount: existingType.fieldSchema.fields.length,
              sampleDocumentCount: groupFiles.length,
              googleDriveFolderId: existingType.googleDriveFolderId,
              folderPath: existingType.folderPath,
              fields: existingType.fieldSchema.fields.map(f => ({ ...f, frequency: 1.0 })),
            });
          } else {
            this.logger.log(`   ⏭️  Documentos no se subirán (uploadSamples = false)`);
          }

        } else {
          // ============================================================
          // TIPO NUEVO: Hacer consolidación completa + re-extracción
          // ============================================================
          this.logger.log(`   🆕 Tipo "${typeName}" es nuevo. Iniciando proceso de consolidación...`);

          // ============================================================
          // PASO 3: Extracción inicial de campos de cada documento
          // ============================================================
          this.logger.log(`   📊 Extrayendo campos de ${groupFiles.length} documentos...`);
          const processedDocs: ProcessedDocument[] = [];
          
          for (const file of groupFiles) {
            try {
              this.logger.log(`      📄 Extrayendo campos de "${file.originalname}"...`);
              const inferredData = await this.geminiClassifierService.inferFieldsForUnclassifiedWithVision(
                file.buffer,
                file.mimetype,
              );

              processedDocs.push({
                filename: file.originalname,
                inferredType: typeName,
                fields: inferredData.key_fields,
                buffer: file.buffer,
                mimeType: file.mimetype,
              });
              
              this.logger.log(`      ✅ Extraídos ${inferredData.key_fields.length} campos de "${file.originalname}"`);
            } catch (error) {
              this.logger.error(`      ❌ Error extrayendo campos de "${file.originalname}": ${error.message}`);
            }
          }

          if (processedDocs.length === 0) {
            this.logger.error(`   ❌ No se pudo extraer campos de ningún documento del tipo "${typeName}"`);
            continue;
          }

          // ============================================================
          // PASO 4: Consolidación y homologación de campos
          // ============================================================
          this.logger.log(`   🔧 Consolidando campos de ${processedDocs.length} documentos...`);
          const consolidated = await this.consolidateFieldsByType(typeName, processedDocs);
          this.logger.log(`   ✅ Schema consolidado: ${consolidated.consolidatedFields.length} campos únicos`);

          // ============================================================
          // PASO 5: Re-extracción con schema unificado (NUEVO)
          // ============================================================
          let reExtractedData: Array<{ filename: string; extractedData: any }> = [];
          
          if (uploadSamples && processedDocs.length > 0) {
            this.logger.log(`   🔄 Re-extrayendo datos con schema consolidado...`);
            
            reExtractedData = await this.reExtractWithUnifiedSchema(
              processedDocs.map(doc => ({
                buffer: doc.buffer,
                filename: doc.filename,
                mimetype: doc.mimeType,
              })),
              consolidated.consolidatedFields,
              typeName,
            );
            
            this.logger.log(`   ✅ Re-extracción completada: ${reExtractedData.length} documentos procesados`);
          }

          // ============================================================
          // Crear carpeta en Google Drive y tipo en BD
          // ============================================================
          this.logger.log(`   📂 Creando carpeta en Google Drive...`);
          const driveFolder = await this.googleDriveService.createFolder(typeName);
          this.logger.log(`   ✅ Carpeta creada: ${driveFolder.id}`);

          this.logger.log(`   💾 Guardando tipo en base de datos...`);
          
          // Normalizar tipos de campos antes de guardar
          const normalizedFields = consolidated.consolidatedFields.map(({ frequency, ...field }) => ({
            name: field.name,
            type: this.normalizeFieldType(field.type),
            label: field.label,
            required: field.required,
            description: field.description,
          })) as import('../../database/entities/document-type.entity').FieldDefinition[];

          const documentType = this.documentTypeRepository.create({
            userId: user.id,
            name: typeName,
            description: consolidated.description,
            fieldSchema: {
              fields: normalizedFields,
            },
            googleDriveFolderId: driveFolder.id,
            folderPath: driveFolder.webViewLink,
          });

          await this.documentTypeRepository.save(documentType);
          this.logger.log(`   ✅ Tipo "${typeName}" creado (ID: ${documentType.id})`);

          // ============================================================
          // Subir documentos con datos RE-EXTRAÍDOS (schema unificado)
          // ============================================================
          if (uploadSamples && reExtractedData.length > 0) {
            this.logger.log(`   📤 Subiendo ${reExtractedData.length} documentos con datos unificados...`);

            for (let i = 0; i < reExtractedData.length; i++) {
              const reExtracted = reExtractedData[i];
              const originalDoc = processedDocs[i];

              try {
                // Subir a Google Drive
                const driveFile = await this.googleDriveService.uploadFile(
                  originalDoc.buffer,
                  originalDoc.filename,
                  originalDoc.mimeType,
                  documentType.googleDriveFolderId,
                );

                const publicUrl = await this.googleDriveService.getPublicUrl(driveFile.id);

                // Guardar en BD con datos RE-EXTRAÍDOS (schema unificado)
                const documentRecord = this.documentRepository.create({
                  userId: user.id,
                  documentTypeId: documentType.id,
                  filename: originalDoc.filename,
                  googleDriveLink: publicUrl,
                  googleDriveFileId: driveFile.id,
                  ocrRawText: null,
                  extractedData: reExtracted.extractedData, // ✅ Datos con schema unificado
                  inferredData: null,
                  confidenceScore: 0.95,
                  status: 'completed',
                });

                await this.documentRepository.save(documentRecord);
                this.logger.log(`      ✅ "${originalDoc.filename}" guardado (ID: ${documentRecord.id})`);
              } catch (error) {
                this.logger.error(`      ❌ Error guardando "${originalDoc.filename}": ${error.message}`);
              }
            }
            
            this.logger.log(`   ✅ Todos los documentos subidos con schema unificado`);
          }

          // Agregar a resultados
          results.push({
            id: documentType.id,
            name: documentType.name,
            description: documentType.description,
            fieldCount: consolidated.consolidatedFields.length,
            sampleDocumentCount: processedDocs.length,
            googleDriveFolderId: documentType.googleDriveFolderId,
            folderPath: documentType.folderPath,
            fields: consolidated.consolidatedFields,
          });
        }
      }

      this.logger.log(`\n🎉 Proceso completado: ${results.length} tipo(s) procesado(s)`);
      return results;
    } catch (error) {
      this.logger.error(`❌ Error en proceso de inferencia: ${error.message}`, error.stack);
      throw error;
    }
  }
}


