# T24 — RAG híbrido sobre Markdown grafo (Obsidian-ready)

## Estado sugerido

- `En revisión`

## Resumen implementación

Se implementó integración de retrieval híbrido Markdown+grafo en backend chat con degradación segura al SQL RAG actual:

- Nuevo módulo `backend/src/chat/markdown-graph-rag/`:
  - `markdown-ingest.service.ts` (frontmatter + wikilinks)
  - `markdown-index.service.ts` (indexado híbrido + expansión 1 salto)
  - `graph-retrieval.service.ts` (retrieval por tenant + respuesta con fuentes)
- Integración en flujo de chat:
  - `POST /chat/query` mantiene respuesta productiva
  - `POST /chat/query-debug` expone estrategia/fuentes para diagnóstico
- Fallback seguro:
  - Si falla o no hay contexto markdown, usa `SqlRagService`.

## Evidencia de verificación

Fecha: 2026-05-27

1. Tests unitarios/spec:

```bash
pnpm --dir backend test -- markdown-graph-rag
```

Resultado: `3` suites pass, `4` tests pass.

2. Build backend:

```bash
pnpm --dir backend run build
```

Resultado: build `nest` exit code `0`.

## Riesgos y notas

- Validación E2E con datos reales tenant-productivo queda recomendada antes de merge final.
- El endpoint `query-debug` debe mantenerse restringido (ya protegido por JWT en módulo chat).
- El scoring por tipo/fecha es v1 heurístico; puede requerir ajuste fino con tráfico real.

## Archivos tocados (feature)

- `backend/src/chat/chat.controller.ts`
- `backend/src/chat/chat.module.ts`
- `backend/src/chat/chat.service.ts`
- `backend/src/chat/markdown-graph-rag/*`
- `backend/src/storage/storage.service.ts`
