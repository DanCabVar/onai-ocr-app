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
import { Document } from '../database/entities/document.entity';
import { DocumentType } from '../database/entities/document-type.entity';

/** Maximum rows returned from a single query */
const MAX_ROWS = 1000;

/** Query timeout in milliseconds */
const QUERY_TIMEOUT_MS = 5000;

/** Forbidden SQL patterns (mutations, DDL, etc.) */
const FORBIDDEN_PATTERNS = [
  /\b(INSERT|UPDATE|DELETE|DROP|ALTER|CREATE|TRUNCATE|GRANT|REVOKE|EXECUTE|COPY)\b/i,
  /;\s*\w/, // multiple statements
  /--/, // SQL comments
  /\/\*/, // block comments
];

export interface SqlRagResult {
  answer: string;
  query?: string;
  data?: Record<string, any>[];
}

@Injectable()
export class SqlRagService {
  private readonly logger = new Logger(SqlRagService.name);
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
    const modelName =
      this.configService.get<string>('GEMINI_MODEL') || 'gemini-2.5-flash';
    this.model = this.genAI.getGenerativeModel({ model: modelName });

    this.logger.log(`SQL RAG service initialized (model: ${modelName})`);
  }

  /**
   * Main entry: NL question → SQL → execute → formatted answer.
   */
  async query(question: string, userId: number): Promise<SqlRagResult> {
    this.logger.log(`SQL RAG query from user ${userId}: "${question}"`);

    try {
      // 1. Build schema context for this user
      const schemaContext = await this.buildSchemaContext(userId);

      // 2. Generate SQL via Gemini (uses $1 placeholder for user_id)
      const generatedSql = await this.generateSql(
        question,
        schemaContext,
        userId,
      );

      // 3. Validate the SQL
      this.validateSql(generatedSql);

      // 4. Enforce user_id filter — replace placeholder and execute with param
      const { safeSql, params } = this.prepareSafeQuery(
        generatedSql,
        userId,
      );

      // 5. Execute query with timeout
      const rows = await this.executeSql(safeSql, params);

      // 6. Format response with Gemini
      const answer = await this.formatResponse(question, generatedSql, rows);

      return {
        answer,
        query: generatedSql,
        data: rows,
      };
    } catch (error) {
      this.logger.error(`SQL RAG error: ${error.message}`, error.stack);

      if (
        error instanceof ForbiddenException ||
        error instanceof BadRequestException
      ) {
        throw error;
      }

      return {
        answer:
          'No pude procesar tu consulta. Intenta reformularla de forma más específica.',
      };
    }
  }

  /**
   * Build a schema description from the user's document types and their field schemas.
   */
  private async buildSchemaContext(userId: number): Promise<string> {
    const types = await this.documentTypeRepository.find({
      where: { userId },
    });

    // Get document count and sample field names for better context
    const docStats = await this.documentRepository
      .createQueryBuilder('d')
      .select('d.document_type_id', 'type_id')
      .addSelect('COUNT(*)', 'count')
      .where('d.user_id = :userId', { userId })
      .groupBy('d.document_type_id')
      .getRawMany();

    const statsMap = new Map(
      docStats.map((s) => [s.type_id, parseInt(s.count)]),
    );

    if (types.length === 0) {
      return `El usuario tiene ${statsMap.get(null) || 0} documentos sin tipo definido.`;
    }

    const typeDescriptions = types
      .map((t) => {
        const count = statsMap.get(t.id) || 0;
        const fields =
          t.fieldSchema?.fields
            ?.map(
              (f) =>
                `    - "${f.name}" (${f.type}): ${f.label}${f.required ? ' [required]' : ''}`,
            )
            .join('\n') || '    (sin campos definidos)';
        return `  Tipo "${t.name}" (id=${t.id}, ${count} documentos):\n${fields}`;
      })
      .join('\n\n');

    return `Tipos de documento del usuario y sus campos extraídos:
${typeDescriptions}

Schema de la base de datos:

  Tabla: documents
    - id: integer PK
    - user_id: integer (SIEMPRE filtrar por este campo)
    - document_type_id: integer FK → document_types.id
    - filename: varchar
    - extracted_data: jsonb — contiene "summary" (texto) y "fields" (array de objetos)
    - inferred_data: jsonb — para docs tipo "Otros": contiene "inferred_type", "summary", "key_fields"
    - confidence_score: decimal
    - status: varchar ('processing' | 'completed' | 'error')
    - created_at: timestamptz
    - updated_at: timestamptz
    - storage_key: text

  Tabla: document_types
    - id: integer PK
    - user_id: integer
    - name: varchar
    - description: text
    - field_schema: jsonb

Patrones de acceso JSONB para extracted_data:
  - Resumen del documento: extracted_data->>'summary'
  - Campo "fields" es un array de objetos: [{name, value, type, label}]
  - Para acceder a un campo específico por nombre, usa jsonb_array_elements:
      SELECT d.*, f->>'value' AS valor
      FROM documents d, jsonb_array_elements(d.extracted_data->'fields') f
      WHERE f->>'name' = 'nombre_campo' AND d.user_id = $1
  - Para sumar valores numéricos de un campo:
      SELECT SUM((f->>'value')::numeric)
      FROM documents d, jsonb_array_elements(d.extracted_data->'fields') f
      WHERE f->>'name' = 'monto' AND d.user_id = $1
  - Para docs inferidos (Otros): inferred_data->'key_fields' tiene la misma estructura
  - Para filtrar por tipo: JOIN document_types dt ON d.document_type_id = dt.id

IMPORTANTE: user_id siempre se pasa como parámetro $1. Usa $1 en WHERE, nunca el valor directo.`;
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

REGLAS ESTRICTAS:
1. SIEMPRE usar WHERE user_id = $1 (parámetro seguro, nunca el valor directo)
2. SOLO queries SELECT — NUNCA INSERT, UPDATE, DELETE, DROP, ALTER, CREATE, TRUNCATE
3. LIMIT máximo ${MAX_ROWS} filas
4. Para acceder a campos JSONB extraídos, usa jsonb_array_elements como se muestra arriba
5. JOIN con document_types cuando necesites el nombre del tipo de documento
6. Usa aliases descriptivos en español
7. Si la pregunta no es sobre documentos o datos extraídos, responde exactamente: NO_SQL
8. Una sola query, sin punto y coma intermedio
9. Siempre incluir ORDER BY cuando tenga sentido (fecha, cantidad, etc.)

EJEMPLOS:
- "¿Cuántos documentos tengo?" → SELECT COUNT(*) AS total_documentos FROM documents WHERE user_id = $1
- "¿Cuántos documentos por tipo?" → SELECT dt.name AS tipo, COUNT(*) AS cantidad FROM documents d JOIN document_types dt ON d.document_type_id = dt.id WHERE d.user_id = $1 GROUP BY dt.name ORDER BY cantidad DESC
- "¿Cuánto facturé en 2025?" → SELECT SUM((f->>'value')::numeric) AS total_facturado FROM documents d JOIN document_types dt ON d.document_type_id = dt.id, jsonb_array_elements(d.extracted_data->'fields') f WHERE d.user_id = $1 AND LOWER(dt.name) LIKE '%factura%' AND f->>'name' = 'monto' AND d.created_at >= '2025-01-01' AND d.created_at < '2026-01-01'
- "Muéstrame los contratos del último mes" → SELECT d.filename, d.extracted_data->>'summary' AS resumen, d.created_at FROM documents d JOIN document_types dt ON d.document_type_id = dt.id WHERE d.user_id = $1 AND LOWER(dt.name) LIKE '%contrato%' AND d.created_at >= NOW() - INTERVAL '1 month' ORDER BY d.created_at DESC

Pregunta del usuario: "${question}"

Responde SOLO con la query SQL, sin backticks, sin explicaciones, sin markdown. Si no puedes traducirla, responde: NO_SQL`;

    const result = await this.model.generateContent(prompt);
    const response = result.response.text().trim();

    if (response === 'NO_SQL' || response.startsWith('NO_SQL')) {
      throw new BadRequestException(
        'No pude traducir tu pregunta a una consulta sobre documentos. ' +
          'Intenta preguntar sobre tus datos extraídos, tipos de documento o estadísticas.',
      );
    }

    // Clean up: remove markdown fences if present
    let sql = response
      .replace(/^```(?:sql)?\s*\n?/gm, '')
      .replace(/\n?```\s*$/gm, '')
      .trim();

    // Remove trailing semicolons (we add them in execution)
    sql = sql.replace(/;\s*$/, '');

    return sql;
  }

  /**
   * Validate generated SQL for safety.
   */
  private validateSql(sql: string): void {
    // Check for forbidden patterns
    for (const pattern of FORBIDDEN_PATTERNS) {
      if (pattern.test(sql)) {
        throw new ForbiddenException(
          'La query generada contiene operaciones no permitidas.',
        );
      }
    }

    // Must start with SELECT
    if (!/^\s*SELECT\b/i.test(sql)) {
      throw new ForbiddenException('Solo se permiten queries SELECT.');
    }

    // Must reference $1 for user_id parameterization
    if (!sql.includes('$1')) {
      throw new ForbiddenException(
        'La query no incluye el parámetro de usuario $1. Rechazada por seguridad.',
      );
    }
  }

  /**
   * Prepare the query for safe execution:
   * - Ensure user_id = $1 is present
   * - Add LIMIT if missing
   * - Return params array
   */
  private prepareSafeQuery(
    sql: string,
    userId: number,
  ): { safeSql: string; params: any[] } {
    let safeSql = sql;

    // Auto-add LIMIT if missing
    if (!/\bLIMIT\b/i.test(safeSql)) {
      safeSql = safeSql + ` LIMIT ${MAX_ROWS}`;
    }

    return {
      safeSql,
      params: [userId],
    };
  }

  /**
   * Execute a validated read-only SQL query with timeout.
   */
  private async executeSql(
    sql: string,
    params: any[],
  ): Promise<Record<string, any>[]> {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();

    try {
      // Begin a read-only transaction with timeout
      await queryRunner.query('BEGIN READ ONLY');
      await queryRunner.query(`SET LOCAL statement_timeout = ${QUERY_TIMEOUT_MS}`);

      const rows = await queryRunner.query(sql, params);

      await queryRunner.query('COMMIT');

      this.logger.log(`Query executed: ${rows.length} rows returned`);
      return Array.isArray(rows) ? rows.slice(0, MAX_ROWS) : [];
    } catch (error) {
      await queryRunner.query('ROLLBACK').catch(() => {});
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
      return 'No encontré resultados para tu consulta. Puede que no tengas documentos que coincidan o que necesites reformular la pregunta.';
    }

    // For simple single-value results, return directly without LLM call
    if (rows.length === 1 && Object.keys(rows[0]).length === 1) {
      const key = Object.keys(rows[0])[0];
      const value = Object.values(rows[0])[0];
      if (value === null || value === undefined) {
        return 'No hay datos disponibles para esa consulta.';
      }
      // Simple formatting for common cases
      if (typeof value === 'number' || !isNaN(Number(value))) {
        return `${key.replace(/_/g, ' ')}: ${value}`;
      }
      return `${value}`;
    }

    // Truncate large result sets for the LLM context
    const dataPreview = rows.length > 25 ? rows.slice(0, 25) : rows;
    const truncated = rows.length > 25;

    const prompt = `El usuario preguntó: "${originalQuestion}"

Resultados (${rows.length} filas${truncated ? ', mostrando primeras 25' : ''}):
${JSON.stringify(dataPreview, null, 2)}

Formatea una respuesta clara y concisa EN ESPAÑOL:
- Si son números/totales, destácalos claramente
- Si son listas, presenta los datos de forma legible con viñetas o numeración
- Si hay muchos resultados, resume los datos clave y menciona el total
- NO incluyas la query SQL en tu respuesta
- NO uses markdown headers (##), solo texto plano con saltos de línea
- Sé directo, útil y amigable
- Si hay valores monetarios, formatea con separador de miles`;

    const result = await this.model.generateContent(prompt);
    return result.response.text().trim();
  }
}
