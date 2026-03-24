import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DocumentTypesService } from './document-types.service';
import { DocumentTypeInferenceService } from './services/document-type-inference.service';
import { ProcessorProxyService } from './services/processor-proxy.service';
import { DocumentTypesController } from './document-types.controller';
import { DocumentType } from '../database/entities/document-type.entity';
import { Document } from '../database/entities/document.entity';
import { AuthModule } from '../auth/auth.module';
import { StorageModule } from '../storage/storage.module';
import { GeminiClassifierService } from '../ai-services/gemini-classifier.service';
import { DocumentsModule } from '../documents/documents.module';

// NOTE: GoogleDriveModule disabled — R2 storage is now used.
// import { GoogleDriveModule } from '../google-drive/google-drive.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([DocumentType, Document]),
    HttpModule.register({
      timeout: 15 * 60 * 1000, // 15 minutes for batch processing
      maxRedirects: 3,
    }),
    AuthModule,
    StorageModule,
    DocumentsModule,
  ],
  controllers: [DocumentTypesController],
  providers: [
    DocumentTypesService,
    DocumentTypeInferenceService,
    ProcessorProxyService,
    GeminiClassifierService,
  ],
  exports: [DocumentTypesService],
})
export class DocumentTypesModule {}
