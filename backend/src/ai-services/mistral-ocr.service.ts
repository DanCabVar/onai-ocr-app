import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Mistral } from '@mistralai/mistralai';
import { AIRateLimiterService } from './rate-limiter.service';
import { withRetry } from './retry.util';

export interface OCRResult {
  text: string;
  confidence: number;
  language?: string;
  metadata?: {
    pages?: number;
    method?: string;
    [key: string]: any;
  };
}

@Injectable()
export class MistralOCRService {
  private readonly logger = new Logger(MistralOCRService.name);
  private client: Mistral;
  private model: string;
  private visionModel: string;

  constructor(
    private configService: ConfigService,
    private rateLimiter: AIRateLimiterService,
  ) {
    const apiKey = this.configService.get<string>('MISTRAL_API_KEY');
    if (!apiKey) {
      throw new Error('MISTRAL_API_KEY no está configurada');
    }

    this.client = new Mistral({ apiKey });
    this.model = this.configService.get<string>('MISTRAL_OCR_MODEL') || 'mistral-ocr-latest';
    this.visionModel = this.configService.get<string>('MISTRAL_VISION_MODEL') || 'pixtral-12b-latest';
    
    this.logger.log(`Mistral OCR inicializado — OCR: ${this.model}, Vision: ${this.visionModel}`);
  }

  /**
   * Extract text from image/PDF via Mistral OCR API.
   * Includes rate limiting and automatic retry on transient failures.
   */
  async extractTextFromUrl(fileUrl: string, mimeType: string): Promise<OCRResult> {
    this.logger.log(`OCR iniciando para tipo: ${mimeType}`);

    return withRetry(
      async () => {
        await this.rateLimiter.acquire('mistral');

        const isPDF = mimeType === 'application/pdf';

        const response = await (this.client as any).ocr.process({
          model: this.model,
          document: isPDF
            ? { type: 'document_url', documentUrl: fileUrl }
            : { type: 'image_url', imageUrl: fileUrl },
          includeImageBase64: false, // Don't need base64 — saves bandwidth
        });

        let extractedText = '';
        let pageCount = 0;

        if (response.pages && Array.isArray(response.pages)) {
          pageCount = response.pages.length;
          extractedText = response.pages
            .map((page: any) => page.markdown || page.text || '')
            .filter((text: string) => text.length > 0)
            .join('\n\n--- PÁGINA ---\n\n');
        } else {
          extractedText = response.text || response.markdown || response.content || '';
        }

        if (!extractedText || extractedText.length === 0) {
          throw new Error('Mistral OCR: No se pudo extraer texto del documento. El archivo puede estar vacío, corrupto o protegido con contraseña.');
        }

        this.logger.log(`✅ OCR: ${extractedText.length} chars, ${pageCount} páginas`);

        return {
          text: extractedText,
          confidence: 0.95,
          metadata: {
            model: this.model,
            method: 'standard',
            pages: pageCount,
            processedAt: new Date().toISOString(),
            mimeType,
          },
        };
      },
      { maxRetries: 3, label: 'Mistral OCR' },
    );
  }

  /**
   * Extract text using Pixtral Vision (for complex layouts).
   * Only works with images, NOT PDFs.
   * Optimized prompt — shorter, same quality.
   */
  async extractTextWithVision(fileUrl: string, mimeType: string): Promise<OCRResult> {
    this.logger.log(`Vision OCR para: ${mimeType}`);

    return withRetry(
      async () => {
        await this.rateLimiter.acquire('mistral');

        // Optimized prompt: ~40% fewer tokens than original
        const prompt = `Extract ALL visible text from this document. Preserve layout (columns, tables). For label-value pairs, format as "[LABEL]: [VALUE]". Include all amounts, dates, numbers. Use markdown for structure.`;

        const response = await this.client.chat.complete({
          model: this.visionModel,
          messages: [
            {
              role: 'user',
              content: [
                { type: 'text', text: prompt },
                { type: 'image_url', imageUrl: fileUrl },
              ],
            },
          ],
        });

        const rawContent = response.choices?.[0]?.message?.content || '';
        const extractedText =
          typeof rawContent === 'string'
            ? rawContent
            : rawContent.map((chunk: any) => chunk.text || '').join('');

        this.logger.log(`✅ Vision OCR: ${extractedText.length} chars`);

        return {
          text: extractedText,
          confidence: 0.90,
          metadata: {
            model: this.visionModel,
            method: 'vision',
            processedAt: new Date().toISOString(),
            mimeType,
          },
        };
      },
      { maxRetries: 2, label: 'Pixtral Vision' },
    );
  }

  /**
   * Smart extraction: tries standard OCR first, falls back to Vision if quality is low.
   * Vision only works with images (not PDFs).
   */
  async extractTextSmart(fileUrl: string, mimeType: string): Promise<OCRResult> {
    // Standard OCR first
    this.logger.log('🔍 OCR estándar...');
    const ocrResult = await this.extractTextFromUrl(fileUrl, mimeType);

    if (this.validateOCRQuality(ocrResult.text)) {
      this.logger.log('✅ OCR estándar suficiente');
      return ocrResult;
    }

    // Vision fallback — only for images
    if (mimeType === 'application/pdf') {
      this.logger.warn('⚠️ OCR baja calidad, pero PDF no soporta Vision. Usando resultado OCR.');
      return ocrResult;
    }

    this.logger.warn('⚠️ OCR insuficiente, usando Vision...');
    return this.extractTextWithVision(fileUrl, mimeType);
  }

  /**
   * Validate OCR output quality: checks if values (not just labels) were captured.
   */
  private validateOCRQuality(text: string): boolean {
    if (text.length < 100) return false;

    const lines = text.split('\n');
    const linesWithValues = lines.filter((line) =>
      /\d{2,}|@|\$\s*\d+|\d{1,2}\/\d{1,2}\/\d{2,4}|\d{4}-\d{2}-\d{2}/.test(line),
    );

    const ratio = linesWithValues.length / lines.length;
    this.logger.log(`📊 OCR calidad: ${(ratio * 100).toFixed(1)}% líneas con valores`);

    return ratio >= 0.2;
  }

  isFileTypeSupported(mimeType: string): boolean {
    return ['image/png', 'image/jpeg', 'image/jpg', 'image/webp', 'application/pdf'].includes(mimeType);
  }
}
