# T20 — Modelo de grafo inicial (Neo4j)

## Estado

- Fecha: 2026-05-27
- Tipo: PoC fase 1
- Objetivo: habilitar consulta híbrida SQL + grafo con fallback seguro.

## Nodos

- `Tenant { userId, updatedAt }`
- `Document { id, userId, filename, status, updatedAt }`
- `DocumentType { id, userId, name }`
- `Field { userId, name, value }`

## Relaciones

- `(Tenant)-[:HAS_DOCUMENT]->(Document)`
- `(Document)-[:HAS_TYPE]->(DocumentType)`
- `(Document)-[:HAS_FIELD]->(Field)`

## Pipeline de ingesta

1. Cargar documentos recientes del usuario desde PostgreSQL (limit configurable).
2. `MERGE` de tenant/document/type/field en Neo4j.
3. Reutilizar la ingesta durante consultas relacionales para mantener el grafo actualizado.

## Consulta híbrida

1. Preguntas con patrón relacional activan GraphRAG (`GRAPH_RAG_ENABLED=true`).
2. Se ejecuta consulta grafo + consulta SQL baseline.
3. Respuesta final combina resumen SQL + bloque de relaciones detectadas.
4. Si Neo4j falla o no está configurado, fallback automático a SQL-only.

## Variables de entorno

- `GRAPH_RAG_ENABLED=true|false`
- `NEO4J_URI=bolt://localhost:7687`
- `NEO4J_USERNAME=neo4j`
- `NEO4J_PASSWORD=...`
- `NEO4J_DATABASE=neo4j`
- `GRAPH_RAG_MAX_INGEST_DOCS=200`

## Notas de seguridad

- El grafo se separa por `userId` en nodos y relaciones.
- El fallback evita caída funcional de `/api/chat/query` ante errores Neo4j.
- No se elimina el control multi-tenant SQL/RLS existente.
