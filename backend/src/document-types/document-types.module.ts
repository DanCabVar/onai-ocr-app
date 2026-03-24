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
import { AIServicesModule } from '../ai-services/ai-services.module';
import { DocumentsModule } from '../documents/documents.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([DocumentType, Document]),
    HttpModule.register({
      timeout: 15 * 60 * 1000, // 15 minutes for batch processing
      maxRedirects: 3,
    }),
    AuthModule,
    StorageModule,
    AIServicesModule, // Shared AI services (rate limiter, metrics, etc.)
    DocumentsModule,
  ],
  controllers: [DocumentTypesController],
  providers: [
    DocumentTypesService,
    DocumentTypeInferenceService,
    ProcessorProxyService,
  ],
  exports: [DocumentTypesService],
})
export class DocumentTypesModule {}
