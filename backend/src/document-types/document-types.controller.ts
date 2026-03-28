import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  UseGuards,
  ParseIntPipe,
  UseInterceptors,
  UploadedFiles,
  BadRequestException,
  NotFoundException,
  Query,
  Logger,
} from '@nestjs/common';
import { FilesInterceptor } from '@nestjs/platform-express';
import { DocumentTypesService } from './document-types.service';
import { CreateDocumentTypeDto } from './dto/create-document-type.dto';
import { UpdateDocumentTypeDto } from './dto/update-document-type.dto';
import { InferFromSamplesResponseDto } from './dto/infer-from-samples.dto';
import { DocumentTypeInferenceService } from './services/document-type-inference.service';
import { InferenceJobStore } from './services/inference-job.store';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { User } from '../database/entities/user.entity';

@Controller('document-types')
@UseGuards(JwtAuthGuard)
export class DocumentTypesController {
  private readonly logger = new Logger(DocumentTypesController.name);

  constructor(
    private readonly documentTypesService: DocumentTypesService,
    private readonly inferenceService: DocumentTypeInferenceService,
    private readonly jobStore: InferenceJobStore,
  ) {}

  @Post()
  create(
    @Body() createDocumentTypeDto: CreateDocumentTypeDto,
    @CurrentUser() user: User,
  ) {
    return this.documentTypesService.create(createDocumentTypeDto, user);
  }

  @Get()
  findAll(
    @CurrentUser() user: User,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    const pageNum = Math.max(1, parseInt(page || '1', 10) || 1);
    const limitNum = Math.min(100, Math.max(1, parseInt(limit || '20', 10) || 20));
    return this.documentTypesService.findAll(user, pageNum, limitNum);
  }

  @Get('jobs/:jobId')
  getJobStatus(@Param('jobId') jobId: string) {
    const job = this.jobStore.getJob(jobId);
    if (!job) {
      throw new NotFoundException(`Job ${jobId} no encontrado`);
    }
    return job;
  }

  @Get(':id')
  findOne(@Param('id', ParseIntPipe) id: number, @CurrentUser() user: User) {
    return this.documentTypesService.findOne(id, user);
  }

  @Patch(':id')
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() updateDocumentTypeDto: UpdateDocumentTypeDto,
    @CurrentUser() user: User,
  ) {
    return this.documentTypesService.update(id, updateDocumentTypeDto, user);
  }

  @Delete(':id')
  remove(@Param('id', ParseIntPipe) id: number, @CurrentUser() user: User) {
    return this.documentTypesService.remove(id, user);
  }

  /**
   * Endpoint async: Inferir tipos de documento desde documentos de ejemplo.
   * Retorna inmediatamente un jobId. El procesamiento corre en background.
   * Usar GET /document-types/jobs/:jobId para consultar el estado.
   */
  @Post('infer-from-samples')
  @UseInterceptors(
    FilesInterceptor('files', 10, {
      limits: {
        fileSize: 10 * 1024 * 1024, // 10MB por archivo
      },
      fileFilter: (req, file, callback) => {
        const allowedMimeTypes = [
          'application/pdf',
          'image/png',
          'image/jpeg',
          'image/jpg',
        ];
        
        if (allowedMimeTypes.includes(file.mimetype)) {
          callback(null, true);
        } else {
          callback(
            new BadRequestException(
              `Tipo de archivo no permitido: ${file.mimetype}. Solo se permiten PDF, PNG, JPG.`,
            ),
            false,
          );
        }
      },
    }),
  )
  async inferFromSamples(
    @UploadedFiles() files: Express.Multer.File[],
    @CurrentUser() user: User,
    @Query('uploadSamples') uploadSamples?: string,
  ): Promise<{ jobId: string; status: string }> {
    // Validaciones
    if (!files || files.length === 0) {
      throw new BadRequestException('Debes subir al menos 2 archivos');
    }

    if (files.length < 2) {
      throw new BadRequestException('Se requieren al menos 2 documentos para inferir tipos');
    }

    if (files.length > 10) {
      throw new BadRequestException('Máximo 10 archivos permitidos');
    }

    const shouldUploadSamples = uploadSamples === 'true';

    // Create job and return immediately
    const jobId = this.jobStore.createJob();

    // Copy file buffers before the request ends (Express may free them)
    const filesCopy = files.map((f) => ({
      ...f,
      buffer: Buffer.from(f.buffer),
    }));

    // Run processing in background — don't await
    this.runInferenceJob(jobId, filesCopy, user, shouldUploadSamples);

    return { jobId, status: 'processing' };
  }

  /**
   * Runs the inference pipeline in background, updating job state.
   */
  private async runInferenceJob(
    jobId: string,
    files: Express.Multer.File[],
    user: User,
    uploadSamples: boolean,
  ): Promise<void> {
    try {
      const createdTypes = await this.inferenceService.inferDocumentTypesFromSamples(
        files,
        user,
        uploadSamples,
        (step, progress, message) => {
          this.jobStore.updateProgress(jobId, step as any, progress, message);
        },
      );

      const result: InferFromSamplesResponseDto = {
        success: true,
        message: `${createdTypes.length} tipo(s) de documento creado(s) exitosamente`,
        createdTypes,
        totalDocumentsProcessed: files.length,
        totalTypesCreated: createdTypes.length,
      };

      this.jobStore.completeJob(jobId, result);
    } catch (error: any) {
      this.logger.error(`Job ${jobId} failed: ${error.message}`, error.stack);
      this.jobStore.failJob(jobId, error.message || 'Error desconocido');
    }
  }
}
