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

/** Schema context cache TTL in ms (5 minutes) */
const SCHEMA_CACHE_TTL_MS = 5 * 60 * 1000;

/** Skip LLM formatting for result sets at or below this size */
const FORMAT_SKIP_ROWS = 10;

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

interface SchemaCacheEntry {
  context: string;
  expiresAt: number;
}

@Injectable()
export class SqlRagService {
  private readonly logger = new Logger(SqlRagService.name);
  private genAI: GoogleGenerativeAI;
  private model: any;

  /** In-process schema context cache keyed by userId */
  private readonly schemaCache = new Map<number, SchemaCacheEntry>();

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
      // 1. Build (or retrieve cached) schema context for this user
      const schemaContext = await this.getSchemaContext(userId);

      // 2. Generate SQL via Gemini (uses $1 placeholder for user_id)
      const generatedSql = await this.generateSql(
        question,
        schemaContext,
        userId,
      );

      // 2b. If no SQL (general question), answer conversationally
      if (!generatedSql) {
        const answer = await this.answerGeneral(question, schemaContext);
        return { answer };
      }

      // 3. Validate the SQL
      this.validateSql(generatedSql);

      // 4. Enforce user_id filter — replace placeholder and execute with param
      const { safeSql, params } = this.prepareSafeQuery(
        generatedSql,
        userId,
      );

      // 5. Execute query with timeout
      const rows = await this.executeSql(safeSql, params);

      // 6. Format response — skip LLM for small result sets
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
   * Invalidate the schema cache for a user (call after document type changes).
   */
  invalidateSchemaCache(userId: number): void {
    this.schemaCache.delete(userId);
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // Private helpers
  // ─────────────────────────────────────────────────────────────────────────────

  /**
   * Return cached schema context for a user, refreshing if stale.
   * Avoids 2 DB queries on every chat message (major latency reduction).
   */
  private async getSchemaContext(userId: number): Promise<string> {
    const cached = this.schemaCache.get(userId);
    if (cached && cached.expiresAt > Date.now()) {
      return cached.context;
    }
    const context = await this.buildSchemaContext(userId);
    this.schemaCache.set(userId, {
      context,
      expiresAt: Date.now() + SCHEMA_CACHE_TTL_MS,
    });
    return context;
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
   * Prompt is kept minimal to reduce token count and latency.
   */
  private async generateSql(
    question: string,
    schemaContext: string,
    userId: number,
  ): Promise<string> {
    const prompt = `Eres un experto SQL PostgreSQL. Traduce la pregunta a una query SQL.

${schemaContext}

REGLAS:
1. WHERE user_id = $1 SIEMPRE (nunca el valor directo)
2. Solo SELECT. Sin INSERT/UPDATE/DELETE/DROP/ALTER/CREATE/TRUNCATE.
3. LIMIT máximo ${MAX_ROWS}
4. Para campos JSONB usa jsonb_array_elements como se indica arriba
5. JOIN document_types si necesitas el nombre del tipo
6. Si la pregunta no es sobre documentos/datos, responde: NO_SQL
7. Una sola query, sin punto y coma

Pregunta: "${question}"

Solo la query SQL, sin backticks ni explicaciones. Si no puedes, responde: NO_SQL`;

    const result = await this.model.generateContent(prompt);
    const response = result.response.text().trim();

    if (response === 'NO_SQL' || response.startsWith('NO_SQL')) {
      return null;
    }

    let sql = response
      .replace(/^```(?:sql)?\s*\n?/gm, '')
      .replace(/\n?```\s*$/gm, '')
      .trim();

    sql = sql.replace(/;\s*$/, '');

    return sql;
  }

  /**
   * Validate generated SQL for safety.
   */
  private validateSql(sql: string): void {
    for (const pattern of FORBIDDEN_PATTERNS) {
      if (pattern.test(sql)) {
        throw new ForbiddenException(
          'La query generada contiene operaciones no permitidas.',
        );
      }
    }

    if (!/^\s*SELECT\b/i.test(sql)) {
      throw new ForbiddenException('Solo se permiten queries SELECT.');
    }

    if (!sql.includes('$1')) {
      throw new ForbiddenException(
        'La query no incluye el parámetro de usuario $1. Rechazada por seguridad.',
      );
    }
  }

  /**
   * Prepare the query for safe execution:
   * - Add LIMIT if missing
   * - Return params array
   */
  private prepareSafeQuery(
    sql: string,
    userId: number,
  ): { safeSql: string; params: any[] } {
    let safeSql = sql;

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
   * Answer general (non-data) questions about the system.
   */
  private async answerGeneral(question: string, schemaContext: string): Promise<string> {
    const prompt = `Eres un asistente de IA para ONAI OCR, plataforma de procesamiento de documentos.

${schemaContext}

El usuario pregunta: "${question}"

Responde amigable y conciso en español. Si preguntan qué puedes hacer, explica que puedes:
1. Responder sobre sus documentos (cuántos hay, tipos, datos específicos)
2. Buscar info en campos extraídos (montos, fechas, nombres, etc.)
3. Calcular sobre los datos (sumas, promedios, conteos)
4. Mostrar estadísticas y resúmenes`;

    const result = await this.model.generateContent(prompt);
    return result.response.text().trim();
  }

  /**
   * Format query results as a human-readable response.
   *
   * Optimisation: for small result sets (≤ FORMAT_SKIP_ROWS rows) we format
   * locally without an extra LLM call, saving ~1-2s per query.
   */
  private async formatResponse(
    originalQuestion: string,
    sql: string,
    rows: Record<string, any>[],
  ): Promise<string> {
    if (rows.length === 0) {
      return 'No encontré resultados para tu consulta. Puede que no tengas documentos que coincidan o que necesites reformular la pregunta.';
    }

    // ── Fast path: format locally without LLM ──────────────────────────────
    if (rows.length === 1 && Object.keys(rows[0]).length === 1) {
      const key = Object.keys(rows[0])[0];
      const value = Object.values(rows[0])[0];
      if (value === null || value === undefined) {
        return 'No hay datos disponibles para esa consulta.';
      }
      // Build a natural language response without exposing raw SQL aliases
      const num = Number(value);
      const formattedValue =
        !isNaN(num) && Math.abs(num) < 1e12
          ? num.toLocaleString('es-CL')
          : String(value);

      try {
        const simplePrompt = `El usuario preguntó: "${originalQuestion}"
El resultado es: ${formattedValue}

Responde directamente en español natural y amigable, en 1 oración. 
NO uses términos técnicos como "count", "total_documentos" ni nombres de columnas.
Ejemplo correcto: "Tienes 6 documentos procesados." 
Ejemplo incorrecto: "count: 6"`;
        const simpleResult = await this.model.generateContent(simplePrompt);
        return simpleResult.response.text().trim();
      } catch {
        // Fallback: human-readable without SQL alias
        return `Resultado: ${formattedValue}`;
      }
    }

    // For small result sets, build a readable table without calling LLM
    if (rows.length <= FORMAT_SKIP_ROWS) {
      return this.formatRowsLocally(rows);
    }

    // ── Slow path: LLM formatting for larger result sets ───────────────────
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

  /**
   * Format a small result set as a readable text table without an LLM call.
   */
  private formatRowsLocally(rows: Record<string, any>[]): string {
    if (rows.length === 0) return 'Sin resultados.';

    // Internal fields that should never be shown to the user
    const HIDDEN_FIELDS = new Set([
      'id', 'user_id', 'userId', 'confidence_score', 'confidenceScore',
      'storage_path', 'storagePath', 'google_drive_link', 'googleDriveLink',
      'extracted_data', 'extractedData', 'raw_text', 'rawText',
    ]);

    // Timestamp-like fields: epoch ms (>1e12) or known date columns
    const TIMESTAMP_FIELDS = new Set([
      'created_at', 'createdAt', 'updated_at', 'updatedAt',
      'processed_at', 'processedAt', 'period_end', 'periodEnd',
    ]);

    const formatValue = (k: string, v: any): string => {
      if (v === null || v === undefined) return '—';

      // Format epoch milliseconds as readable dates
      if (TIMESTAMP_FIELDS.has(k)) {
        const ms = Number(v);
        if (!isNaN(ms) && ms > 1e12) {
          return new Date(ms).toLocaleDateString('es-CL', {
            year: 'numeric', month: 'long', day: 'numeric',
          });
        }
        // ISO string or other date format
        const d = new Date(String(v));
        if (!isNaN(d.getTime())) {
          return d.toLocaleDateString('es-CL', {
            year: 'numeric', month: 'long', day: 'numeric',
          });
        }
      }

      // Format numeric values (but NOT timestamps that look numeric)
      const num = Number(v);
      if (!isNaN(num) && String(v).trim() !== '' && !TIMESTAMP_FIELDS.has(k)) {
        // Only format as number if it's a reasonable magnitude (not epoch ms)
        if (Math.abs(num) < 1e12) {
          return num.toLocaleString('es-CL');
        }
      }

      return String(v);
    };

    const allKeys = Object.keys(rows[0]);
    const keys = allKeys.filter((k) => !HIDDEN_FIELDS.has(k));

    // If all keys were hidden, fall back to showing all
    const displayKeys = keys.length > 0 ? keys : allKeys;

    // Single column — just list values
    if (displayKeys.length === 1) {
      const key = displayKeys[0].replace(/_/g, ' ');
      const values = rows.map((r) => formatValue(displayKeys[0], r[displayKeys[0]]));
      return `${key}:\n${values.map((v) => `• ${v}`).join('\n')}`;
    }

    // Multiple columns — key: value per row
    return rows
      .map((row, i) => {
        const parts = displayKeys.map((k) => {
          const label = k
            .replace(/_/g, ' ')
            .replace(/([a-z])([A-Z])/g, '$1 $2')
            .toLowerCase();
          return `  ${label}: ${formatValue(k, row[k])}`;
        });
        return `${i + 1}. ${parts.join('\n')}`;
      })
      .join('\n\n');
  }
}
