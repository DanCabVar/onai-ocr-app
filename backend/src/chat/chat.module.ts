import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ChatController } from './chat.controller';
import { ChatService } from './chat.service';
import { AuthModule } from '../auth/auth.module';
import { Document } from '../database/entities/document.entity';
import { DocumentType } from '../database/entities/document-type.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([Document, DocumentType]),
    AuthModule,
  ],
  controllers: [ChatController],
  providers: [ChatService],
  exports: [ChatService],
})
export class ChatModule {}
