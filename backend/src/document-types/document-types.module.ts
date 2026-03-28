import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DocumentTypesService } from './document-types.service';
import { DocumentTypeInferenceService } from './services/document-type-inference.service';
import { InferenceJobStore } from './services/inference-job.store';
import { DocumentTypesController } from './document-types.controller';
import { DocumentType } from '../database/entities/document-type.entity';
import { Document } from '../database/entities/document.entity';
import { AuthModule } from '../auth/auth.module';
import { StorageModule } from '../storage/storage.module';
import { AIServicesModule } from '../ai-services/ai-services.module';
import { DocumentsModule } from '../documents/documents.module';
import { SubscriptionsModule } from '../subscriptions/subscriptions.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([DocumentType, Document]),
    AuthModule,
    StorageModule,
    AIServicesModule,
    DocumentsModule,
    SubscriptionsModule,
  ],
  controllers: [DocumentTypesController],
  providers: [
    DocumentTypesService,
    DocumentTypeInferenceService,
    InferenceJobStore,
  ],
  exports: [DocumentTypesService],
})
export class DocumentTypesModule {}
