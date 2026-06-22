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
});
