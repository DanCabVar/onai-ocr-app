import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Mistral } from '@mistralai/mistralai';

export interface OCRResult {
  text: string;
  confidence: number;
  language?: string;
  metadata?: {
    pages?: number;
    [key: string]: any;
  };
}

@Injectable()
export class MistralOCRService {
  private readonly logger = new Logger(MistralOCRService.name);
  private client: Mistral;
  private model: string;
  private visionModel: string;

  constructor(private configService: ConfigService) {
    const apiKey = this.configService.get<string>('MISTRAL_API_KEY');
    if (!apiKey) {
      throw new Error('MISTRAL_API_KEY no está configurada');
    }

    this.client = new Mistral({ apiKey });
    this.model = this.configService.get<string>('MISTRAL_OCR_MODEL') || 'mistral-ocr-latest';
    this.visionModel = this.configService.get<string>('MISTRAL_VISION_MODEL') || 'pixtral-12b-latest';
    
    this.logger.log(`Mistral OCR Service inicializado con modelo OCR: ${this.model}, Vision: ${this.visionModel}`);
  }

  /**
   * Extrae texto de una imagen o PDF usando Mistral OCR
   * @param fileUrl - URL pública del archivo en Google Drive
   * @param mimeType - Tipo MIME del archivo
   * @returns Texto extraído y metadata
   */
  async extractTextFromUrl(
    fileUrl: string,
    mimeType: string,
  ): Promise<OCRResult> {
    try {
      this.logger.log(`Iniciando OCR para archivo tipo: ${mimeType} desde URL`);

      // Determinar si es PDF o imagen según el mimeType
      const isPDF = mimeType === 'application/pdf';

      // Estructura correcta según documentación oficial de Mistral
      // https://docs.mistral.ai/capabilities/document_ai/basic_ocr
      const response = await (this.client as any).ocr.process({
        model: this.model,
        document: isPDF
          ? {
              type: 'document_url',
              documentUrl: fileUrl, // camelCase según docs
            }
          : {
              type: 'image_url',
              imageUrl: fileUrl, // camelCase según docs
            },
        includeImageBase64: true, // camelCase según docs
      });

      // 🔍 DEBUG: Ver estructura completa de la respuesta
      this.logger.log('=== RESPUESTA COMPLETA DE MISTRAL OCR ===');
      this.logger.log(`Tipo de respuesta: ${typeof response}`);
      this.logger.log(`Propiedades disponibles: ${Object.keys(response).join(', ')}`);
      this.logger.log(JSON.stringify(response, null, 2));
      this.logger.log('=========================================');

      // Extraer el texto del response
      // Mistral OCR devuelve el texto en formato markdown dentro de cada página
      let extractedText = '';
      
      if (response.pages && Array.isArray(response.pages)) {
        this.logger.log(`✅ Encontradas ${response.pages.length} páginas`);
        
        // Extraer el texto markdown de cada página
        extractedText = response.pages
          .map((page: any) => {
            // El texto viene en page.markdown (formato Markdown)
            const pageText = page.markdown || page.text || '';
            if (pageText) {
              this.logger.log(`✅ Página ${page.index}: ${pageText.length} caracteres`);
            }
            return pageText;
          })
          .filter((text: string) => text.length > 0)
          .join('\n\n--- PÁGINA ---\n\n');
        
        this.logger.log(`✅ Texto total extraído: ${extractedText.length} caracteres`);
      } else if (response.text) {
        this.logger.log('✅ Texto encontrado en response.text');
        extractedText = response.text;
      } else if (response.markdown) {
        this.logger.log('✅ Texto encontrado en response.markdown');
        extractedText = response.markdown;
      } else if (response.content) {
        this.logger.log('✅ Texto encontrado en response.content');
        extractedText = response.content;
      }

      if (!extractedText || extractedText.length === 0) {
        throw new Error('No se pudo extraer texto del documento');
      }

      this.logger.log(`OCR completado. Texto extraído: ${extractedText.length} caracteres`);

      return {
        text: extractedText,
        confidence: 0.95, // Mistral OCR tiene alta confianza
        metadata: {
          model: this.model,
          processedAt: new Date().toISOString(),
          mimeType: mimeType,
        },
      };
    } catch (error) {
      this.logger.error(`Error en OCR: ${error.message}`, error.stack);
      throw new Error(`Error al procesar OCR: ${error.message}`);
    }
  }

  /**
   * Extrae texto usando Pixtral (modelo multimodal/vision)
   * Mejor para documentos con layouts complejos (tablas, columnas, etc.)
   * @param fileUrl - URL pública del archivo
   * @param mimeType - Tipo MIME del archivo
   * @returns Texto extraído con mejor comprensión del layout
   */
  async extractTextWithVision(
    fileUrl: string,
    mimeType: string,
  ): Promise<OCRResult> {
    try {
      this.logger.log(`Iniciando extracción con Vision (Pixtral) para: ${mimeType}`);

      const prompt = `Analiza este documento cuidadosamente y extrae TODO el texto visible.

**INSTRUCCIONES IMPORTANTES:**
1. Respeta el LAYOUT original (columnas, tablas, secciones)
2. Para cada ETIQUETA (campo), busca su VALOR correspondiente
3. Si ves un campo como "Tu nombre:", busca el valor a su derecha o debajo
4. Extrae TODAS las cantidades monetarias, fechas y números
5. Mantén la estructura del documento (usa markdown si es necesario)

**FORMATO DE SALIDA:**
Para cada par etiqueta-valor, escribe:
[ETIQUETA]: [VALOR]

Por ejemplo:
Tu nombre: John Doe
Email: john@example.com
Monto: $100.00

Extrae TODO el contenido visible del documento.`;

      const response = await this.client.chat.complete({
        model: this.visionModel,
        messages: [
          {
            role: 'user',
            content: [
              {
                type: 'text',
                text: prompt,
              },
              {
                type: 'image_url',
                imageUrl: fileUrl,
              },
            ],
          },
        ],
      });

      // Handle both string and ContentChunk[] response types
      const rawContent = response.choices?.[0]?.message?.content || '';
      const extractedText = typeof rawContent === 'string' 
        ? rawContent 
        : rawContent.map((chunk: any) => chunk.text || '').join('');

      this.logger.log(`✅ Vision OCR completado: ${extractedText.length} caracteres`);

      return {
        text: extractedText,
        confidence: 0.90,
        metadata: {
          model: this.visionModel,
          processedAt: new Date().toISOString(),
          mimeType: mimeType,
          method: 'vision',
        },
      };
    } catch (error) {
      this.logger.error(`Error en Vision OCR: ${error.message}`, error.stack);
      throw new Error(`Error al procesar con Vision: ${error.message}`);
    }
  }

  /**
   * Método inteligente que intenta OCR estándar primero,
   * y si no captura suficientes datos, usa Vision (Pixtral)
   * @param fileUrl - URL pública del archivo
   * @param mimeType - Tipo MIME del archivo
   * @returns Mejor resultado de extracción
   */
  async extractTextSmart(
    fileUrl: string,
    mimeType: string,
  ): Promise<OCRResult> {
    try {
      // Intentar primero con OCR estándar
      this.logger.log('🔍 Intentando OCR estándar...');
      const ocrResult = await this.extractTextFromUrl(fileUrl, mimeType);

      // Verificar si el OCR capturó suficientes datos
      const hasEnoughData = this.validateOCRQuality(ocrResult.text);

      if (hasEnoughData) {
        this.logger.log('✅ OCR estándar capturó suficientes datos');
        return ocrResult;
      }

      // Pixtral Vision solo funciona con imágenes, NO con PDFs
      const isPDF = mimeType === 'application/pdf';
      
      if (isPDF) {
        this.logger.warn('⚠️  OCR estándar con baja calidad, pero es PDF (Vision no soporta PDFs). Usando resultado del OCR estándar.');
        return ocrResult;
      }

      // Si el OCR es insuficiente y es una imagen, usar Vision (Pixtral)
      this.logger.warn('⚠️  OCR estándar insuficiente. Usando Vision (Pixtral)...');
      const visionResult = await this.extractTextWithVision(fileUrl, mimeType);

      return visionResult;
    } catch (error) {
      this.logger.error(`Error en extracción inteligente: ${error.message}`);
      throw error;
    }
  }

  /**
   * Valida si el texto extraído por OCR tiene suficiente calidad
   * Verifica que no solo capture etiquetas sino también valores
   */
  private validateOCRQuality(text: string): boolean {
    // Si el texto es muy corto, probablemente no capturó todo
    if (text.length < 100) {
      return false;
    }

    // Contar líneas que parecen tener valores (contienen números, emails, etc.)
    const lines = text.split('\n');
    const linesWithValues = lines.filter(line => {
      // Buscar patrones que indiquen valores reales
      return (
        /\d{2,}/.test(line) ||           // Números de 2+ dígitos
        /@/.test(line) ||                 // Emails
        /\$\s*\d+/.test(line) ||         // Cantidades monetarias
        /\d{1,2}\/\d{1,2}\/\d{2,4}/.test(line) || // Fechas
        /\d{4}-\d{2}-\d{2}/.test(line)   // Fechas ISO
      );
    });

    // Si menos del 20% de las líneas tienen valores, probablemente solo capturó etiquetas
    const valueRatio = linesWithValues.length / lines.length;
    
    this.logger.log(`📊 Calidad OCR: ${linesWithValues.length}/${lines.length} líneas con valores (${(valueRatio * 100).toFixed(1)}%)`);

    return valueRatio >= 0.2; // Al menos 20% de líneas deben tener valores
  }

  /**
   * Valida si el archivo es compatible con OCR
   */
  isFileTypeSupported(mimeType: string): boolean {
    const supportedTypes = [
      'image/png',
      'image/jpeg',
      'image/jpg',
      'image/webp',
      'application/pdf',
    ];
    return supportedTypes.includes(mimeType);
  }
}

