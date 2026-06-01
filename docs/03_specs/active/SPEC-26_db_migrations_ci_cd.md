# SPEC-26 — Migraciones DB seguras en CI/CD

| Campo | Valor |
|---|---|
| ID | T26 / SPEC-26 |
| Estado | Disponible para agente |
| Owner | Smith / agente |
| Prioridad | Alta |
| Última actualización | 2026-06-01 |
| Spec relacionado | `docs/07_runbooks/branch-flow.md`, `docs/07_runbooks/deploy.md` |

## Objetivo

Eliminar el riesgo de cambios automáticos/no trazables de esquema en QA y producción, dejando un flujo versionado de migraciones de base de datos integrado al CI/CD `dev → qa → master`.

## Contexto

ONAI OCR usa PostgreSQL separado por ambiente:

- QA: `/docker/onai-ocr-qa`, DB `qa_onai_ocr`.
- Producción: `/docker/onai-ocr`, DB `onai_ocr`.

El backend actual usa TypeORM y mantiene `synchronize: true`, lo que puede modificar esquema al arrancar sin trazabilidad suficiente. Esto no es aceptable para QA/prod.

Antes de migrar a Prisma, se debe estabilizar el mecanismo actual de migraciones para evitar sustos en producción.

## Alcance incluido

- Desactivar `synchronize: true` para QA/prod.
- Configurar migrations TypeORM explícitas en el backend.
- Agregar scripts mínimos:
  - `db:migrate`
  - `db:revert`
  - `db:show` o equivalente.
- Integrar ejecución de migraciones en workflow QA antes/después del deploy según diseño seguro.
- Integrar ejecución de migraciones en workflow producción con backup previo obligatorio.
- Documentar rollback operativo.
- Actualizar runbook de deploy con sección DB.
- Verificar que QA y producción mantengan DB separadas.

## Fuera de alcance

- Migrar TypeORM a Prisma.
- Cambios funcionales de modelo de datos no necesarios para habilitar migrations.
- Copiar datos QA hacia producción.
- Ejecutar deletes destructivos sin aprobación explícita.

## Archivos/módulos relevantes

- `backend/src/app.module.ts`
- `backend/src/database/migrations/`
- `backend/package.json`
- `.github/workflows/deploy-qa.yml`
- `.github/workflows/deploy-master.yml`
- `/docker/onai-ocr-qa/docker-compose.yml` solo para validar runtime
- `/docker/onai-ocr/docker-compose.yml` solo para validar runtime
- `docs/07_runbooks/deploy.md`
- `docs/07_runbooks/branch-flow.md`

## Criterios de aceptación

- `synchronize` no opera automáticamente en QA/prod.
- Existe mecanismo versionado y repetible para aplicar migraciones.
- QA ejecuta migraciones contra Postgres QA, no prod.
- Producción ejecuta migraciones contra Postgres prod, con backup previo.
- Un cambio de schema puede probarse en QA y luego promoverse a producción sin comandos manuales improvisados.
- El runbook deja claro que no se promueven dumps de QA a prod; se promueven migraciones versionadas.

## Plan de prueba / verificación mínima

- Build backend OK.
- Ejecutar `db:show`/equivalente contra QA.
- Aplicar una migración no destructiva de prueba en QA o validar una migration existente en ambiente controlado.
- Confirmar health QA: `curl -fsS https://qa-ocr.moti.cl/api/auth/health`.
- Confirmar health prod después de deploy real: `curl -fsS https://ocr.moti.cl/api/auth/health`.
- Revisar logs backend tras migración.

## Riesgos y rollback

- Riesgo: migración incompatible con datos reales.
  - Mitigación: probar en QA, usar migraciones idempotentes cuando aplique, backup antes de prod.
- Riesgo: downtime por lock de tabla.
  - Mitigación: preferir migraciones expand/contract, evitar operaciones largas en horario crítico.
- Rollback: restaurar backup o ejecutar `db:revert` solo si la migración tiene `down` seguro y probado.

## Reporte esperado del agente

- Archivos consultados.
- Archivos modificados.
- Comandos ejecutados.
- Evidencia de prueba QA/prod.
- Estado de workflows.
- Riesgos/dudas.
- Cambio sugerido en `PLAN_MAESTRO.md`.
