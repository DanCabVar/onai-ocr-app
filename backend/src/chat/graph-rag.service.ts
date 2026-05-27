import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Document } from '../database/entities/document.entity';

interface GraphQueryResult {
  graphAnswer: string;
  graphRows: Record<string, any>[];
}

@Injectable()
export class GraphRagService {
  private readonly logger = new Logger(GraphRagService.name);
  private readonly enabled: boolean;
  private readonly uri: string;
  private readonly username: string;
  private readonly password: string;
  private readonly database: string;
  private readonly maxIngestDocs: number;
  private driver: any | null = null;

  constructor(
    private readonly configService: ConfigService,
    @InjectRepository(Document)
    private readonly documentRepository: Repository<Document>,
  ) {
    this.enabled = this.configService.get<string>('GRAPH_RAG_ENABLED') === 'true';
    this.uri = this.configService.get<string>('NEO4J_URI') || '';
    this.username = this.configService.get<string>('NEO4J_USERNAME') || '';
    this.password = this.configService.get<string>('NEO4J_PASSWORD') || '';
    this.database = this.configService.get<string>('NEO4J_DATABASE') || 'neo4j';
    this.maxIngestDocs = Number(
      this.configService.get<string>('GRAPH_RAG_MAX_INGEST_DOCS') || 200,
    );

    if (!this.enabled) {
      this.logger.log('Graph RAG disabled (`GRAPH_RAG_ENABLED` != true).');
    }
  }

  isEnabled(): boolean {
    return this.enabled;
  }

  shouldUseGraph(question: string): boolean {
    const normalized = question.toLowerCase();
    const relationalHints = [
      'relaci',
      'vincul',
      'entre',
      'conect',
      'depende',
      'impacta',
      'comparten',
      'asociad',
      'red de',
      'grafo',
    ];
    return relationalHints.some((hint) => normalized.includes(hint));
  }

  async answerRelationalQuestion(
    question: string,
    userId: number,
  ): Promise<GraphQueryResult> {
    const session = await this.getSession();
    if (!session) {
      throw new Error('Neo4j no disponible');
    }

    try {
      await this.ingestUserGraph(userId, session);

      const typeNames = await this.findMentionedDocumentTypes(question, userId);
      const result = await session.run(
        `
          MATCH (t:Tenant {userId: $userId})-[:HAS_DOCUMENT]->(d:Document)
          OPTIONAL MATCH (d)-[:HAS_TYPE]->(dt:DocumentType)
          OPTIONAL MATCH (d)-[:HAS_FIELD]->(f:Field)
          WITH d, dt, collect(distinct f.name) AS fields
          WHERE $typeNamesSize = 0 OR dt.name IN $typeNames
          RETURN dt.name AS documentType, count(distinct d) AS totalDocuments, collect(distinct fields)[0..5] AS sampleFields
          ORDER BY totalDocuments DESC
          LIMIT 10
        `,
        {
          userId,
          typeNames,
          typeNamesSize: typeNames.length,
        },
      );

      const rows = result.records.map((r: any) => ({
        documentType: r.get('documentType') || 'Sin tipo',
        totalDocuments: Number(r.get('totalDocuments') || 0),
        sampleFields: (r.get('sampleFields') || []).flat().slice(0, 8),
      }));

      const answer =
        rows.length === 0
          ? 'No encontré relaciones de documentos para esa consulta.'
          : rows
              .map(
                (row, i) =>
                  `${i + 1}. ${row.documentType}: ${row.totalDocuments} documentos (${row.sampleFields.join(', ') || 'sin campos detectados'})`,
              )
              .join('\n');

      return {
        graphAnswer: answer,
        graphRows: rows,
      };
    } finally {
      await session.close();
    }
  }

  private async getSession(): Promise<any | null> {
    if (!this.enabled) return null;
    if (!this.uri || !this.username || !this.password) return null;

    if (!this.driver) {
      try {
        const neo4j = eval('require')('neo4j-driver');
        this.driver = neo4j.driver(
          this.uri,
          neo4j.auth.basic(this.username, this.password),
        );
      } catch (error) {
        this.logger.warn(
          `Neo4j driver unavailable. Install with "pnpm add neo4j-driver". ${error.message}`,
        );
        return null;
      }
    }

    return this.driver.session({ database: this.database });
  }

  private async ingestUserGraph(userId: number, session: any): Promise<void> {
    const docs = await this.documentRepository.find({
      where: { userId },
      relations: ['documentType'],
      order: { updatedAt: 'DESC' },
      take: this.maxIngestDocs,
    });

    await session.run(
      `
        MERGE (t:Tenant {userId: $userId})
        SET t.updatedAt = datetime()
      `,
      { userId },
    );

    const payload = docs.map((doc) => {
      const extractedFields = Array.isArray(doc.extractedData?.fields)
        ? doc.extractedData.fields
        : [];
      const inferredFields = Array.isArray(doc.inferredData?.key_fields)
        ? doc.inferredData.key_fields
        : [];

      return {
        userId,
        docId: doc.id,
        filename: doc.filename || `doc-${doc.id}`,
        typeId: doc.documentTypeId || null,
        typeName: doc.documentType?.name || null,
        status: doc.status || 'unknown',
        updatedAt: doc.updatedAt?.toISOString?.() || new Date().toISOString(),
        fields: [...extractedFields, ...inferredFields]
          .filter((f: any) => f && f.name)
          .slice(0, 40)
          .map((f: any) => ({
            name: String(f.name),
            value: f.value === undefined || f.value === null ? '' : String(f.value),
          })),
      };
    });

    if (payload.length === 0) {
      return;
    }

    await session.run(
      `
        UNWIND $docs AS row
        MERGE (t:Tenant {userId: row.userId})
        MERGE (d:Document {id: row.docId, userId: row.userId})
          SET d.filename = row.filename,
              d.status = row.status,
              d.updatedAt = row.updatedAt
        MERGE (t)-[:HAS_DOCUMENT]->(d)
        FOREACH (_ IN CASE WHEN row.typeId IS NULL THEN [] ELSE [1] END |
          MERGE (dt:DocumentType {id: row.typeId, userId: row.userId})
            SET dt.name = row.typeName
          MERGE (d)-[:HAS_TYPE]->(dt)
        )
        FOREACH (f IN row.fields |
          MERGE (field:Field {userId: row.userId, name: f.name, value: f.value})
          MERGE (d)-[:HAS_FIELD]->(field)
        )
      `,
      { docs: payload },
    );
  }

  private async findMentionedDocumentTypes(
    question: string,
    userId: number,
  ): Promise<string[]> {
    const types = await this.documentRepository.manager
      .createQueryBuilder()
      .select('dt.name', 'name')
      .from('document_types', 'dt')
      .where('dt.user_id = :userId', { userId })
      .getRawMany<{ name: string }>();

    const normalized = question.toLowerCase();
    return types
      .map((t) => t.name)
      .filter((name) => normalized.includes(name.toLowerCase()));
  }
}
