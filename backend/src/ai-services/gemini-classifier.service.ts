import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { DocumentType, FieldDefinition } from '../database/entities/document-type.entity';

export interface ClassificationResult {
  documentTypeId: number | null;
  documentTypeName: string;
  confidence: number;
  isOthers: boolean;
  inferredType?: string;
  suggestedFields?: FieldDefinition[];
  reasoning?: string;
}

export interface ExtractionResult {
  summary: string;
  fields: Array<{
    name: string;
    type: string;
    label: string;
    required: boolean;
    description: string;
    value: any;
  }>;
}

export interface InferredFieldsResult {
  inferred_type: string;
  summary: string;
  key_fields: Array<{
    name: string;
    type: string;
    label: string;
    required: boolean;
    description: string;
    value: any;
  }>;
}

@Injectable()
export class GeminiClassifierService {
  private readonly logger = new Logger(GeminiClassifierService.name);
  private genAI: GoogleGenerativeAI;
  private model: any;
  private modelName: string;

  constructor(private configService: ConfigService) {
    const apiKey = this.configService.get<string>('GOOGLE_AI_API_KEY');
    if (!apiKey) {
      throw new Error('GOOGLE_AI_API_KEY no está configurada');
    }

    this.genAI = new GoogleGenerativeAI(apiKey);
    this.modelName = this.configService.get<string>('GEMINI_MODEL') || 'gemini-2.5-flash';
    this.model = this.genAI.getGenerativeModel({ model: this.modelName });
    
    this.logger.log(`Gemini Classifier inicializado con modelo: ${this.modelName}`);
  }

  /**
   * Parsea JSON de Gemini de manera robusta (tolera errores comunes)
   */
  private parseGeminiJSON(response: string): any {
    try {
      // Intentar extraer JSON de la respuesta
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error('No se encontró JSON en la respuesta');
      }

      let jsonString = jsonMatch[0];

      // Limpiar posibles problemas comunes:
      // 1. Eliminar comas antes de } o ]
      jsonString = jsonString.replace(/,(\s*[}\]])/g, '$1');
      
      // 2. Eliminar saltos de línea dentro de strings
      jsonString = jsonString.replace(/("\w+":\s*"[^"]*)\n([^"]*")/g, '$1 $2');
      
      // Intentar parsear
      return JSON.parse(jsonString);
    } catch (error) {
      // Si falla, intentar una limpieza más agresiva
      this.logger.warn(`Primera tentativa de parseo falló: ${error.message}. Intentando limpieza agresiva...`);
      
      try {
        const jsonMatch = response.match(/\{[\s\S]*\}/);
        if (!jsonMatch) {
          throw new Error('No se encontró JSON en la respuesta');
        }

        let jsonString = jsonMatch[0];
        
        // Limpieza más agresiva:
        // Eliminar comas al final de objetos/arrays
        jsonString = jsonString.replace(/,(\s*[}\]])/g, '$1');
        
        // Eliminar comentarios (// o /* */)
        jsonString = jsonString.replace(/\/\/.*$/gm, '');
        jsonString = jsonString.replace(/\/\*[\s\S]*?\*\//g, '');
        
        return JSON.parse(jsonString);
      } catch (secondError) {
        this.logger.error(`Parseo de JSON falló después de limpieza: ${secondError.message}`);
        this.logger.error(`Respuesta original (primeros 500 chars): ${response.substring(0, 500)}`);
        throw new Error(`No se pudo parsear JSON de Gemini: ${error.message}`);
      }
    }
  }

  /**
   * Clasifica un documento basándose en los tipos existentes
   */
  async classifyDocument(
    ocrText: string,
    availableTypes: DocumentType[],
  ): Promise<ClassificationResult> {
    try {
      const threshold = this.configService.get<number>('CLASSIFICATION_CONFIDENCE_THRESHOLD') || 0.7;

      // Construir el prompt con los tipos disponibles
      const typesDescription = availableTypes
        .map((type, index) => {
          const fieldsStr = type.fieldSchema.fields
            .map((f) => `${f.label} (${f.type})`)
            .join(', ');
          return `${index + 1}. "${type.name}": ${type.description || 'Sin descripción'}\n   Campos: ${fieldsStr}`;
        })
        .join('\n\n');

      const prompt = `Eres un experto clasificador de documentos. Analiza el siguiente texto extraído de un documento y determina a qué tipo de documento pertenece.

**TIPOS DE DOCUMENTO DISPONIBLES:**
${typesDescription}

**TEXTO DEL DOCUMENTO:**
${ocrText.substring(0, 5000)} ${ocrText.length > 5000 ? '...(truncado)' : ''}

**INSTRUCCIONES:**
1. Analiza el contenido del documento
2. Compara con los tipos disponibles
3. Si el documento coincide con algún tipo (con confianza >= ${threshold}), responde con ese tipo
4. Si NO coincide con ningún tipo o la confianza es baja, sugiérele al usuario crear un nuevo tipo

**FORMATO DE RESPUESTA (JSON):**
{
  "matchedTypeId": number | null,
  "matchedTypeName": string | "Otros",
  "confidence": number (0-1),
  "isOthers": boolean,
  "inferredType": string (solo si isOthers=true, sugiere un nombre para el nuevo tipo),
  "suggestedFields": [ (solo si isOthers=true)
    {
      "name": "nombre_campo",
      "type": "string|number|date|boolean|array",
      "label": "Etiqueta Campo",
      "required": boolean,
      "description": "Descripción del campo"
    }
  ],
  "reasoning": "Breve explicación de tu decisión"
}

Responde SOLO con el JSON, sin texto adicional.`;

      const result = await this.model.generateContent(prompt);
      const response = result.response.text();

      // Usar parser robusto
      const classification = this.parseGeminiJSON(response);

      this.logger.log(`Clasificación completada: ${classification.matchedTypeName} (confianza: ${classification.confidence})`);

      return {
        documentTypeId: classification.matchedTypeId,
        documentTypeName: classification.matchedTypeName,
        confidence: classification.confidence,
        isOthers: classification.isOthers || classification.confidence < threshold,
        inferredType: classification.inferredType,
        suggestedFields: classification.suggestedFields,
        reasoning: classification.reasoning,
      };
    } catch (error) {
      this.logger.error(`Error en clasificación: ${error.message}`, error.stack);
      throw new Error(`Error al clasificar documento: ${error.message}`);
    }
  }

  /**
   * Extrae datos estructurados usando VISIÓN directa (PDF/Imagen)
   * Gemini "ve" el documento completo, entiende layouts complejos
   */
  async extractDataWithVision(
    fileBuffer: Buffer,
    mimeType: string,
    documentType: DocumentType,
  ): Promise<ExtractionResult> {
    try {
      const fields = documentType.fieldSchema.fields;
      const fieldsDescription = fields
        .map((f) => `- ${f.label} (${f.name}): tipo ${f.type}, ${f.required ? 'obligatorio' : 'opcional'}${f.description ? ` - ${f.description}` : ''}`)
        .join('\n');

      const prompt = `Eres un experto en extracción de datos de documentos. Analiza esta imagen/PDF y extrae:
1. Un RESUMEN breve del documento EN ESPAÑOL (1-2 líneas)
2. Los valores de los campos solicitados

**TIPO DE DOCUMENTO:** ${documentType.name}
**DESCRIPCIÓN:** ${documentType.description || 'Sin descripción'}

**CAMPOS A EXTRAER:**
${fieldsDescription}

**INSTRUCCIONES:**
1. Genera un resumen conciso del contenido del documento EN ESPAÑOL
2. Extrae SOLO los campos solicitados
3. Respeta los tipos de datos especificados
4. Si un campo no se encuentra en el documento, usa null como valor
5. Para fechas, usa formato ISO 8601 (YYYY-MM-DD)
6. Para números, extrae solo el valor numérico
7. Sé preciso y extrae la información exacta del documento

**IMPORTANTE - Observa visualmente el documento:**
- Analiza el LAYOUT completo (columnas, tablas, secciones)
- Si ves campos con "Etiqueta:" seguido de un valor, extrae el valor
- Busca valores en posiciones cercanas a las etiquetas (derecha, abajo)
- Ignora etiquetas decorativas, solo captura datos reales
- Para montos: extrae el número sin símbolos ($, CLP, etc.)

**FORMATO DE RESPUESTA (JSON):**
{
  "summary": "Breve resumen del documento EN ESPAÑOL (1-2 líneas)",
  "fields": [
    ${fields.map((f) => `{
      "name": "${f.name}",
      "type": "${f.type}",
      "label": "${f.label}",
      "required": ${f.required},
      "description": "${f.description || 'Sin descripción'}",
      "value": ${f.type === 'string' ? '"valor extraído"' : f.type === 'number' ? 'número' : f.type === 'date' ? '"YYYY-MM-DD"' : f.type === 'boolean' ? 'true|false' : 'null'}
    }`).join(',\n    ')}
  ]
}

**IMPORTANTE:** El resumen DEBE estar en español, independientemente del idioma del documento original.

Responde SOLO con el JSON, sin texto adicional ni explicaciones.`;

      // Convertir el buffer a base64
      const base64Data = fileBuffer.toString('base64');

      const result = await this.model.generateContent([
        {
          inlineData: {
            data: base64Data,
            mimeType: mimeType,
          },
        },
        { text: prompt },
      ]);

      const response = result.response.text();

      // Usar parser robusto
      const extractedData = this.parseGeminiJSON(response);

      this.logger.log(`✅ Extracción con VISIÓN completada: ${extractedData.fields?.length || 0} campos extraídos`);

      return {
        summary: extractedData.summary || 'Sin resumen disponible',
        fields: extractedData.fields || [],
      };
    } catch (error) {
      this.logger.error(`Error en extracción con visión: ${error.message}`, error.stack);
      throw new Error(`Error al extraer datos con visión: ${error.message}`);
    }
  }

  /**
   * Extrae datos estructurados según el schema del tipo de documento (basado en texto OCR)
   */
  async extractData(
    ocrText: string,
    documentType: DocumentType,
  ): Promise<ExtractionResult> {
    try {
      const fields = documentType.fieldSchema.fields;
      const fieldsDescription = fields
        .map((f) => `- ${f.label} (${f.name}): tipo ${f.type}, ${f.required ? 'obligatorio' : 'opcional'}${f.description ? ` - ${f.description}` : ''}`)
        .join('\n');

      const prompt = `Eres un experto en extracción de datos de documentos. Analiza el siguiente texto y extrae:
1. Un RESUMEN breve del documento (1-2 líneas) EN ESPAÑOL
2. Los valores de los campos solicitados

**TIPO DE DOCUMENTO:** ${documentType.name}
**DESCRIPCIÓN:** ${documentType.description || 'Sin descripción'}

**CAMPOS A EXTRAER:**
${fieldsDescription}

**TEXTO DEL DOCUMENTO:**
${ocrText}

**INSTRUCCIONES:**
1. Genera un resumen conciso del contenido del documento EN ESPAÑOL
2. Extrae SOLO los campos solicitados
3. Respeta los tipos de datos especificados
4. Si un campo no se encuentra en el texto, usa null como valor
5. Para fechas, usa formato ISO 8601 (YYYY-MM-DD)
6. Para números, extrae solo el valor numérico
7. Sé preciso y extrae la información exacta del documento

**IMPORTANTE - LAYOUTS DE COLUMNAS:**
- Si ves etiquetas como "Tu nombre:", "Destinatario:", "Monto enviado:" seguidas de valores
- Busca el valor a la DERECHA o DEBAJO de la etiqueta
- Ignora las etiquetas y solo captura el valor real
- Ejemplo: Si ves "Tu nombre     Collectyred SpA", extrae "Collectyred SpA"
- Ejemplo: Si ves "Monto enviado    $ 92.045 CLP", extrae "92045" (sin símbolos)
- Busca patrones como "Etiqueta: Valor" o "Etiqueta    Valor"

**FORMATO DE RESPUESTA (JSON):**
{
  "summary": "Breve resumen del documento EN ESPAÑOL (1-2 líneas)",
  "fields": [
    ${fields.map((f) => `{
      "name": "${f.name}",
      "type": "${f.type}",
      "label": "${f.label}",
      "required": ${f.required},
      "description": "${f.description || 'Sin descripción'}",
      "value": ${f.type === 'string' ? '"valor extraído"' : f.type === 'number' ? 'número' : f.type === 'date' ? '"YYYY-MM-DD"' : f.type === 'boolean' ? 'true|false' : 'null'}
    }`).join(',\n    ')}
  ]
}

Responde SOLO con el JSON, sin texto adicional ni explicaciones.`;

      const result = await this.model.generateContent(prompt);
      const response = result.response.text();

      // Usar parser robusto
      const extractedData = this.parseGeminiJSON(response);

      this.logger.log(`Extracción completada: ${extractedData.fields?.length || 0} campos extraídos`);

      return {
        summary: extractedData.summary || 'Sin resumen disponible',
        fields: extractedData.fields || [],
      };
    } catch (error) {
      this.logger.error(`Error en extracción: ${error.message}`, error.stack);
      throw new Error(`Error al extraer datos: ${error.message}`);
    }
  }

  /**
   * Infiere campos clave usando VISIÓN directa para documentos no clasificados
   */
  async inferFieldsForUnclassifiedWithVision(
    fileBuffer: Buffer,
    mimeType: string,
  ): Promise<InferredFieldsResult> {
    try {
      this.logger.log(`Iniciando inferencia con VISIÓN para documento no clasificado`);

      const prompt = `Eres un experto analista de documentos. Analiza esta imagen/PDF y determina:
1. QUÉ TIPO de documento es (ej: "Certificado Médico", "Recibo", "Contrato", etc.)
2. Un RESUMEN breve del documento EN ESPAÑOL (1-2 líneas)
3. Los CAMPOS CLAVE más importantes que se encuentran en el documento

**INSTRUCCIONES:**
1. Identifica el tipo de documento basándote en su contenido y estructura visual
2. Extrae entre 3 y 20 campos clave (los más importantes del documento)
3. Para cada campo, proporciona:
   - **name**: Nombre técnico del campo en snake_case (ej: "institution_name")
   - **type**: Tipo de dato (string, number, date, email, phone, currency, boolean, array)
   - **label**: Etiqueta legible en español (ej: "Nombre de la Institución")
   - **required**: Si el campo es fundamental para el documento (true/false)
   - **description**: Breve descripción del propósito del campo (máx 100 caracteres)
   - **value**: Valor real extraído del documento

**IMPORTANTE - Observa visualmente el documento:**
- Analiza el LAYOUT completo (columnas, tablas, secciones)
- Si ves campos con "Etiqueta:" seguido de un valor, extrae el valor
- Busca valores en posiciones cercanas a las etiquetas (derecha, abajo)
- Ignora etiquetas decorativas, solo captura datos reales
- Para montos: extrae el número completo con formato (ej: "92.045 CLP" o "92045")

**FORMATO DE RESPUESTA (JSON):**
{
  "inferred_type": "Nombre del tipo de documento identificado",
  "summary": "Breve resumen del contenido del documento EN ESPAÑOL (1-2 líneas)",
  "key_fields": [
    {
      "name": "nombre_campo",
      "type": "string|number|date|email|phone|currency|boolean|array",
      "label": "Etiqueta del Campo",
      "required": true,
      "description": "Propósito o contexto del campo",
      "value": "valor extraído del documento"
    }
  ]
}

**IMPORTANTE:** El resumen DEBE estar en español, independientemente del idioma del documento original.

Responde SOLO con el JSON, sin texto adicional.`;

      // Convertir el buffer a base64
      const base64Data = fileBuffer.toString('base64');

      const result = await this.model.generateContent([
        {
          inlineData: {
            data: base64Data,
            mimeType: mimeType,
          },
        },
        { text: prompt },
      ]);

      const response = result.response.text();

      // Usar parser robusto
      const inferredData = this.parseGeminiJSON(response);

      this.logger.log(`✅ Inferencia con VISIÓN completada: ${inferredData.inferred_type} (${inferredData.key_fields.length} campos)`);

      return {
        inferred_type: inferredData.inferred_type || 'Documento Desconocido',
        summary: inferredData.summary || 'Sin resumen disponible',
        key_fields: inferredData.key_fields || [],
      };
    } catch (error) {
      this.logger.error(`Error en inferencia con visión: ${error.message}`, error.stack);
      
      // Retornar valores por defecto en caso de error
      return {
        inferred_type: 'Documento Sin Clasificar',
        summary: 'No se pudo analizar el contenido del documento',
        key_fields: [],
      };
    }
  }

  /**
   * Infiere campos clave para documentos no clasificados ("Otros Documentos") - Basado en OCR
   * @param ocrText - Texto extraído por OCR
   * @returns Tipo inferido, resumen y campos clave encontrados
   */
  async inferFieldsForUnclassified(
    ocrText: string,
  ): Promise<InferredFieldsResult> {
    try {
      const prompt = `Eres un experto analista de documentos. Analiza el siguiente texto y determina:
1. QUÉ TIPO de documento es (ej: "Certificado Médico", "Recibo", "Contrato", etc.)
2. Un RESUMEN breve del documento (1-2 líneas)
3. Los CAMPOS CLAVE más importantes que se encuentran en el documento

**TEXTO DEL DOCUMENTO:**
${ocrText.substring(0, 8000)} ${ocrText.length > 8000 ? '...(truncado)' : ''}

**INSTRUCCIONES:**
1. Identifica el tipo de documento basándote en su contenido y estructura
2. Extrae entre 3 y 20 campos clave (los más importantes del documento)
3. Para cada campo, proporciona:
   - **name**: Nombre técnico del campo en snake_case (ej: "institution_name")
   - **type**: Tipo de dato (string, number, date, email, phone, currency, boolean, array)
   - **label**: Etiqueta legible en español (ej: "Nombre de la Institución")
   - **required**: Si el campo es fundamental para el documento (true/false)
   - **description**: Breve descripción del propósito del campo (máx 100 caracteres)
   - **value**: Valor real extraído del documento

**IMPORTANTE - LAYOUTS DE COLUMNAS:**
- Si ves etiquetas como "Tu nombre:", "Destinatario:", "Monto enviado:" seguidas de valores
- Busca el valor a la DERECHA o DEBAJO de la etiqueta
- Ignora las etiquetas y solo captura el valor real
- Ejemplo: Si ves "Tu nombre     Collectyred SpA", el valor es "Collectyred SpA"
- Ejemplo: Si ves "Monto enviado    $ 92.045 CLP", el valor es "92045" o "92.045 CLP"
- Busca patrones como "Etiqueta: Valor" o "Etiqueta    Valor"

**FORMATO DE RESPUESTA (JSON):**
{
  "inferred_type": "Nombre del tipo de documento identificado",
  "summary": "Breve resumen del contenido del documento (1-2 líneas)",
  "key_fields": [
    {
      "name": "nombre_campo",
      "type": "string|number|date|email|phone|currency|boolean|array",
      "label": "Etiqueta del Campo",
      "required": true,
      "description": "Propósito o contexto del campo",
      "value": "valor extraído del documento"
    }
  ]
}

Responde SOLO con el JSON, sin texto adicional.`;

      const result = await this.model.generateContent(prompt);
      const response = result.response.text();

      // Usar parser robusto
      const inferredData = this.parseGeminiJSON(response);

      this.logger.log(`Campos inferidos para documento no clasificado: ${inferredData.inferred_type} (${inferredData.key_fields.length} campos)`);

      return {
        inferred_type: inferredData.inferred_type || 'Documento Desconocido',
        summary: inferredData.summary || 'Sin resumen disponible',
        key_fields: inferredData.key_fields || [],
      };
    } catch (error) {
      this.logger.error(`Error en inferencia de campos: ${error.message}`, error.stack);
      
      // Retornar valores por defecto en caso de error
      return {
        inferred_type: 'Documento Sin Clasificar',
        summary: 'No se pudo analizar el contenido del documento',
        key_fields: [],
      };
    }
  }
}

