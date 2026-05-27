# Runbook — Respaldos Markdown Obsidian

## Objetivo

Operar y verificar respaldos `.md` de documentos procesados para navegación en Obsidian y base de conocimiento orientada a grafo.

## Variables

- `MARKDOWN_BACKUP_ENABLED` (`true` por defecto)
- `MARKDOWN_BACKUP_PREFIX` (`markdown-backups` por defecto)
- `MARKDOWN_BACKUP_BUCKET` (opcional; si no existe usa `R2_BUCKET`)

## Estructura esperada en R2

- `{prefix}/{tenantId}/{documentId}/current.md`
- `{prefix}/{tenantId}/{documentId}/history/{iso-timestamp}.md`
- `{prefix}/{tenantId}/_index_tipo_{tipo-slug}.md`

## Contenido mínimo del Markdown

- Frontmatter: `document_id`, `tenant`, `tipo`, `fecha`
- Secciones: resumen, navegación grafo con `[[wikilinks]]`, campos extraídos, OCR, referencia a `storage_key`
- Índice por tipo actualizado automáticamente con enlaces a `[[{tenantId}/{documentId}/current]]`

## Verificación mínima

1. Procesar un documento de prueba.
2. Confirmar escritura de `current.md` y `history/*.md` en R2.
3. Abrir `current.md` en Obsidian y validar render sin postproceso.
4. Reprocesar el mismo documento y validar nueva versión en `history/`.

## Manejo de fallos

- Fallos de backup Markdown son no bloqueantes: el documento principal debe quedar en estado `completed`.
- Revisar logs de backend filtrando `Markdown backup` para diagnóstico.
