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
  Query,
} from '@nestjs/common';
import { FilesInterceptor } from '@nestjs/platform-express';
import { DocumentTypesService } from './document-types.service';
import { CreateDocumentTypeDto } from './dto/create-document-type.dto';
import { UpdateDocumentTypeDto } from './dto/update-document-type.dto';
import { InferFromSamplesResponseDto } from './dto/infer-from-samples.dto';
import { DocumentTypeInferenceService } from './services/document-type-inference.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { User } from '../database/entities/user.entity';

@Controller('document-types')
@UseGuards(JwtAuthGuard)
export class DocumentTypesController {
  constructor(
    private readonly documentTypesService: DocumentTypesService,
    private readonly inferenceService: DocumentTypeInferenceService,
  ) {}

  @Post()
  create(
    @Body() createDocumentTypeDto: CreateDocumentTypeDto,
    @CurrentUser() user: User,
  ) {
    return this.documentTypesService.create(createDocumentTypeDto, user);
  }

  @Get()
  findAll(@CurrentUser() user: User) {
    return this.documentTypesService.findAll(user);
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
   * Nuevo endpoint: Inferir tipos de documento desde documentos de ejemplo
   * Permite subir hasta 10 archivos para crear tipos automáticamente
   */
  @Post('infer-from-samples')
  @UseInterceptors(
    FilesInterceptor('files', 10, {
      limits: {
        fileSize: 10 * 1024 * 1024, // 10MB por archivo
      },
      fileFilter: (req, file, callback) => {
        // Validar tipos de archivo permitidos
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
  ): Promise<InferFromSamplesResponseDto> {
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

    // Convertir query param a boolean
    const shouldUploadSamples = uploadSamples === 'true';

    try {
      const createdTypes = await this.inferenceService.inferDocumentTypesFromSamples(
        files,
        user,
        shouldUploadSamples,
      );

      return {
        success: true,
        message: `${createdTypes.length} tipo(s) de documento creado(s) exitosamente`,
        createdTypes,
        totalDocumentsProcessed: files.length,
        totalTypesCreated: createdTypes.length,
      };
    } catch (error) {
      throw new BadRequestException(
        `Error al inferir tipos de documento: ${error.message}`,
      );
    }
  }
}

