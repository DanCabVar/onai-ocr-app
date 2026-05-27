# SPEC-10 — Inferir desde Muestras: paralelismo y progreso SSE

## Tarea relacionada

- `T10` Inferir desde Muestras: paralelismo 10+ docs + progreso SSE.
- MC2: `PENDIENTE: Aumentar paralelo en Inferir desde Muestras a 10+ docs`.

## Objetivo

Mejorar el flujo “Inferir desde Muestras” para procesar 10+ documentos con mejor throughput y feedback visible en tiempo real, sin disparar rate limits ni costos inesperados.

## Estado conocido MC2

MC2 pide ajustar semáforos en `document-type-inference.service.ts`:

- OCR: `3 → 5`
- classify: `5 → 10`
- extract: `3 → 5`
- agregar progress events SSE para feedback en tiempo real.

## Alcance

Incluye:

- auditar implementación actual antes de cambiar límites;
- ajustar concurrencia con semáforos configurables o constantes claras;
- backoff/retry razonable ante rate limits/transient errors;
- eventos de progreso por documento/fase vía SSE o mecanismo equivalente existente;
- UI que muestre progreso real o al menos estados por fase;
- logs suficientes para diagnosticar cuellos de botella.

Excluye:

- rediseñar completo el pipeline OCR;
- cambiar proveedor IA/OCR;
- procesamiento masivo enterprise sin límites de plan.

## Archivos/módulos probables

- `backend/src/**/document-type-inference.service.ts`
- `backend/src/**/documents*`
- `frontend/components/**InferFromSamples**`
- `frontend/app/**document-types**`

## Criterios de aceptación

- Procesa 10+ muestras sin bloquear la UI ni terminar en timeout por defecto.
- El usuario ve progreso por fase o por documento.
- Errores parciales quedan reportados sin perder todo el lote si es recuperable.
- Concurrencia queda documentada y fácil de ajustar.
- No se observan ráfagas sin control contra Mistral/Gemini.

## Verificación mínima

- `cd backend && pnpm run build`.
- `cd frontend && pnpm run build` si cambia UI.
- Prueba manual o script con 10+ documentos de muestra.
- Evidencia de logs/progreso.

## Riesgos

- Rate limits Mistral/Gemini.
- Costos por reintentos agresivos.
- SSE roto detrás de Traefik si no se configuran headers/timeouts correctamente.
- Progreso falso si frontend solo estima y backend no emite eventos reales.
