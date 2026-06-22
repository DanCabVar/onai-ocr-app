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
  /\b(from|join)\s+(?:public\.)?(documents|document_types|subscriptions|users)\b/i, // direct table access
  /\b(from|join)\s+(?:pg_catalog|information_schema)\b/i, // system catalogs
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

      // 2. Prefer deterministic SQL for common field/entity follow-ups
      const deterministicSql = this.buildDeterministicFieldQuery(question);

      // 3. Generate SQL via Gemini (uses $1 placeholder for user_id) when needed
      const generatedSql =
        deterministicSql ||
        (await this.generateSql(question, schemaContext, userId));

      // 3b. If no SQL (general question), answer conversationally
      if (!generatedSql) {
        const answer = await this.answerGeneral(question, schemaContext);
        return { answer };
      }

      // 4. Validate the SQL
      this.validateSql(generatedSql);

      // 5. Enforce user_id filter — replace placeholder and execute with param
      const { safeSql, params } = this.prepareSafeQuery(
        generatedSql,
        userId,
      );

      // 6. Execute query with timeout
      const rows = await this.executeSql(safeSql, params);

      // 7. Format response — skip LLM for small result sets
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
                `    - "${f.name}" (${f.type}): ${f.label}${f.required ? ' [required]' : ''}${this.buildFieldAliasSuffix(f.name, f.label)}`,
            )
            .join('\n') || '    (sin campos definidos)';
        return `  Tipo "${t.name}" (id=${t.id}, ${count} documentos):\n${fields}`;
      })
      .join('\n\n');

    return `Tipos de documento del usuario y sus campos extraídos:
${typeDescriptions}

Schema de la base de datos:

IMPORTANTE: SOLO puedes consultar las vistas my_documents y my_document_types. NUNCA uses las tablas documents o document_types directamente.

  Vista: my_documents (equivalente a documents filtrado por el usuario actual)
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

  Vista: my_document_types (equivalente a document_types filtrado por el usuario actual)
    - id: integer PK
    - user_id: integer
    - name: varchar
    - description: text
    - field_schema: jsonb

Patrones de acceso JSONB para extracted_data:
  - Resumen del documento: extracted_data->>'summary'
  - Campo "fields" es un array de objetos: [{name, value, type, label}]
  - SIEMPRE considera tanto f->>'name' como f->>'label' para encontrar el campo correcto
  - Cuando el usuario pregunte por comprador, proveedor, emisor, cliente, facturación o despacho, usa coincidencias flexibles con ILIKE sobre name/label
  - Cuando el usuario mencione una empresa o persona (ej. "Yolito"), busca esa entidad con ILIKE en f->>'value' y no con igualdad exacta
  - Para acceder a un campo específico por nombre, usa jsonb_array_elements:
      SELECT d.*, f->>'value' AS valor
      FROM my_documents d, jsonb_array_elements(d.extracted_data->'fields') f
      WHERE f->>'name' = 'nombre_campo' AND d.user_id = $1
  - Ejemplo robusto por etiqueta/alias:
      SELECT d.filename, fecha->>'value' AS fecha_emision
      FROM my_documents d
      CROSS JOIN LATERAL jsonb_array_elements(d.extracted_data->'fields') participante
      CROSS JOIN LATERAL jsonb_array_elements(d.extracted_data->'fields') fecha
      WHERE d.user_id = $1
        AND (
          lower(participante->>'name') LIKE '%comprador%'
          OR lower(participante->>'label') LIKE '%comprador%'
        )
        AND lower(participante->>'value') LIKE '%yolito%'
        AND (
          lower(fecha->>'name') LIKE '%fecha_emision%'
          OR lower(fecha->>'label') LIKE '%fecha de emisión%'
        )
  - Para sumar valores numéricos de un campo:
      SELECT SUM((f->>'value')::numeric)
      FROM my_documents d, jsonb_array_elements(d.extracted_data->'fields') f
      WHERE f->>'name' = 'monto' AND d.user_id = $1
  - Para docs inferidos (Otros): inferred_data->'key_fields' tiene la misma estructura
  - Para filtrar por tipo: JOIN my_document_types dt ON d.document_type_id = dt.id

IMPORTANTE: user_id siempre se pasa como parámetro $1. Usa $1 en WHERE, nunca el valor directo.`;
  }

  private buildFieldAliasSuffix(name: string, label: string): string {
    const aliases = new Set<string>();
    const collectTokens = (value: string) => {
      this.normalizeText(value)
        .split(/\s+/)
        .filter((token) => token.length >= 4)
        .forEach((token) => aliases.add(token));
    };

    collectTokens(name.replace(/[_()]+/g, ' '));
    collectTokens(label);

    const orderedAliases = Array.from(aliases).slice(0, 8);
    return orderedAliases.length > 0
      ? ` | alias de búsqueda: ${orderedAliases.join(', ')}`
      : '';
  }

  private normalizeText(value: string): string {
    return value
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase();
  }

  private buildDeterministicFieldQuery(question: string): string | null {
    const normalized = this.normalizeText(question);
    const currentQuestion = this.extractCurrentQuestion(question);
    const normalizedCurrentQuestion = this.normalizeText(currentQuestion);
    const entity = this.extractTrackedEntity(question);

    if (!entity) {
      return null;
    }

    const entityTerms = this.buildEntitySearchTerms(entity);
    const entityConditions = this.buildEntityMatchConditions(entityTerms);

    if (normalizedCurrentQuestion.includes('fecha') && normalizedCurrentQuestion.includes('emision')) {
      return `
SELECT DISTINCT
  d.filename AS filename,
  fecha->>'value' AS fecha_emision
FROM my_documents d
CROSS JOIN LATERAL jsonb_array_elements(d.extracted_data->'fields') fecha
WHERE d.user_id = $1
  AND (${entityConditions})
  AND (
    lower(fecha->>'name') LIKE '%fecha_emision%'
    OR lower(fecha->>'label') LIKE '%fecha de emision%'
  )
ORDER BY d.filename, fecha_emision`;
    }

    if (
      normalizedCurrentQuestion.includes('cuanto') ||
      normalizedCurrentQuestion.includes('cuantos')
    ) {
      return `
SELECT COUNT(DISTINCT d.id) AS total_documentos_yolito
FROM my_documents d
WHERE d.user_id = $1
  AND (${entityConditions})`;
    }

    if (
      normalizedCurrentQuestion.includes('numero') &&
      normalizedCurrentQuestion.includes('orden')
    ) {
      return `
SELECT DISTINCT
  d.filename AS filename,
  orden->>'value' AS numero_orden_compra
FROM my_documents d
JOIN my_document_types dt ON d.document_type_id = dt.id
CROSS JOIN LATERAL jsonb_array_elements(d.extracted_data->'fields') orden
WHERE d.user_id = $1
  AND (${entityConditions})
  AND lower(dt.name) LIKE '%orden de compra%'
  AND (
    lower(orden->>'name') LIKE '%numero_orden%'
    OR lower(orden->>'name') LIKE '%numero_oc%'
    OR lower(orden->>'label') LIKE '%numero de orden%'
  )
  AND trim(coalesce(orden->>'value', '')) <> ''
  AND lower(trim(coalesce(orden->>'value', ''))) NOT IN ('sin valor', '—', '-')
ORDER BY d.filename, numero_orden_compra`;
    }

    if (normalizedCurrentQuestion.includes('proveedor')) {
      return `
SELECT DISTINCT
  proveedor->>'value' AS proveedor
FROM my_documents d
CROSS JOIN LATERAL jsonb_array_elements(d.extracted_data->'fields') proveedor
WHERE d.user_id = $1
  AND (${entityConditions})
  AND (
    lower(proveedor->>'name') LIKE '%proveedor%'
    OR lower(proveedor->>'label') LIKE '%proveedor%'
  )
  AND trim(coalesce(proveedor->>'value', '')) <> ''
  AND lower(trim(coalesce(proveedor->>'value', ''))) NOT IN ('sin valor', '—', '-')
ORDER BY proveedor`;
    }

    if (
      normalizedCurrentQuestion.includes('tipo') &&
      normalizedCurrentQuestion.includes('document')
    ) {
      return `
SELECT DISTINCT
  dt.name AS tipo_documento
FROM my_documents d
JOIN my_document_types dt ON d.document_type_id = dt.id
WHERE d.user_id = $1
  AND (${entityConditions})
ORDER BY tipo_documento`;
    }

    return null;
  }

  private extractCurrentQuestion(question: string): string {
    const match = question.match(/Pregunta actual del usuario:\s*([\s\S]*)$/i);
    return match?.[1]?.trim() || question.trim();
  }

  private extractTrackedEntity(question: string): string | null {
    const patterns = [
      /nombre del (?:comprador|proveedor|emisor|cliente)[^.\n]* es ([^\n.]+)/i,
      /documentos de ([^\n?.]+)/i,
      /de ([A-Za-zÁÉÍÓÚáéíóúÑñ0-9 .&_-]{3,})/i,
    ];

    for (const pattern of patterns) {
      const match = question.match(pattern);
      const value = match?.[1]?.trim();
      if (value && !this.isGenericEntityPhrase(value)) {
        return value;
      }
    }

    return null;
  }

  private isGenericEntityPhrase(value: string): boolean {
    const normalized = this.normalizeText(value)
      .replace(/[^a-z0-9\s]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();

    if (!normalized) {
      return true;
    }

    const genericPhrases = [
      'orden de compra',
      'orden de despacho',
      'proveedor',
      'comprador',
      'cliente',
      'emisor',
      'tipo de documento',
      'tipos de documentos',
      'fechas de emision',
      'numero de orden',
      'numeros de orden de compra',
    ];

    return genericPhrases.includes(normalized);
  }

  private buildEntityMatchConditions(entityTerms: string[]): string {
    const termClauses = entityTerms.flatMap((term) => {
      const termLike = this.escapeSqlLike(term);
      return [
        `lower(d.filename) LIKE '%${termLike}%'`,
        `lower(coalesce(d.ocr_raw_text, '')) LIKE '%${termLike}%'`,
        `lower(coalesce(d.extracted_data->>'summary', '')) LIKE '%${termLike}%'`,
        `lower(coalesce(d.inferred_data->>'summary', '')) LIKE '%${termLike}%'`,
        `EXISTS (
          SELECT 1
          FROM jsonb_array_elements(coalesce(d.extracted_data->'fields', '[]'::jsonb)) f
          WHERE lower(coalesce(f->>'value', '')) LIKE '%${termLike}%'
        )`,
        `EXISTS (
          SELECT 1
          FROM jsonb_array_elements(coalesce(d.inferred_data->'key_fields', '[]'::jsonb)) f
          WHERE lower(coalesce(f->>'value', '')) LIKE '%${termLike}%'
        )`,
      ];
    });

    return termClauses.join('\n      OR ');
  }

  private buildEntitySearchTerms(entity: string): string[] {
    const normalized = this.normalizeText(entity)
      .replace(/[^a-z0-9\s]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();

    if (!normalized) {
      return [];
    }

    const words = normalized.split(' ').filter((word) => word.length >= 4);
    const terms = new Set<string>();

    terms.add(normalized);

    if (words.length > 0) {
      terms.add(words[0]);
    }

    if (words.length > 1) {
      terms.add(`${words[0]} ${words[1]}`);
    }

    words.slice(0, 4).forEach((word) => terms.add(word));

    return Array.from(terms);
  }

  private escapeSqlLike(value: string): string {
    return this.normalizeText(value).replace(/'/g, "''").trim();
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
2. Solo lectura. Puedes usar SELECT o WITH ... SELECT. Sin INSERT/UPDATE/DELETE/DROP/ALTER/CREATE/TRUNCATE.
3. LIMIT máximo ${MAX_ROWS}
4. Para campos JSONB usa jsonb_array_elements como se indica arriba
5. JOIN my_document_types si necesitas el nombre del tipo
6. Si la pregunta no es sobre documentos/datos, responde: NO_SQL
7. Una sola query, sin punto y coma
8. Si el usuario usa nombres de roles o etiquetas naturales ("comprador", "emisor", "proveedor", "fecha de emisión"), NO dependas solo del name exacto del campo: usa coincidencias flexibles sobre f->>'name' y f->>'label' con ILIKE/LOWER LIKE
9. Si el usuario menciona una empresa/persona, búscala con coincidencia parcial en f->>'value'
10. TODA expresión calculada o campo extraído debe llevar alias explícito y legible (ej. AS fecha_emision, AS numero_orden_compra, AS proveedor)
11. Si la pregunta está en plural ("cuáles", "cuántos documentos", "números"), devuelve todos los resultados relevantes; no uses LIMIT 1 salvo que el usuario pida un único resultado

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
      .replace(/^\s*sql\s*:\s*/i, '')
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

    if (!/^\s*(SELECT|WITH)\b/i.test(sql)) {
      throw new ForbiddenException(
        'Solo se permiten queries de solo lectura (SELECT o WITH ... SELECT).',
      );
    }

    if (!sql.includes('$1')) {
      throw new ForbiddenException(
        'La query no incluye el parámetro de usuario $1. Rechazada por seguridad.',
      );
    }

    // Enforce tenant-filtered views for chat queries.
    if (!/\bmy_documents\b/i.test(sql) && !/\bmy_document_types\b/i.test(sql)) {
      throw new ForbiddenException(
        'La query debe usar las vistas my_documents o my_document_types.',
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
    let safeSql = this.rewriteTenantViewsAsScopedSubqueries(sql);

    if (!/\bLIMIT\b/i.test(safeSql)) {
      safeSql = safeSql + ` LIMIT ${MAX_ROWS}`;
    }

    return {
      safeSql,
      params: [userId],
    };
  }

  /**
   * Rewrites logical tenant views into tenant-scoped subqueries.
   *
   * Why:
   * - keeps the LLM contract simple (`my_documents`, `my_document_types`)
   * - preserves tenant isolation even if the DB views were not applied yet
   * - avoids production/QA drift due to manual RLS/view rollout gaps
   */
  private rewriteTenantViewsAsScopedSubqueries(sql: string): string {
    const rewriteRelation = (
      input: string,
      logicalName: 'my_documents' | 'my_document_types',
      physicalTable: 'documents' | 'document_types',
      defaultAlias: string,
    ) =>
      input.replace(
        new RegExp(
          `\\b(FROM|JOIN)\\s+${logicalName}(?:\\s+(?:AS\\s+)?(?!WHERE\\b|JOIN\\b|ON\\b|GROUP\\b|ORDER\\b|LIMIT\\b|OFFSET\\b|HAVING\\b|UNION\\b)([a-zA-Z_][\\w]*))?`,
          'gi',
        ),
        (_, clause: string, alias?: string) =>
          `${clause} (SELECT * FROM ${physicalTable} WHERE user_id = $1) ${alias || defaultAlias}`,
      );

    let rewritten = sql;
    rewritten = rewriteRelation(
      rewritten,
      'my_documents',
      'documents',
      'my_documents',
    );
    rewritten = rewriteRelation(
      rewritten,
      'my_document_types',
      'document_types',
      'my_document_types',
    );

    return rewritten;
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
      // Capa 2 de aislamiento multi-tenant: RLS via variable de sesión
      // Aunque la IA olvide el filtro WHERE user_id, la DB rechaza filas ajenas
      await queryRunner.query(
        `SELECT set_config('app.current_user_id', $1, true)`,
        [String(params[0])],
      );

      const rows = await queryRunner.query(sql, params);

      await queryRunner.query('COMMIT');

      const normalizedRows = Array.isArray(rows)
        ? rows.slice(0, MAX_ROWS).map((row) => this.normalizeRowKeys(row))
        : [];

      this.logger.log(`Query executed: ${normalizedRows.length} rows returned`);
      return normalizedRows;
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
      const normalizedKey = this.normalizeText(k.replace(/_/g, ' '));

      // Format epoch milliseconds as readable dates
      if (TIMESTAMP_FIELDS.has(k) || normalizedKey.includes('fecha')) {
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

    // Single column — just list values (omit column name header for cleaner output)
    if (displayKeys.length === 1) {
      const values = rows.map((r) => formatValue(displayKeys[0], r[displayKeys[0]]));
      // If only one value, return it directly without bullet
      if (values.length === 1) return values[0];
      return values.map((v) => `• ${v}`).join('\n');
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

  private normalizeRowKeys(row: Record<string, any>): Record<string, any> {
    const normalized: Record<string, any> = {};
    let unnamedIndex = 1;

    for (const [rawKey, value] of Object.entries(row)) {
      let key = rawKey;

      if (!key || key === '?column?') {
        key = unnamedIndex === 1 ? 'valor' : `valor_${unnamedIndex}`;
        unnamedIndex += 1;
      }

      normalized[key] = value;
    }

    return normalized;
  }
}
