# SPEC-19 — Revisión de separación por tenant

## Tarea relacionada

- `T19` Auditar aislamiento multi-tenant end-to-end.

## Objetivo

Verificar técnicamente que no exista fuga de datos entre tenants en API, consultas SQL/RAG, storage y capas de UI.

## Alcance

Incluye:

- auditoría de entidades, queries y guards por `user_id`/tenant;
- validación de endpoints críticos con pruebas de acceso cruzado;
- revisión de RLS y vistas (si aplica en la DB productiva);
- hardening de casos detectados.

Excluye:

- rediseño total de arquitectura multi-tenant.

## Archivos/módulos probables

- `backend/src/**/*.service.ts`
- `backend/src/**/*.controller.ts`
- `backend/prisma/migrations/manual_rls_and_views.sql`
- `backend/scripts/apply-rls.sh`
- `backend/src/chat/sql-rag.service.ts`

## Criterios de aceptación

- No se puede acceder a documentos/tipos/subscripciones de otro tenant.
- Queries de chat/RAG no retornan datos cruzados.
- Hallazgos y mitigaciones quedan documentados.
- Se agregan pruebas de regresión para escenarios de fuga.

## Verificación mínima

- pruebas manuales y automatizadas con 2 usuarios/tenants;
- revisión de logs de acceso denegado y consultas SQL;
- `cd backend && pnpm run build` + tests relevantes.

## Riesgos

- falsa sensación de seguridad si solo se valida capa API y no DB.
- deuda en consultas SQL dinámicas.
- cambios de seguridad con potencial impacto en funcionalidades existentes.

