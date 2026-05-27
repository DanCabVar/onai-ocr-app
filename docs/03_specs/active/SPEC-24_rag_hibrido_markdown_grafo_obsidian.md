# SPEC-24 — RAG híbrido sobre Markdown grafo (Obsidian-ready)

## Tarea relacionada

- `T24` Integrar búsqueda/respuesta sobre respaldos Markdown con relaciones de grafo.

## Objetivo

Conectar los respaldos Markdown generados en `SPEC-21` al flujo de preguntas de la aplicación para mejorar recuperación de información documental, combinando búsqueda textual, señal estructurada (frontmatter/campos) y navegación por relaciones (`[[wikilinks]]`).

## Alcance

Incluye:

- ingesta de archivos Markdown de respaldo (`current.md`, índices por tipo y relaciones);
- parsing de frontmatter, secciones y enlaces Obsidian;
- indexado híbrido inicial (full-text + metadatos + relaciones básicas);
- endpoint/servicio de retrieval para preguntas del usuario;
- integración en pipeline de respuesta del chat/RAG actual como fuente adicional;
- trazabilidad de fuentes usadas en cada respuesta (documentos y nodos relacionados).

Excluye:

- reemplazar la DB relacional como fuente de verdad;
- editor de notas manual en Obsidian;
- sincronización bidireccional avanzada de cambios manuales en vault externo.

## Diseño funcional v1

1. `Ingesta`: leer Markdown por tenant desde prefijo de backups.
2. `Parse`: extraer frontmatter (`document_id`, `tenant`, `tipo`, `fecha`, etc.), resumen, campos y links.
3. `Index`: persistir índice consultable por tenant con:
   - texto plano normalizado;
   - metadatos clave;
   - adyacencia de links (`source -> target`).
4. `Retrieve`: dada una pregunta, combinar:
   - ranking textual;
   - filtros/boost por tipo/fecha/entidad;
   - expansión de 1 salto por nodos ligados.
5. `Answer`: construir contexto citado y responder con referencias trazables.

## Archivos/módulos probables

- `backend/src/chat/sql-rag.service.ts`
- nuevo módulo sugerido: `backend/src/chat/markdown-graph-rag/`
  - `markdown-ingest.service.ts`
  - `markdown-index.service.ts`
  - `graph-retrieval.service.ts`
- configuración env + runbook en `docs/07_runbooks/`.

## Criterios de aceptación

- Preguntas sobre documentos recuperan contexto desde backups Markdown (no solo DB actual).
- Respuesta incluye trazabilidad mínima de fuentes (`document_id` y/o nodo relacionado).
- Retrieval respeta aislamiento por tenant.
- Si falla index/retrieval Markdown, el sistema degrada de forma segura al flujo RAG existente.

## Verificación mínima

- tests unitarios de parser frontmatter/wikilinks;
- tests de retrieval híbrido (ranking + expansión por enlaces);
- test integrado de pregunta-respuesta con cita de fuente;
- `cd backend && pnpm run build`.

## Riesgos

- desalineación temporal entre documento procesado e índice si no hay refresco consistente;
- fuga entre tenants si no se aplica partición estricta en indexado/consulta;
- costo/latencia adicional en retrieval si no se controla expansión del grafo.

