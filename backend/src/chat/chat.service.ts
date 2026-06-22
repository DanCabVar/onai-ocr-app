import { Injectable, Logger } from '@nestjs/common';
import { SqlRagService, SqlRagResult } from './sql-rag.service';
import { GraphRagService } from './graph-rag.service';
import { QueryDto, ChatHistoryMessageDto } from './dto/query.dto';
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

  async getQueryResponse(
    queryDto: QueryDto,
    user: User,
  ): Promise<ChatQueryResult> {
    const contextualQuery = this.buildContextualQuery(
      queryDto.query,
      queryDto.history,
    );

    this.logger.log(`Chat query from user ${user.id}: "${queryDto.query}"`);
    const startedAt = Date.now();

    if (
      this.graphRagService.isEnabled() &&
      this.graphRagService.shouldUseGraph(contextualQuery)
    ) {
      const graphStartedAt = Date.now();
      try {
        const graphResult = await this.graphRagService.answerRelationalQuestion(
          contextualQuery,
          user.id,
        );
        const sqlStartedAt = Date.now();
        const sqlResult: SqlRagResult = await this.sqlRagService.query(
          contextualQuery,
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
          query: sqlResult.query,
          data: sqlResult.data,
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
      contextualQuery,
      user.id,
    );
    const sqlMs = Date.now() - sqlStartedAt;
    const totalMs = Date.now() - startedAt;

    return {
      answer: result.answer,
      query: result.query,
      data: result.data,
      source: 'sql',
      metrics: {
        sqlMs,
        totalMs,
      },
    };
  }

  private buildContextualQuery(
    query: string,
    history?: ChatHistoryMessageDto[],
  ): string {
    const normalizedQuery = query.trim();
    if (!history || history.length === 0) {
      return normalizedQuery;
    }

    const recentHistory = history
      .filter((message) => message.content?.trim())
      .slice(-4);

    if (recentHistory.length === 0) {
      return normalizedQuery;
    }

    const transcript = recentHistory
      .map((message) =>
        `${message.role === 'user' ? 'Usuario' : 'Asistente'}: ${message.content.trim()}`,
      )
      .join('\n');

    return [
      'Contexto reciente de la conversación:',
      transcript,
      `Pregunta actual del usuario: ${normalizedQuery}`,
      'Resuelve la pregunta actual usando el contexto anterior cuando haga falta, pero sin inventar datos.',
    ].join('\n\n');
  }
}
