import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DocumentTypesService } from './document-types.service';
import { DocumentTypeInferenceService } from './services/document-type-inference.service';
import { DocumentTypesController } from './document-types.controller';
import { DocumentType } from '../database/entities/document-type.entity';
import { Document } from '../database/entities/document.entity';
import { AuthModule } from '../auth/auth.module';
import { GoogleDriveModule } from '../google-drive/google-drive.module';
import { GeminiClassifierService } from '../ai-services/gemini-classifier.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([DocumentType, Document]),
    AuthModule,
    GoogleDriveModule,
  ],
  controllers: [DocumentTypesController],
  providers: [
    DocumentTypesService,
    DocumentTypeInferenceService,
    GeminiClassifierService,
  ],
  exports: [DocumentTypesService],
})
export class DocumentTypesModule {}

