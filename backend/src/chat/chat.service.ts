import {
  Injectable,
  Logger,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { QueryDto } from './dto/query.dto';
import { User } from '../database/entities/user.entity';
import { Document } from '../database/entities/document.entity';
import { DocumentType } from '../database/entities/document-type.entity';

/** Maximum rows returned from a single query */
const MAX_ROWS = 100;

/** Forbidden SQL patterns (mutations, DDL, etc.) */
const FORBIDDEN_PATTERNS = [
  /\b(INSERT|UPDATE|DELETE|DROP|ALTER|CREATE|TRUNCATE|GRANT|REVOKE)\b/i,
  /;\s*\w/,  // multiple statements
  /--/,      // SQL comments
  /\/\*/,    // block comments
];

export interface ChatQueryResult {
  response: string;
  executedQuery: string | null;
  data: Record<string, any>[] | null;
  rowCount: number;
  timestamp: Date;
}

@Injectable()
export class ChatService {
  private readonly logger = new Logger(ChatService.name);
  private genAI: GoogleGenerativeAI;
  private model: any;

  constructor(
    private readonly configService: ConfigService,
    private readonly dataSource: DataSource,
    @InjectRepository(Document)
    private readonly documentRepository: Repository<Document>,
    @InjectRepository(DocumentType)
    private readonly documentTypeRepository: Repository<DocumentType>,
  ) {
    const apiKey = this.configService.get<string>('GOOGLE_AI_API_KEY');
    if (!apiKey) {
      throw new Error('GOOGLE_AI_API_KEY not configured');
    }

    this.genAI = new GoogleGenerativeAI(apiKey);
    const modelName = this.configService.get<string>('GEMINI_MODEL') || 'gemini-2.5-flash';
    this.model = this.genAI.getGenerativeModel({ model: modelName });

    this.logger.log(`Chat RAG SQL initialized (model: ${modelName})`);
  }

  /**
   * Main entry: NL question → SQL → execute → formatted answer.
   */
  async getQueryResponse(
    queryDto: QueryDto,
    user: User,
  ): Promise<ChatQueryResult> {
    const { query } = queryDto;
    this.logger.log(`Chat query from user ${user.id}: "${query}"`);

    try {
      // 1. Build schema context for this user
      const schemaContext = await this.buildSchemaContext(user.id);

      // 2. Generate SQL via Gemini
      const generatedSql = await this.generateSql(query, schemaContext, user.id);

      // 3. Validate the SQL
      this.validateSql(generatedSql, user.id);

      // 4. Execute query
      const rows = await this.executeSql(generatedSql);

      // 5. Format response with Gemini
      const formattedResponse = await this.formatResponse(
        query,
        generatedSql,
        rows,
      );

      return {
        response: formattedResponse,
        executedQuery: generatedSql,
        data: rows,
        rowCount: rows.length,
        timestamp: new Date(),
      };
    } catch (error) {
      this.logger.error(`Chat query error: ${error.message}`, error.stack);

      if (
        error instanceof ForbiddenException ||
        error instanceof BadRequestException
      ) {
        throw error;
      }

      return {
        response:
          'No pude procesar tu consulta. Intenta reformularla de forma más específica.',
        executedQuery: null,
        data: null,
        rowCount: 0,
        timestamp: new Date(),
      };
    }
  }

  /**
   * Build a schema description from the user's document types and their field schemas.
   * This gives Gemini the context to write accurate JSONB queries.
   */
  private async buildSchemaContext(userId: number): Promise<string> {
    const types = await this.documentTypeRepository.find({
      where: { userId },
    });

    if (types.length === 0) {
      return 'No document types configured yet.';
    }

    const typeDescriptions = types
      .map((t) => {
        const fields = t.fieldSchema.fields
          .map(
            (f) =>
              `    - "${f.name}" (${f.type}): ${f.label}${f.required ? ' [required]' : ''}`,
          )
          .join('\n');
        return `  Type "${t.name}" (id=${t.id}):\n${fields}`;
      })
      .join('\n\n');

    return `Available document types and their extracted fields:
${typeDescriptions}

Database schema:
  Table: documents
    - id: integer PK
    - user_id: integer (ALWAYS filter by this)
    - document_type_id: integer FK → document_types.id
    - filename: varchar
    - extracted_data: jsonb (contains "summary" and "fields" array)
    - inferred_data: jsonb (for "Otros" docs — contains "inferred_type", "summary", "key_fields")
    - confidence_score: decimal
    - status: varchar (processing|completed|error)
    - created_at: timestamptz
    - storage_key: text

  Table: document_types
    - id: integer PK
    - user_id: integer
    - name: varchar
    - description: text
    - field_schema: jsonb

JSONB access patterns for extracted_data:
  - Summary: extracted_data->>'summary'
  - Field value by name: extracted_data->'fields' is an array of objects with {name, value, type, label}
  - To get a specific field value: 
    SELECT f->>'value' FROM documents, jsonb_array_elements(extracted_data->'fields') f WHERE f->>'name' = 'field_name'
  - For inferred docs (Otros): inferred_data->'key_fields' has same structure`;
  }

  /**
   * Use Gemini to translate natural language to SQL.
   */
  private async generateSql(
    question: string,
    schemaContext: string,
    userId: number,
  ): Promise<string> {
    const prompt = `Eres un experto en SQL para PostgreSQL. Traduce la pregunta del usuario a una query SQL.

${schemaContext}

REGLAS CRÍTICAS:
1. SIEMPRE incluir WHERE user_id = ${userId} (seguridad multi-tenant)
2. SOLO SELECT — nunca INSERT, UPDATE, DELETE, DROP, etc.
3. LIMIT ${MAX_ROWS} máximo
4. Para acceder a campos extraídos en JSONB, usa jsonb_array_elements
5. JOIN con document_types si necesitas el nombre del tipo
6. Usa nombres en español cuando generes aliases legibles
7. Si la pregunta no es sobre documentos, responde: NO_SQL

Pregunta: "${question}"

Responde SOLO con la query SQL (sin backticks, sin explicación). Si no puedes traducirla, responde: NO_SQL`;

    const result = await this.model.generateContent(prompt);
    const response = result.response.text().trim();

    if (response === 'NO_SQL' || response.startsWith('NO_SQL')) {
      throw new BadRequestException(
        'No pude traducir tu pregunta a una consulta sobre documentos. ' +
          'Intenta preguntar sobre datos extraídos, tipos de documento, o estadísticas.',
      );
    }

    // Clean up: remove markdown fences if present
    let sql = response
      .replace(/^```(?:sql)?\s*\n?/gm, '')
      .replace(/\n?```\s*$/gm, '')
      .trim();

    // Ensure it ends with semicolon (or add one)
    if (!sql.endsWith(';')) sql += ';';

    return sql;
  }

  /**
   * Validate generated SQL for safety.
   */
  private validateSql(sql: string, userId: number): void {
    // Check for forbidden patterns
    for (const pattern of FORBIDDEN_PATTERNS) {
      if (pattern.test(sql)) {
        throw new ForbiddenException(
          'La query generada contiene operaciones no permitidas.',
        );
      }
    }

    // Must contain user_id filter
    if (!sql.includes(String(userId))) {
      throw new ForbiddenException(
        'La query no incluye filtro de usuario. Rechazada por seguridad.',
      );
    }

    // Must start with SELECT
    if (!/^\s*SELECT\b/i.test(sql)) {
      throw new ForbiddenException('Solo se permiten queries SELECT.');
    }

    // Must have LIMIT — if missing, we'll add it in executeSql
    // (validation passes, limit enforced at execution)
  }

  /**
   * Execute a validated read-only SQL query.
   */
  private async executeSql(
    sql: string,
  ): Promise<Record<string, any>[]> {
    // Auto-add LIMIT if missing
    if (!/\bLIMIT\b/i.test(sql)) {
      sql = sql.replace(/;\s*$/, '') + ` LIMIT ${MAX_ROWS};`;
    }

    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();

    try {
      // Set read-only transaction
      await queryRunner.query('SET TRANSACTION READ ONLY');
      // Set statement timeout (10 seconds)
      await queryRunner.query('SET statement_timeout = 10000');

      const rows = await queryRunner.query(sql);

      this.logger.log(`Query executed: ${rows.length} rows returned`);
      return Array.isArray(rows) ? rows.slice(0, MAX_ROWS) : [];
    } catch (error) {
      this.logger.error(`SQL execution error: ${error.message}`);
      throw new BadRequestException(
        `Error ejecutando la consulta: ${error.message}`,
      );
    } finally {
      await queryRunner.release();
    }
  }

  /**
   * Use Gemini to format the raw query results into a human-readable response.
   */
  private async formatResponse(
    originalQuestion: string,
    sql: string,
    rows: Record<string, any>[],
  ): Promise<string> {
    if (rows.length === 0) {
      return 'No encontré resultados para tu consulta. Intenta con otros criterios.';
    }

    // For simple single-value results, return directly
    if (rows.length === 1 && Object.keys(rows[0]).length === 1) {
      const value = Object.values(rows[0])[0];
      return `${value}`;
    }

    // Truncate large result sets for the LLM
    const dataPreview = rows.length > 20 ? rows.slice(0, 20) : rows;
    const truncated = rows.length > 20;

    const prompt = `El usuario preguntó: "${originalQuestion}"

Se ejecutó esta query SQL:
${sql}

Resultados (${rows.length} filas${truncated ? ', mostrando primeras 20' : ''}):
${JSON.stringify(dataPreview, null, 2)}

Formatea una respuesta clara y concisa EN ESPAÑOL:
- Si son números/totales, destácalos
- Si son listas, usa formato legible
- Si hay muchos resultados, resume los datos clave
- No incluyas la query SQL en la respuesta
- No uses markdown headers, solo texto plano con saltos de línea
- Sé directo y útil`;

    const result = await this.model.generateContent(prompt);
    return result.response.text().trim();
  }
}
