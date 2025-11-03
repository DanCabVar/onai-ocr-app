import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { MistralOCRService } from './mistral-ocr.service';
import { GeminiClassifierService } from './gemini-classifier.service';

@Module({
  imports: [ConfigModule],
  providers: [MistralOCRService, GeminiClassifierService],
  exports: [MistralOCRService, GeminiClassifierService],
})
export class AIServicesModule {}

