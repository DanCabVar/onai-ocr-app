import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { HttpModule } from '@nestjs/axios';
import { DocumentsController } from './documents.controller';
import { DocumentsService } from './documents.service';
import { DocumentProcessingService } from './services/document-processing.service';
import { Document } from '../database/entities/document.entity';
import { DocumentType } from '../database/entities/document-type.entity';
import { AuthModule } from '../auth/auth.module';
import { AIServicesModule } from '../ai-services/ai-services.module';
import { StorageModule } from '../storage/storage.module';

// NOTE: GoogleDriveModule disabled — R2 storage is now used.
// import { GoogleDriveModule } from '../google-drive/google-drive.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Document, DocumentType]),
    HttpModule,
    AuthModule,
    AIServicesModule,
    StorageModule,
  ],
  controllers: [DocumentsController],
  providers: [DocumentsService, DocumentProcessingService],
  exports: [DocumentsService, DocumentProcessingService],
})
export class DocumentsModule {}
