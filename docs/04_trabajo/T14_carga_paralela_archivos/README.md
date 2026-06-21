# T14 — Carga paralela de archivos

## Estado actual

- Spec: `docs/03_specs/active/SPEC-14_carga_paralela_archivos.md`
- Branch de trabajo: `codex/spec-14-carga-paralela`
- Objetivo de esta carpeta: dejar evidencia reproducible de throughput y estabilidad.

## Cambios implementados (sesión actual)

- Paralelismo controlado en `uploadAndQueueBatch` (subida de archivos).
- Procesamiento background por `documentId` precreado (sin duplicados).
- Progreso real por archivo durante procesamiento (backend + frontend).
- Labels de estado orientados a usuario final.
- Persistencia de `processingStep` en entidad `documents`.

## Verificación técnica realizada

- `cd backend && pnpm run build` ✅
- `cd frontend && pnpm run build` ✅

## Benchmark antes/después (pendiente de ejecución manual)

Usar el script:

- `node docs/04_trabajo/T14_carga_paralela_archivos/benchmark-upload-batch.mjs --baseUrl http://localhost:4000/api --token <JWT> --dir <CARPETA_20_ARCHIVOS> --runs 3`

Guardar resultados en:

- `docs/04_trabajo/T14_carga_paralela_archivos/benchmark-results.md`

## Criterios SPEC-14 y estado

- Lotes 20+ sin bloquear UI: `En validación manual`.
- Error de 1 archivo no cancela lote: `En validación manual`.
- Estado por archivo visible: `Implementado`.
- Límites tamaño/tipo/plan: `Implementado (validación adicional pendiente en benchmark)`.
