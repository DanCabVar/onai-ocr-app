# SPEC-27 — Migración controlada de TypeORM a Prisma

| Campo | Valor |
|---|---|
| ID | T27 / SPEC-27 |
| Estado | Backlog |
| Owner | Smith / agente |
| Prioridad | Media-Alta |
| Última actualización | 2026-06-01 |
| Spec relacionado | `SPEC-26_db_migrations_ci_cd.md` |

## Objetivo

Migrar el backend de ONAI OCR desde TypeORM a Prisma de forma controlada, con schema central versionado, mejor DX para agentes y migraciones más predecibles.

## Contexto

La decisión arquitectónica preferida para proyectos ONAI es PostgreSQL + Prisma. El código actual de ONAI OCR usa TypeORM con entities y repositories.

Prisma conviene para este proyecto porque:

- deja un `schema.prisma` central fácil de auditar;
- mejora trazabilidad de cambios de DB;
- reduce ambigüedad para agentes/subagentes;
- facilita migrations versionadas;
- evita depender de `synchronize`/entities como fuente implícita del esquema.

No debe ejecutarse antes de SPEC-26, porque primero necesitamos estabilizar migraciones y despliegue DB.

## Alcance incluido

- Levantar inventario de entities TypeORM actuales:
  - `User`
  - `Document`
  - `DocumentType`
  - `Subscription`
  - otras que existan al momento de ejecutar.
- Generar `schema.prisma` representando el schema real vigente.
- Crear `PrismaService` para NestJS.
- Migrar repositorios/servicios módulo por módulo.
- Reemplazar `TypeOrmModule` gradualmente.
- Mantener compatibilidad con datos existentes.
- Definir estrategia de migraciones Prisma desde el estado actual de producción.
- Ejecutar QA completo antes de promover a producción.

## Fuera de alcance

- Rediseñar producto o modelo de negocio.
- Cambios destructivos de datos no estrictamente necesarios.
- Copiar datos QA hacia producción.
- Reescritura simultánea de frontend.
- Optimización avanzada de queries RAG/SQL salvo ajustes necesarios para compatibilidad.

## Archivos/módulos relevantes

- `backend/src/app.module.ts`
- `backend/src/database/entities/`
- `backend/src/**/*.service.ts`
- `backend/src/**/*.module.ts`
- `backend/package.json`
- `backend/prisma/`
- `backend/src/chat/sql-rag.service.ts`
- `backend/src/documents/`
- `backend/src/document-types/`
- `backend/src/auth/`
- `backend/src/subscriptions/`
- `backend/src/stripe/`

## Criterios de aceptación

- Backend compila sin TypeORM como dependencia runtime principal.
- Prisma Client queda generado y usado por los servicios principales.
- `schema.prisma` representa el schema real vigente.
- Migraciones Prisma están definidas o baselineadas correctamente desde DB existente.
- QA pasa health check y flujo funcional mínimo:
  - login/auth;
  - listar/subir documentos;
  - tipos de documento;
  - suscripción/límites si aplica;
  - chat/RAG si aplica.
- No hay pérdida de datos en QA ni producción.
- Producción se promueve solo después de QA OK.

## Plan de prueba / verificación mínima

- `pnpm install --frozen-lockfile`.
- `pnpm --filter backend build` o comando equivalente vigente.
- Prisma generate OK.
- Migraciones/baseline validadas contra QA.
- Health QA: `curl -fsS https://qa-ocr.moti.cl/api/auth/health`.
- Smoke funcional QA manual o Playwright si ya existe.
- Health producción después de promover: `curl -fsS https://ocr.moti.cl/api/auth/health`.

## Riesgos y rollback

- Riesgo alto: cambio transversal de acceso a datos.
  - Mitigación: migración por módulos, pruebas por flujo, PR/branch dedicada.
- Riesgo: schema Prisma no calza con DB real.
  - Mitigación: introspección inicial y comparación manual con entities/migrations.
- Riesgo: queries SQL/RAG especiales se rompen.
  - Mitigación: mantener raw SQL controlado donde Prisma no sea suficiente.
- Rollback: mantener rama TypeORM estable hasta validar Prisma; no eliminar código TypeORM hasta cierre completo.

## Reporte esperado del agente

- Inventario de entities/servicios migrados.
- Archivos consultados.
- Archivos modificados.
- Comandos ejecutados.
- Evidencia de build/test/smoke.
- Riesgos/dudas.
- Cambio sugerido en `PLAN_MAESTRO.md`.
