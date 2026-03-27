import { Injectable, Logger } from '@nestjs/common';
import { SqlRagService, SqlRagResult } from './sql-rag.service';
import { QueryDto } from './dto/query.dto';
import { User } from '../database/entities/user.entity';

export interface ChatQueryResult {
  answer: string;
  query?: string;
  data?: Record<string, any>[];
}

@Injectable()
export class ChatService {
  private readonly logger = new Logger(ChatService.name);

  constructor(private readonly sqlRagService: SqlRagService) {}

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
