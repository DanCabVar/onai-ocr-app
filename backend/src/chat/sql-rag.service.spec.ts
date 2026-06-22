import { ForbiddenException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DataSource } from 'typeorm';
import { SqlRagService } from './sql-rag.service';

jest.mock('@google/generative-ai', () => ({
  GoogleGenerativeAI: jest.fn().mockImplementation(() => ({
    getGenerativeModel: jest.fn().mockReturnValue({
      generateContent: jest.fn(),
    }),
  })),
}));

describe('SqlRagService tenant isolation', () => {
  const createService = () => {
    const configService = {
      get: jest.fn((key: string) => {
        if (key === 'GOOGLE_AI_API_KEY') return 'test-key';
        if (key === 'GEMINI_MODEL') return 'gemini-test';
        return undefined;
      }),
    } as unknown as ConfigService;

    const queryRunner = {
      connect: jest.fn(),
      query: jest.fn(),
      release: jest.fn(),
    };

    const dataSource = {
      createQueryRunner: jest.fn(() => queryRunner),
    } as unknown as DataSource;

    const documentRepository = {} as any;
    const documentTypeRepository = {} as any;

    const service = new SqlRagService(
      configService,
      dataSource,
      documentRepository,
      documentTypeRepository,
    );

    return { service, queryRunner };
  };

  it('rejects SQL without user placeholder $1', () => {
    const { service } = createService();
    expect(() =>
      (service as any).validateSql(
        'SELECT COUNT(*) FROM my_documents WHERE user_id = 7',
      ),
    ).toThrow(ForbiddenException);
  });

  it('rejects direct table access instead of tenant views', () => {
    const { service } = createService();
    expect(() =>
      (service as any).validateSql(
        'SELECT COUNT(*) FROM documents WHERE user_id = $1',
      ),
    ).toThrow(ForbiddenException);
  });

  it('sets tenant context with parameterized set_config before query', async () => {
    const { service, queryRunner } = createService();
    queryRunner.query
      .mockResolvedValueOnce(undefined) // BEGIN READ ONLY
      .mockResolvedValueOnce(undefined) // SET LOCAL statement_timeout
      .mockResolvedValueOnce(undefined) // SELECT set_config(...)
      .mockResolvedValueOnce([{ total: 3 }]) // main query
      .mockResolvedValueOnce(undefined); // COMMIT

    const rows = await (service as any).executeSql(
      'SELECT COUNT(*) AS total FROM my_documents WHERE user_id = $1',
      [42],
    );

    expect(rows).toEqual([{ total: 3 }]);
    expect(queryRunner.query).toHaveBeenCalledWith(
      `SELECT set_config('app.current_user_id', $1, true)`,
      ['42'],
    );
  });

  it('rewrites tenant views to scoped subqueries before execution', () => {
    const { service } = createService();

    const prepared = (service as any).prepareSafeQuery(
      'SELECT COUNT(*) AS total FROM my_documents d JOIN my_document_types dt ON d.document_type_id = dt.id WHERE d.user_id = $1',
      42,
    );

    expect(prepared.safeSql).toContain(
      '(SELECT * FROM documents WHERE user_id = $1) d',
    );
    expect(prepared.safeSql).toContain(
      '(SELECT * FROM document_types WHERE user_id = $1) dt',
    );
    expect(prepared.params).toEqual([42]);
  });

  it('adds a default alias when the generated SQL uses my_documents without alias', () => {
    const { service } = createService();

    const prepared = (service as any).prepareSafeQuery(
      'SELECT COUNT(*) AS total FROM my_documents WHERE user_id = $1',
      42,
    );

    expect(prepared.safeSql).toContain(
      'FROM (SELECT * FROM documents WHERE user_id = $1) my_documents',
    );
  });

  it('allows read-only CTE queries that start with WITH', () => {
    const { service } = createService();

    expect(() =>
      (service as any).validateSql(
        `WITH docs AS (
          SELECT filename
          FROM my_documents
          WHERE user_id = $1
        )
        SELECT filename FROM docs`,
      ),
    ).not.toThrow();
  });

  it('normalizes unnamed result columns for frontend display', () => {
    const { service } = createService();

    const normalized = (service as any).normalizeRowKeys({
      '?column?': '052_00514607-1',
    });

    expect(normalized).toEqual({
      valor: '052_00514607-1',
    });
  });

  it('builds deterministic provider query for follow-up questions with entity context', () => {
    const { service } = createService();

    const sql = (service as any).buildDeterministicFieldQuery(`
Contexto reciente de la conversación:

Usuario: puedes darme las fechas de emisión de los documentos de Yolito
Asistente: La fecha de emisión para los documentos de Yolito es el 22 de septiembre de 2025.
Usuario: el nombre del comprador es Yolito Balart Hnos. Ltda.

Pregunta actual del usuario: ¿y cuál es el proveedor?
`);

    expect(sql).toContain('AS proveedor');
    expect(sql).toContain('EXISTS');
    expect(sql).toContain("lower(proveedor->>'name') LIKE '%nombre%'");
    expect(sql).toContain("lower(proveedor->>'label') LIKE '%nombre%'");
    expect(sql).toContain("NOT IN ('sin valor', '—', '-')");
    expect(sql).toContain('ORDER BY proveedor');
  });

  it('builds deterministic date query with distinct rows to avoid duplicates', () => {
    const { service } = createService();

    const sql = (service as any).buildDeterministicFieldQuery(
      'puedes darme las fechas de emisión de los documentos de Yolito',
    );

    expect(sql).toContain('SELECT DISTINCT');
    expect(sql).toContain("AS fecha_emision");
    expect(sql).toContain('ORDER BY d.filename, fecha_emision');
  });

  it('builds deterministic purchase-order query scoped to purchase-order docs only', () => {
    const { service } = createService();

    const sql = (service as any).buildDeterministicFieldQuery(
      '¿y cuáles son sus números de orden de compra?',
    );

    expect(sql).toBeNull();

    const contextualSql = (service as any).buildDeterministicFieldQuery(`
Contexto reciente de la conversación:

Usuario: puedes darme las fechas de emisión de los documentos de Yolito
Asistente: ok
Usuario: el nombre del comprador es Yolito Balart Hnos. Ltda.

Pregunta actual del usuario: ¿y cuáles son sus números de orden de compra?
`);

    expect(contextualSql).toContain("lower(dt.name) LIKE '%orden de compra%'");
    expect(contextualSql).toContain("NOT IN ('sin valor', '—', '-')");
    expect(contextualSql).toContain('AS numero_orden_compra');
  });
});
