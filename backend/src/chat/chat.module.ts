import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ChatController } from './chat.controller';
import { ChatService } from './chat.service';
import { SqlRagService } from './sql-rag.service';
import { AuthModule } from '../auth/auth.module';
import { Document } from '../database/entities/document.entity';
import { DocumentType } from '../database/entities/document-type.entity';
import { StorageModule } from '../storage/storage.module';
import { MarkdownIngestService } from './markdown-graph-rag/markdown-ingest.service';
import { MarkdownIndexService } from './markdown-graph-rag/markdown-index.service';
import { GraphRetrievalService } from './markdown-graph-rag/graph-retrieval.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([Document, DocumentType]),
    AuthModule,
    StorageModule,
  ],
  controllers: [ChatController],
  providers: [
    ChatService,
    SqlRagService,
    MarkdownIngestService,
    MarkdownIndexService,
    GraphRetrievalService,
  ],
  exports: [ChatService],
})
export class ChatModule {}
