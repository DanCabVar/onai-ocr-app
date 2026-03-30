import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { HttpModule } from '@nestjs/axios';
import { DocumentsController } from './documents.controller';
import { DocumentsService } from './documents.service';
import { DocumentProcessingService } from './services/document-processing.service';
import { Document } from '../database/entities/document.entity';
import { DocumentType } from '../database/entities/document-type.entity';
import { SubscriptionsModule } from '../subscriptions/subscriptions.module';
import { SubscriptionsService } from '../subscriptions/subscriptions.service';
import { GeminiClassifierService } from '../ai-services/gemini-classifier.service';
import { AuthModule } from '../auth/auth.module';
import { AIServicesModule } from '../ai-services/ai-services.module';
import { StorageModule } from '../storage/storage.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Document, DocumentType]),
    SubscriptionsModule,
    HttpModule,
    AuthModule,
    AIServicesModule,
    StorageModule,
  ],
  controllers: [DocumentsController],
  providers: [DocumentsService, DocumentProcessingService, GeminiClassifierService, SubscriptionsService],
  exports: [DocumentsService, DocumentProcessingService],
})
export class DocumentsModule {}
