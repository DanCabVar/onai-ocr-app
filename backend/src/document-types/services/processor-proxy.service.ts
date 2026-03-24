import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import * as FormData from 'form-data';
import { User } from '../../database/entities/user.entity';
import { CreatedDocumentType } from '../dto/infer-from-samples.dto';

export interface ProcessorProgressEvent {
  step: string;
  progress_pct: number;
  message: string;
}

export interface ProcessorBatchResponse {
  success: boolean;
  message: string;
  created_types: CreatedDocumentType[];
  total_documents_processed: number;
  total_types_created: number;
  errors: string[];
}

@Injectable()
export class ProcessorProxyService {
  private readonly logger = new Logger(ProcessorProxyService.name);
  private readonly processorUrl: string;

  constructor(
    private readonly httpService: HttpService,
    private readonly configService: ConfigService,
  ) {
    this.processorUrl =
      this.configService.get<string>('PROCESSOR_URL') || 'http://processor:8000';
    this.logger.log(`Processor proxy configurado: ${this.processorUrl}`);
  }

  /**
   * Forwards the batch inference request to the Python LangGraph processor.
   * Falls back to the inline NestJS service if the processor is unavailable.
   */
  async inferViaProcessor(
    files: Express.Multer.File[],
    user: User,
    uploadSamples: boolean,
  ): Promise<CreatedDocumentType[]> {
    this.logger.log(
      `Forwarding ${files.length} files to processor at ${this.processorUrl}`,
    );

    // Build multipart form data
    const formData = new FormData();
    formData.append('user_id', String(user.id));
    formData.append('upload_samples', String(uploadSamples));

    for (const file of files) {
      formData.append('files', file.buffer, {
        filename: file.originalname,
        contentType: file.mimetype,
      });
    }

    try {
      const response = await firstValueFrom(
        this.httpService.post<ProcessorBatchResponse>(
          `${this.processorUrl}/process-batch`,
          formData,
          {
            headers: {
              ...formData.getHeaders(),
            },
            timeout: 15 * 60 * 1000, // 15 minutes
            maxContentLength: Infinity,
            maxBodyLength: Infinity,
          },
        ),
      );

      const data = response.data;

      if (data.errors && data.errors.length > 0) {
        this.logger.warn(`Processor returned ${data.errors.length} errors:`);
        data.errors.forEach((e) => this.logger.warn(`  - ${e}`));
      }

      this.logger.log(
        `Processor completed: ${data.total_types_created} types created`,
      );

      // Map snake_case response to camelCase expected by frontend
      return (data.created_types || []).map((t: any) => ({
        id: t.id,
        name: t.name,
        description: t.description,
        fieldCount: t.field_count ?? t.fieldCount,
        sampleDocumentCount: t.sample_document_count ?? t.sampleDocumentCount,
        googleDriveFolderId: t.google_drive_folder_id ?? t.googleDriveFolderId,
        folderPath: t.folder_path ?? t.folderPath,
        fields: (t.fields || []).map((f) => ({
          name: f.name,
          type: f.type,
          label: f.label,
          required: f.required,
          description: f.description,
          frequency: f.frequency,
        })),
      }));
    } catch (error) {
      this.logger.error(
        `Processor request failed: ${error.message}`,
        error.stack,
      );
      throw new Error(
        `Error comunicándose con el procesador: ${error.message}`,
      );
    }
  }

  /**
   * Check if the processor service is available.
   */
  async isProcessorAvailable(): Promise<boolean> {
    try {
      const response = await firstValueFrom(
        this.httpService.get(`${this.processorUrl}/health`, {
          timeout: 5000,
        }),
      );
      return response.data?.status === 'ok';
    } catch {
      return false;
    }
  }
}
