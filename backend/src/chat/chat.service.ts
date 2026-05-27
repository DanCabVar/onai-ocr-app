import { Injectable, Logger } from '@nestjs/common';
import { SqlRagService, SqlRagResult } from './sql-rag.service';
import { QueryDto } from './dto/query.dto';
import { User } from '../database/entities/user.entity';
import { RetrievalSource } from './markdown-graph-rag/types';
import { GraphRetrievalService } from './markdown-graph-rag/graph-retrieval.service';

export interface ChatQueryResult {
  answer: string;
  query?: string;
  data?: Record<string, any>[];
  sources?: RetrievalSource[];
}

@Injectable()
export class ChatService {
  private readonly logger = new Logger(ChatService.name);

  constructor(
    private readonly sqlRagService: SqlRagService,
    private readonly graphRetrievalService: GraphRetrievalService,
  ) {}

  /**
   * Process a natural language question about the user's documents.
   * Delegates to SqlRagService for NL → SQL → execute → format.
   */
  async getQueryResponse(
    queryDto: QueryDto,
    user: User,
  ): Promise<ChatQueryResult> {
    const { query } = queryDto;
    this.logger.log(`Chat query from user ${user.id}: "${query}"`);

    try {
      const markdownResult = await this.graphRetrievalService.retrieveAndAnswer(
        query,
        user.id,
      );
      if (markdownResult) {
        return {
          answer: markdownResult.answer,
          sources: markdownResult.sources,
        };
      }
    } catch (error) {
      this.logger.warn(
        `Markdown graph retrieval unavailable, fallback to SQL RAG: ${error.message}`,
      );
    }

    const result: SqlRagResult = await this.sqlRagService.query(
      query,
      user.id,
    );

    // Return only the answer — do NOT expose the raw SQL query or raw data rows
    // to avoid leaking internal DB schema to clients.
    return {
      answer: result.answer,
    };
  }
}
