import { Injectable, Logger } from '@nestjs/common';
import { SqlRagService, SqlRagResult } from './sql-rag.service';
import { GraphRagService } from './graph-rag.service';
import { QueryDto } from './dto/query.dto';
import { User } from '../database/entities/user.entity';

export interface ChatQueryResult {
  answer: string;
  query?: string;
  data?: Record<string, any>[];
  source?: 'sql' | 'hybrid';
  metrics?: {
    graphMs?: number;
    sqlMs: number;
    totalMs: number;
  };
}

@Injectable()
export class ChatService {
  private readonly logger = new Logger(ChatService.name);

  constructor(
    private readonly sqlRagService: SqlRagService,
    private readonly graphRagService: GraphRagService,
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
    const startedAt = Date.now();

    if (
      this.graphRagService.isEnabled() &&
      this.graphRagService.shouldUseGraph(query)
    ) {
      const graphStartedAt = Date.now();
      try {
        const graphResult = await this.graphRagService.answerRelationalQuestion(
          query,
          user.id,
        );
        const sqlStartedAt = Date.now();
        const sqlResult: SqlRagResult = await this.sqlRagService.query(
          query,
          user.id,
        );
        const sqlMs = Date.now() - sqlStartedAt;
        const graphMs = Date.now() - graphStartedAt;
        const totalMs = Date.now() - startedAt;

        this.logger.log(
          `Hybrid RAG metrics user=${user.id} graphMs=${graphMs} sqlMs=${sqlMs} totalMs=${totalMs}`,
        );

        return {
          answer: `${sqlResult.answer}\n\nRelaciones detectadas (grafo):\n${graphResult.graphAnswer}`,
          source: 'hybrid',
          metrics: {
            graphMs,
            sqlMs,
            totalMs,
          },
        };
      } catch (error) {
        this.logger.warn(
          `Graph RAG fallback for user ${user.id}: ${error.message}`,
        );
      }
    }

    const sqlStartedAt = Date.now();
    const result: SqlRagResult = await this.sqlRagService.query(
      query,
      user.id,
    );
    const sqlMs = Date.now() - sqlStartedAt;
    const totalMs = Date.now() - startedAt;

    // Return only the answer — do NOT expose the raw SQL query or raw data rows
    // to avoid leaking internal DB schema to clients.
    return {
      answer: result.answer,
      source: 'sql',
      metrics: {
        sqlMs,
        totalMs,
      },
    };
  }
}
