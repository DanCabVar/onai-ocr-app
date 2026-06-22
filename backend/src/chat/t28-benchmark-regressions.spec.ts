import { ConfigService } from '@nestjs/config';
import { DataSource } from 'typeorm';
import { SqlRagService } from './sql-rag.service';
import { QueryIntentService } from './query-intent.service';
import { FieldResolutionService } from './field-resolution.service';

jest.mock('@google/generative-ai', () => ({
  GoogleGenerativeAI: jest.fn().mockImplementation(() => ({
    getGenerativeModel: jest.fn().mockReturnValue({
      generateContent: jest.fn(),
    }),
  })),
}));

/**
 * Regresiones automáticas para los casos T28-003 a T28-007 del benchmark
 * (`docs/04_trabajo/T28_calidad_chatbot_documental/benchmark_v1.csv`).
 *
 * No invocan al LLM ni a la base de datos: validan que la ruta determinística
 * (intención + resolución de campos) produce SQL semánticamente correcto y
 * aislado por tenant ($1) para cada intención crítica, evitando la mezcla de
 * campos relacionados (proveedor vs rut/correo/teléfono) y los valores basura.
 */
describe('T28 benchmark regressions (deterministic chat path)', () => {
  const createService = () => {
    const configService = {
      get: jest.fn((key: string) => {
        if (key === 'GOOGLE_AI_API_KEY') return 'test-key';
        if (key === 'GEMINI_MODEL') return 'gemini-test';
        return undefined;
      }),
    } as unknown as ConfigService;

    const dataSource = {
      createQueryRunner: jest.fn(),
    } as unknown as DataSource;

    const service = new SqlRagService(
      configService,
      dataSource,
      {} as any,
      {} as any,
      new QueryIntentService(),
      new FieldResolutionService(),
    );

    return service;
  };

  /** Reconstruye la pregunta contextual como lo hace ChatService. */
  const buildContextualQuery = (
    history: string[],
    currentQuestion: string,
  ): string => {
    if (history.length === 0) {
      return currentQuestion;
    }
    return [
      'Contexto reciente de la conversación:',
      history.join('\n'),
      `Pregunta actual del usuario: ${currentQuestion}`,
      'Resuelve la pregunta actual usando el contexto anterior cuando haga falta, pero sin inventar datos.',
    ].join('\n\n');
  };

  const buildSql = (history: string[], question: string): string => {
    const service = createService();
    return (service as any).buildDeterministicFieldQuery(
      buildContextualQuery(history, question),
    );
  };

  it('T28-003: fechas de emisión de Yolito → deduplicadas y ancladas a la entidad', () => {
    const sql = buildSql(
      [],
      'puedes darme las fechas de emisión de los documentos de Yolito',
    );

    expect(sql).not.toBeNull();
    expect(sql).toContain('d.user_id = $1');
    expect(sql).toContain('SELECT DISTINCT');
    expect(sql).toContain('AS fecha_emision');
    // Anclado a la entidad detectada (Yolito), no a todo el tenant
    expect(sql).toContain("lower(d.filename) LIKE '%yolito%'");
    // Campo de fecha correcto, excluyendo fechas no de emisión
    expect(sql).toContain("lower(fecha->>'name') LIKE '%fecha%'");
    expect(sql).toContain("NOT LIKE '%entrega%'");
  });

  it('T28-004: conteo de documentos de Yolito en follow-up → COUNT DISTINCT', () => {
    const sql = buildSql(
      ['Usuario: puedes darme las fechas de emisión de los documentos de Yolito'],
      '¿y cuántos documentos de Yolito tengo?',
    );

    expect(sql).not.toBeNull();
    expect(sql).toContain('d.user_id = $1');
    expect(sql).toContain('COUNT(DISTINCT d.id)');
    expect(sql).toContain("lower(d.filename) LIKE '%yolito%'");
    // No debe reusar el alias acoplado al dataset anterior
    expect(sql).not.toContain('total_documentos_yolito');
  });

  it('T28-005: números de orden de compra → solo tipo OC, sin numero_oc_mts ni vacíos', () => {
    const history = [
      'Usuario: puedes darme las fechas de emisión de los documentos de Yolito',
      'Usuario: el nombre del comprador es Yolito Balart Hnos. Ltda.',
    ];
    const sql = buildSql(history, '¿y cuáles son sus números de orden de compra?');

    expect(sql).not.toBeNull();
    expect(sql).toContain('d.user_id = $1');
    expect(sql).toContain('AS numero_orden_compra');
    // Restringido al tipo documental correcto
    expect(sql).toContain("lower(dt.name) LIKE '%orden de compra%'");
    // No mezcla el correlativo interno numero_oc_mts (forbidden 054_00655119)
    expect(sql).toContain("NOT LIKE '%oc_mts%'");
    // Sin valores vacíos ni placeholders sintéticos
    expect(sql).toContain("NOT IN ('sin valor', '—', '-')");
    // Anclado a la entidad del comprador (Yolito)
    expect(sql).toContain("lower(d.filename) LIKE '%yolito%'");
  });

  it('T28-006: proveedor → nombre del proveedor, nunca rut/correo/teléfono', () => {
    const history = [
      'Usuario: el nombre del comprador es Yolito Balart Hnos. Ltda.',
    ];
    const sql = buildSql(history, '¿y cuál es el proveedor?');

    expect(sql).not.toBeNull();
    expect(sql).toContain('d.user_id = $1');
    expect(sql).toContain('AS proveedor');
    // Exige nombre + proveedor (no basta cualquier campo de proveedor)
    expect(sql).toContain("lower(proveedor->>'name') LIKE '%nombre%'");
    expect(sql).toContain("lower(proveedor->>'name') LIKE '%proveedor%'");
    // Excluye explícitamente campos cercanos prohibidos por el benchmark
    expect(sql).toContain("NOT LIKE '%rut%'");
    expect(sql).toContain("NOT LIKE '%correo%'");
    expect(sql).toContain("NOT LIKE '%telefono%'");
    // Sin valores vacíos
    expect(sql).toContain("NOT IN ('sin valor', '—', '-')");
  });

  it('T28-007: tipos de documento de Yolito → deduplicados', () => {
    const history = [
      'Usuario: el nombre del comprador es Yolito Balart Hnos. Ltda.',
    ];
    const sql = buildSql(history, '¿y qué tipos de documentos de Yolito tengo?');

    expect(sql).not.toBeNull();
    expect(sql).toContain('d.user_id = $1');
    expect(sql).toContain('SELECT DISTINCT');
    expect(sql).toContain('dt.name AS tipo_documento');
    expect(sql).toContain("lower(d.filename) LIKE '%yolito%'");
  });

  it('T28-008: cliente de un documento puntual → campo cliente, anclado al archivo exacto', () => {
    const sql = buildSql([], '¿Quién es el cliente en OC_Yolito.pdf?');

    expect(sql).not.toBeNull();
    expect(sql).toContain('d.user_id = $1');
    expect(sql).toContain('AS cliente');
    // Anclaje exacto al archivo (no arrastra OC_Yolito2.pdf)
    expect(sql).toContain("lower(d.filename) LIKE '%oc_yolito.pdf%'");
    expect(sql).not.toContain("LIKE '%oc_yolito2.pdf%'");
    // No confunde cliente con rut/correo/teléfono
    expect(sql).toContain("lower(cliente->>'name') LIKE '%cliente%'");
    expect(sql).toContain("NOT LIKE '%rut%'");
    expect(sql).toContain("NOT IN ('sin valor', '—', '-')");
  });

  it('T28-009: proveedor de un documento puntual → anclado al archivo exacto', () => {
    const sql = buildSql([], '¿Quién es el proveedor en OC_Yolito2.pdf?');

    expect(sql).not.toBeNull();
    expect(sql).toContain('d.user_id = $1');
    expect(sql).toContain('AS proveedor');
    expect(sql).toContain("lower(d.filename) LIKE '%oc_yolito2.pdf%'");
    expect(sql).toContain("lower(proveedor->>'name') LIKE '%nombre%'");
    expect(sql).toContain("NOT LIKE '%correo%'");
  });

  it('T28-010: fecha de emisión de un documento puntual → anclado al archivo exacto', () => {
    const sql = buildSql([], '¿Qué fecha de emisión tiene OC_Yolito2.pdf?');

    expect(sql).not.toBeNull();
    expect(sql).toContain('d.user_id = $1');
    expect(sql).toContain('AS fecha_emision');
    expect(sql).toContain("lower(d.filename) LIKE '%oc_yolito2.pdf%'");
  });

  it('T28-011: total de la OC → campo total, nunca el neto', () => {
    const sql = buildSql([], '¿Cuál es el total de la orden de compra de Yolito2?');

    expect(sql).not.toBeNull();
    expect(sql).toContain('d.user_id = $1');
    expect(sql).toContain('AS total');
    expect(sql).toContain("lower(tot->>'name') LIKE '%total%'");
    // Excluye el neto (forbidden 559.200 como total final)
    expect(sql).toContain("NOT LIKE '%neto%'");
    expect(sql).toContain("NOT IN ('sin valor', '—', '-')");
    // Anclado a Yolito2 tras depurar la entidad ruidosa
    expect(sql).toContain("lower(d.filename) LIKE '%yolito2%'");
  });

  it('T28-001: conteo total sin entidad → COUNT DISTINCT a nivel de tenant', () => {
    const sql = buildSql([], '¿Cuántos documentos tengo?');

    expect(sql).not.toBeNull();
    expect(sql).toContain('d.user_id = $1');
    expect(sql).toContain('COUNT(DISTINCT d.id)');
    // Sin entidad: no debe inyectar un filtro de entidad ruidoso
    expect(sql).not.toContain('AND (lower(d.filename)');
  });

  it('T28-002: tipos de documento sin entidad → lista deduplicada del tenant', () => {
    const sql = buildSql([], '¿Qué tipos de documentos tengo?');

    expect(sql).not.toBeNull();
    expect(sql).toContain('d.user_id = $1');
    expect(sql).toContain('SELECT DISTINCT');
    expect(sql).toContain('dt.name AS tipo_documento');
    expect(sql).not.toContain("LIKE '%tengo%'");
  });

  it('T28-012: proveedores sin entidad → nombres deduplicados, sin rut/correo', () => {
    const sql = buildSql([], '¿Qué proveedores aparecen en mis órdenes de compra?');

    expect(sql).not.toBeNull();
    expect(sql).toContain('d.user_id = $1');
    expect(sql).toContain('AS proveedor');
    expect(sql).toContain("lower(proveedor->>'name') LIKE '%nombre%'");
    expect(sql).toContain("NOT LIKE '%rut%'");
    expect(sql).toContain("NOT LIKE '%correo%'");
    expect(sql).toContain("NOT IN ('sin valor', '—', '-')");
  });

  it('T28-013: órdenes de compra de Sodimac → ruta OC anclada a la entidad depurada', () => {
    const sql = buildSql([], '¿Qué órdenes de compra tengo de Sodimac?');

    expect(sql).not.toBeNull();
    expect(sql).toContain('d.user_id = $1');
    expect(sql).toContain('AS numero_orden_compra');
    expect(sql).toContain("lower(dt.name) LIKE '%orden de compra%'");
    // La entidad ruidosa ("compra tengo de Sodimac") se depura a "sodimac"
    expect(sql).toContain("lower(d.filename) LIKE '%sodimac%'");
    expect(sql).not.toContain("LIKE '%tengo%'");
  });
});
