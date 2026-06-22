# T20 — Benchmark baseline vs híbrido

## Escenario

- Entorno: local con backend + PostgreSQL + Neo4j.
- Dataset: mínimo 20 documentos en 2+ tipos por tenant.
- Usuario de prueba: __________________

## Consultas de prueba

1. "¿Qué documentos de tipo factura comparten proveedor con boletas?"
2. "¿Qué tipos de documentos tienen más campos en común?"
3. "¿Qué relaciones hay entre contratos y anexos?"
4. "¿Qué documentos están conectados por el campo rut?"

## Registro de resultados

| # | Modo | Latencia total (ms) | Calidad (1-5) | Observaciones |
|---|---|---:|---:|---|
| 1 | SQL |  |  |  |
| 1 | Híbrido |  |  |  |
| 2 | SQL |  |  |  |
| 2 | Híbrido |  |  |  |
| 3 | SQL |  |  |  |
| 3 | Híbrido |  |  |  |
| 4 | SQL |  |  |  |
| 4 | Híbrido |  |  |  |

## Criterio de éxito sugerido

- Calidad híbrida >= SQL en 3/4 consultas.
- Latencia p95 híbrida <= 2.5x baseline SQL.
- Sin errores fatales en fallback.
