import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ChatController } from './chat.controller';
import { ChatService } from './chat.service';
import { SqlRagService } from './sql-rag.service';
import { GraphRagService } from './graph-rag.service';
import { QueryIntentService } from './query-intent.service';
import { FieldResolutionService } from './field-resolution.service';
import { AuthModule } from '../auth/auth.module';
import { Document } from '../database/entities/document.entity';
import { DocumentType } from '../database/entities/document-type.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([Document, DocumentType]),
    AuthModule,
  ],
  controllers: [ChatController],
  providers: [
    ChatService,
    SqlRagService,
    GraphRagService,
    QueryIntentService,
    FieldResolutionService,
  ],
  exports: [ChatService],
})
export class ChatModule {}
