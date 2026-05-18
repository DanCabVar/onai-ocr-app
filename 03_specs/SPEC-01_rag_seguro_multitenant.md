# SPEC-01 — RAG seguro multi-tenant

## Tarea relacionada

- `T08` Hardening multi-tenant/RAG seguro.

## Objetivo

Auditar y asegurar que el chat/RAG no pueda filtrar datos entre usuarios/tenants aunque la IA genere SQL incorrecto.

## Alcance

Incluye:

- verificar RLS en tablas sensibles;
- verificar vistas filtradas `my_*` si existen;
- verificar que backend setea contexto de usuario antes de queries;
- verificar que prompts/tools no exponen tablas directas;
- agregar tests de aislamiento si faltan.

Excluye:

- rediseño completo de RAG semántico/pgvector, salvo hallazgos críticos.

## Archivos/módulos probables

- `backend/src/**/chat*`
- `backend/src/**/rag*`
- `backend/src/**/database*`
- migraciones/SQL/TypeORM/Prisma según implementación real

## Criterios de aceptación

- RLS o mecanismo equivalente activo en producción/desarrollo.
- El usuario A no puede consultar documentos del usuario B.
- La IA solo consulta vistas/scope permitido.
- Hay test o script reproducible que demuestre aislamiento.
- Riesgos residuales quedan documentados.

## Verificación mínima

- Query DB inspeccionando políticas/vistas.
- Test backend o script manual con dos usuarios.
- Build backend si se modifica código.

## Riesgos

- Falsa sensación de seguridad si MC2 marcó la tarea done pero la DB productiva no tiene políticas.
- SQL generado por IA puede saltarse filtros si no hay defensa en DB.
