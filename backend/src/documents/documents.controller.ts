import {
  Controller,
  Post,
  Get,
  Delete,
  Param,
  Body,
  Query,
  UseGuards,
  UseInterceptors,
  UploadedFile,
  UploadedFiles,
  ParseIntPipe,
  BadRequestException,
  PayloadTooLargeException,
} from '@nestjs/common';
import { FileInterceptor, FilesInterceptor } from '@nestjs/platform-express';
import { DocumentsService } from './documents.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { DocLimitGuard } from '../subscriptions/guards/doc-limit.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { User } from '../database/entities/user.entity';

/** Tipos MIME soportados para upload */
const ALLOWED_MIME_TYPES = [
  'application/pdf',
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/webp',
];

@Controller('documents')
@UseGuards(JwtAuthGuard)
export class DocumentsController {
  constructor(private readonly documentsService: DocumentsService) {}

  @Post('upload')
  @UseGuards(DocLimitGuard)
  @UseInterceptors(
    FileInterceptor('file', {
      limits: {
        fileSize: 10 * 1024 * 1024, // 10MB
      },
      fileFilter: (_req, file, callback) => {
        if (!ALLOWED_MIME_TYPES.includes(file.mimetype)) {
          return callback(
            new BadRequestException(
              `Formato no soportado: "${file.mimetype}". Solo se permiten archivos PDF e imágenes (JPEG, PNG, WebP).`,
            ),
            false,
          );
        }
        callback(null, true);
      },
    }),
  )
  async uploadDocument(
    @UploadedFile() file: Express.Multer.File,
    @CurrentUser() user: User,
  ) {
    if (!file) {
      throw new BadRequestException('No se proporcionó ningún archivo.');
    }
    return this.documentsService.uploadFile(file, user);
  }

  @Post('upload-batch')
  @UseGuards(DocLimitGuard)
  @UseInterceptors(
    FilesInterceptor('files', 20, {
      limits: {
        fileSize: 10 * 1024 * 1024, // 10MB per file
      },
      fileFilter: (_req, file, callback) => {
        if (!ALLOWED_MIME_TYPES.includes(file.mimetype)) {
          return callback(
            new BadRequestException(
              `Formato no soportado: "${file.mimetype}". Solo se permiten archivos PDF e imágenes (JPEG, PNG, WebP).`,
            ),
            false,
          );
        }
        callback(null, true);
      },
    }),
  )
  async uploadBatch(
    @UploadedFiles() files: Express.Multer.File[],
    @CurrentUser() user: User,
  ) {
    if (!files || files.length === 0) {
      throw new BadRequestException('No se proporcionaron archivos.');
    }
    return this.documentsService.uploadBatch(files, user);
  }

  @Post('batch-status')
  async getBatchStatus(
    @Body() body: { documentIds: number[] },
    @CurrentUser() user: User,
  ) {
    if (!body.documentIds?.length) {
      throw new BadRequestException('Se requiere documentIds');
    }
    return this.documentsService.getBatchStatus(body.documentIds, user);
  }

  @Post('confirm-type')
  async confirmType(
    @Body() body: { documentId: number; action: 'create_type' | 'assign_type' | 'cancel'; typeName?: string; typeId?: number },
    @CurrentUser() user: User,
  ) {
    if (!body.documentId || !body.action) {
      throw new BadRequestException('Se requiere documentId y action');
    }
    if (!['create_type', 'assign_type', 'cancel'].includes(body.action)) {
      throw new BadRequestException('action debe ser "create_type", "assign_type" o "cancel"');
    }
    return this.documentsService.confirmType(
      body.documentId,
      body.action,
      user,
      body.typeName,
      body.typeId,
    );
  }

  @Get()
  async getDocuments(
    @CurrentUser() user: User,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    const pageNum = Math.max(1, parseInt(page || '1', 10) || 1);
    const limitNum = Math.min(100, Math.max(1, parseInt(limit || '20', 10) || 20));
    return this.documentsService.getDocuments(user, pageNum, limitNum);
  }

  @Get('files')
  async listUserFiles(@CurrentUser() user: User) {
    return this.documentsService.listUserFiles(user);
  }

  @Get(':id/status')
  async getDocumentStatus(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() user: User,
  ) {
    return this.documentsService.getDocumentStatus(id, user);
  }

  @Get(':id')
  async getDocumentById(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() user: User,
  ) {
    return this.documentsService.getDocumentById(id, user);
  }

  @Get(':id/download-url')
  async getDownloadUrl(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() user: User,
  ) {
    const url = await this.documentsService.getDownloadUrl(id, user);
    return { url };
  }

  @Delete(':id')
  async deleteDocument(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() user: User,
  ) {
    return this.documentsService.deleteDocument(id, user);
  }

  @Post('upload-to-inbox')
  @UseGuards(JwtAuthGuard)
  @UseInterceptors(FilesInterceptor('files', 50, { limits: { fileSize: 50 * 1024 * 1024 } }))
  async uploadToInbox(
    @UploadedFiles() files: Express.Multer.File[],
    @CurrentUser() user: User,
  ) {
    if (!files || files.length === 0) throw new BadRequestException('No se recibieron archivos');
    return this.documentsService.uploadToInbox(files, user);
  }
  @Post(':id/reprocess')
  @UseGuards(JwtAuthGuard)
  async reprocessDocument(
    @Param('id') id: string,
    @CurrentUser() user: User,
  ) {
    return this.documentsService.reprocessDocument(Number(id), user);
  }
  @Post('resolve-pending-batch')
  @UseGuards(JwtAuthGuard)
  async resolvePendingBatch(
    @Body() body: { assignments: Array<{ documentId: number; typeName: string; typeId?: number }> },
    @CurrentUser() user: User,
  ) {
    if (!body.assignments?.length) throw new BadRequestException('Se requiere assignments');
    // Process async to avoid Cloudflare 524 timeout on large batches
    const total = body.assignments.length;
    this.documentsService.resolvePendingBatch(body.assignments, user).catch(err => {
      // Log error but don't crash — client already got 202
      console.error('[resolve-pending-batch] background error:', err?.message);
    });
    return { success: true, processing: true, total, message: `Procesando ${total} documento(s) en segundo plano.` };
  }
}