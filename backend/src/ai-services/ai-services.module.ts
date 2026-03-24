import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MistralOCRService } from './mistral-ocr.service';
import { GeminiClassifierService } from './gemini-classifier.service';
import { OCRCacheService } from './ocr-cache.service';
import { AIRateLimiterService } from './rate-limiter.service';
import { PipelineMetricsService } from './pipeline-metrics.service';
import { Document } from '../database/entities/document.entity';

@Module({
  imports: [ConfigModule, TypeOrmModule.forFeature([Document])],
  providers: [
    MistralOCRService,
    GeminiClassifierService,
    OCRCacheService,
    AIRateLimiterService,
    PipelineMetricsService,
  ],
  exports: [
    MistralOCRService,
    GeminiClassifierService,
    OCRCacheService,
    AIRateLimiterService,
    PipelineMetricsService,
  ],
})
export class AIServicesModule {}
