# SPEC-20 — Mejorar agente RAG con grafo Neo4j

## Tarea relacionada

- `T20` Incorporar capa de relaciones con Neo4j para RAG.

## Objetivo

Mejorar calidad de respuestas del agente RAG modelando relaciones entre documentos, entidades y metadatos en un grafo consultable, complementando el enfoque SQL actual.

## Alcance

Incluye:

- definir modelo de grafo inicial (nodos, relaciones, propiedades);
- pipeline de ingestión desde documentos procesados hacia Neo4j;
- estrategia de consulta híbrida (SQL + grafo) para preguntas complejas;
- evaluación comparativa de calidad de respuesta antes/después.

Excluye:

- reemplazo total inmediato de SQL-RAG;
- infraestructura enterprise de alta disponibilidad Neo4j desde fase 1.

## Archivos/módulos probables

- `backend/src/chat/chat.service.ts`
- `backend/src/chat/sql-rag.service.ts`
- nuevo módulo `backend/src/chat/graph-rag.service.ts` (propuesto)
- `docker-compose*.yml` (si se agrega servicio Neo4j local/dev)

## Criterios de aceptación

- Existe modelo de grafo mínimo documentado y operativo.
- Agente puede responder al menos un set de consultas relacionales mejor que baseline SQL.
- Hay fallback seguro a flujo actual si Neo4j falla.
- Métricas de calidad/latencia quedan registradas.

## Verificación mínima

- entorno local con Neo4j y dataset de prueba;
- suite de consultas benchmark (baseline vs híbrido);
- `cd backend && pnpm run build` + pruebas de integración del módulo RAG.

## Riesgos

- sobrecomplejidad operativa temprana.
- deriva de esquema de grafo sin gobernanza.
- latencia/costos si no se controla volumen de ingestión.

