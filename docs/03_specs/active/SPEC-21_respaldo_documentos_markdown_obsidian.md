# SPEC-21 — Respaldo de documentos en Markdown (Obsidian)

## Tarea relacionada

- `T21` Generar respaldo `.md` por documento para base de conocimiento.

## Objetivo

Crear respaldo automático en formato Markdown por cada documento procesado, compatible con Obsidian, para consulta humana, trazabilidad y recuperación operativa.

## Alcance

Incluye:

- definir estructura de vault/carpeta y naming de archivos `.md`;
- exportar metadatos, resumen, campos extraídos y enlaces al archivo fuente;
- estrategia de versionado/actualización cuando un documento se reprocesa;
- opción de almacenamiento local o bucket dedicado para backups md.

Excluye:

- sustituir la DB como fuente de verdad;
- sincronización avanzada de notas manuales de usuarios.

## Archivos/módulos probables

- `backend/src/documents/services/document-processing.service.ts`
- `backend/src/documents/documents.service.ts`
- posible módulo nuevo: `backend/src/documents/services/markdown-backup.service.ts`
- `docs/07_runbooks/` para operación de respaldos

## Criterios de aceptación

- Cada documento completado genera (o actualiza) su `.md`.
- El archivo Markdown incluye frontmatter mínimo: `document_id`, `tenant`, `tipo`, `fecha`.
- El formato abre correctamente en Obsidian sin postproceso.
- Fallo del respaldo no pierde el documento principal (error aislado y logueado).

## Verificación mínima

- procesamiento de lote de prueba y validación de `.md` generados;
- verificación manual de apertura en Obsidian;
- `cd backend && pnpm run build` + test unitario del generador markdown.

## Riesgos

- duplicación de datos sensibles fuera de controles habituales.
- crecimiento de almacenamiento si no hay política de retención.
- inconsistencias si re-procesos no actualizan el backup correspondiente.

