import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { DocumentType, FieldDefinition } from '../database/entities/document-type.entity';
import { AIRateLimiterService } from './rate-limiter.service';
import { withRetry } from './retry.util';

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

  constructor(
    private configService: ConfigService,
    private rateLimiter: AIRateLimiterService,
  ) {
    const apiKey = this.configService.get<string>('GOOGLE_AI_API_KEY');
    if (!apiKey) {
      throw new Error('GOOGLE_AI_API_KEY no está configurada');
    }

    this.genAI = new GoogleGenerativeAI(apiKey);
    this.modelName = this.configService.get<string>('GEMINI_MODEL') || 'gemini-2.5-flash';
    this.model = this.genAI.getGenerativeModel({ model: this.modelName });
    
    this.logger.log(`Gemini Classifier inicializado: ${this.modelName}`);
  }

  /**
   * Robust JSON parser — handles common Gemini quirks (trailing commas, comments, markdown fences).
   */
  private parseGeminiJSON(response: string): any {
    try {
      // Strip markdown code fences if present
      let cleaned = response.replace(/^```(?:json)?\s*\n?/gm, '').replace(/\n?```\s*$/gm, '');

      const jsonMatch = cleaned.match(/\{[\s\S]*\}/);
      if (!jsonMatch) throw new Error('No JSON found in response');

      let json = jsonMatch[0];
      // Fix trailing commas
      json = json.replace(/,(\s*[}\]])/g, '$1');
      // Remove comments
      json = json.replace(/\/\/.*$/gm, '');
      json = json.replace(/\/\*[\s\S]*?\*\//g, '');

      return JSON.parse(json);
    } catch (error) {
      this.logger.error(`JSON parse failed: ${error.message}`);
      this.logger.error(`Response (first 300 chars): ${response.substring(0, 300)}`);
      throw new Error(`Failed to parse Gemini JSON: ${error.message}`);
    }
  }

  /**
   * Classify a document against available types.
   * 
   * OPTIMIZED: Shorter prompt (~50% fewer tokens), same accuracy.
   * Uses rate limiting and retry logic.
   */
  async classifyDocument(
    ocrText: string,
    availableTypes: DocumentType[],
  ): Promise<ClassificationResult> {
    const threshold =
      this.configService.get<number>('CLASSIFICATION_CONFIDENCE_THRESHOLD') || 0.7;

    // Build compact type descriptions
    const typesDesc = availableTypes
      .map((t, i) => {
        const fields = t.fieldSchema.fields.map((f) => f.label).join(', ');
        return `${i + 1}. "${t.name}": ${t.description || '-'} | Campos: ${fields}`;
      })
      .join('\n');

    // Truncate OCR text — classification doesn't need all content
    const truncatedText = ocrText.substring(0, 3000);

    const prompt = `Classify this document. Available types:
${typesDesc}

Document text:
${truncatedText}${ocrText.length > 3000 ? '...(truncated)' : ''}

Return JSON:
{"matchedTypeId":number|null,"matchedTypeName":"string","confidence":0-1,"isOthers":boolean,"inferredType":"string if others","suggestedFields":[{"name":"snake_case","type":"string|number|date|boolean|array","label":"Label","required":bool,"description":"desc"}],"reasoning":"brief"}

If confidence < ${threshold}, set isOthers=true. JSON only, no other text.`;

    return withRetry(
      async () => {
        await this.rateLimiter.acquire('gemini');

        const result = await this.model.generateContent(prompt);
        const response = result.response.text();
        const classification = this.parseGeminiJSON(response);

        this.logger.log(
          `Clasificación: ${classification.matchedTypeName} (${(classification.confidence * 100).toFixed(0)}%)`,
        );

        return {
          documentTypeId: classification.matchedTypeId,
          documentTypeName: classification.matchedTypeName,
          confidence: classification.confidence,
          isOthers: classification.isOthers || classification.confidence < threshold,
          inferredType: classification.inferredType,
          suggestedFields: classification.suggestedFields,
          reasoning: classification.reasoning,
        };
      },
      { maxRetries: 3, label: 'Gemini classify' },
    );
  }

  /**
   * Extract structured data using Vision (PDF/Image).
   * 
   * OPTIMIZED: Compact prompt, same extraction quality.
   */
  async extractDataWithVision(
    fileBuffer: Buffer,
    mimeType: string,
    documentType: DocumentType,
  ): Promise<ExtractionResult> {
    const fields = documentType.fieldSchema.fields;
    const fieldsDesc = fields
      .map((f) => `- ${f.name} (${f.type}${f.required ? ', req' : ''}): ${f.label}`)
      .join('\n');

    const prompt = `Extract data from this "${documentType.name}" document.

Fields to extract:
${fieldsDesc}

Return JSON:
{"summary":"1-2 line summary in Spanish","fields":[${fields.map((f) => `{"name":"${f.name}","type":"${f.type}","label":"${f.label}","required":${f.required},"description":"${f.description || ''}","value":...}`).join(',')}]}

Rules: dates=YYYY-MM-DD, numbers=numeric only, null if not found. Spanish summary. JSON only.`;

    return withRetry(
      async () => {
        await this.rateLimiter.acquire('gemini');

        const base64Data = fileBuffer.toString('base64');
        const result = await this.model.generateContent([
          { inlineData: { data: base64Data, mimeType } },
          { text: prompt },
        ]);

        const response = result.response.text();
        const extracted = this.parseGeminiJSON(response);

        this.logger.log(`✅ Extracción Vision: ${extracted.fields?.length || 0} campos`);

        return {
          summary: extracted.summary || 'Sin resumen disponible',
          fields: extracted.fields || [],
        };
      },
      { maxRetries: 3, label: 'Gemini extract-vision' },
    );
  }

  /**
   * Extract structured data from OCR text (text-based, no vision).
   * Used when vision is not available or not needed.
   */
  async extractData(
    ocrText: string,
    documentType: DocumentType,
  ): Promise<ExtractionResult> {
    const fields = documentType.fieldSchema.fields;
    const fieldsDesc = fields
      .map((f) => `- ${f.name} (${f.type}${f.required ? ', req' : ''}): ${f.label}`)
      .join('\n');

    const prompt = `Extract data from this "${documentType.name}" document text.

Fields:
${fieldsDesc}

Text:
${ocrText}

Return JSON: {"summary":"1-2 lines in Spanish","fields":[${fields.map((f) => `{"name":"${f.name}","type":"${f.type}","label":"${f.label}","required":${f.required},"description":"${f.description || ''}","value":...}`).join(',')}]}

For label-value pairs like "Name: John", extract "John". Dates=YYYY-MM-DD, numbers=numeric. null if not found. JSON only.`;

    return withRetry(
      async () => {
        await this.rateLimiter.acquire('gemini');

        const result = await this.model.generateContent(prompt);
        const response = result.response.text();
        const extracted = this.parseGeminiJSON(response);

        this.logger.log(`✅ Extracción texto: ${extracted.fields?.length || 0} campos`);

        return {
          summary: extracted.summary || 'Sin resumen disponible',
          fields: extracted.fields || [],
        };
      },
      { maxRetries: 3, label: 'Gemini extract-text' },
    );
  }

  /**
   * Infer fields for unclassified documents using Vision.
   * 
   * OPTIMIZED: Single compact prompt instead of verbose instructions.
   */
  async inferFieldsForUnclassifiedWithVision(
    fileBuffer: Buffer,
    mimeType: string,
  ): Promise<InferredFieldsResult> {
    try {
      return await withRetry(
        async () => {
          await this.rateLimiter.acquire('gemini');

          const prompt = `Analyze this document image/PDF. Determine:
1. Document type (e.g. "Certificado Médico", "Factura", "Contrato")
2. Brief summary in Spanish (1-2 lines)
3. Key fields (3-20, most important)

Return JSON:
{"inferred_type":"type name","summary":"summary in Spanish","key_fields":[{"name":"snake_case","type":"string|number|date|email|phone|currency|boolean|array","label":"Spanish Label","required":bool,"description":"brief desc","value":"extracted value"}]}

Observe layout carefully: extract values next to labels. For amounts, include full number. JSON only.`;

          const base64Data = fileBuffer.toString('base64');
          const result = await this.model.generateContent([
            { inlineData: { data: base64Data, mimeType } },
            { text: prompt },
          ]);

          const response = result.response.text();
          const inferred = this.parseGeminiJSON(response);

          this.logger.log(
            `✅ Inferencia Vision: ${inferred.inferred_type} (${inferred.key_fields?.length || 0} campos)`,
          );

          return {
            inferred_type: inferred.inferred_type || 'Documento Desconocido',
            summary: inferred.summary || 'Sin resumen disponible',
            key_fields: inferred.key_fields || [],
          };
        },
        { maxRetries: 2, label: 'Gemini infer-vision' },
      );
    } catch (error) {
      this.logger.error(`Error en inferencia vision: ${error.message}`, error.stack);
      return {
        inferred_type: 'Documento Sin Clasificar',
        summary: 'No se pudo analizar el contenido del documento',
        key_fields: [],
      };
    }
  }

  /**
   * Infer fields for unclassified documents from OCR text.
   */
  async inferFieldsForUnclassified(ocrText: string): Promise<InferredFieldsResult> {
    try {
      return await withRetry(
        async () => {
          await this.rateLimiter.acquire('gemini');

          const truncated = ocrText.substring(0, 6000);
          const prompt = `Analyze this document text. Determine type, summary (Spanish), and key fields (3-20).

Text:
${truncated}${ocrText.length > 6000 ? '...(truncated)' : ''}

Return JSON:
{"inferred_type":"type name","summary":"Spanish summary","key_fields":[{"name":"snake_case","type":"string|number|date|email|phone|currency|boolean|array","label":"Spanish Label","required":bool,"description":"brief","value":"extracted"}]}

JSON only.`;

          const result = await this.model.generateContent(prompt);
          const response = result.response.text();
          const inferred = this.parseGeminiJSON(response);

          this.logger.log(
            `✅ Inferencia texto: ${inferred.inferred_type} (${inferred.key_fields?.length || 0} campos)`,
          );

          return {
            inferred_type: inferred.inferred_type || 'Documento Desconocido',
            summary: inferred.summary || 'Sin resumen disponible',
            key_fields: inferred.key_fields || [],
          };
        },
        { maxRetries: 2, label: 'Gemini infer-text' },
      );
    } catch (error) {
      this.logger.error(`Error en inferencia texto: ${error.message}`, error.stack);
      return {
        inferred_type: 'Documento Sin Clasificar',
        summary: 'No se pudo analizar el contenido del documento',
        key_fields: [],
      };
    }
  }
}
