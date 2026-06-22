# SPEC-28 — Calidad y consistencia del chatbot documental

## Tarea relacionada

- `T28` Robustecer el chatbot documental para responder de forma consistente sobre documentos actuales y futuros.

## Objetivo

Elevar la calidad operativa del `Chat IA` para que responda con consistencia, trazabilidad y resiliencia ante documentos heterogéneos, nuevos tipos documentales y preguntas de seguimiento, reduciendo la dependencia de heurísticas frágiles o de prompts ajustados al dataset de QA.

## Contexto

Durante la validación de `T20` en QA, el chat mejoró en contexto conversacional y consultas por campos extraídos, pero siguieron apareciendo brechas estructurales:

- follow-ups que dependen demasiado del phrasing exacto del usuario;
- mezcla de campos semánticamente cercanos (`proveedor`, `rut proveedor`, `teléfono proveedor`, `correo proveedor`);
- resultados duplicados o ambiguos cuando el documento contiene múltiples campos relacionados;
- comportamiento variable ante documentos nuevos o schemas no vistos durante la calibración manual.

Esto indica que el problema ya no es solo del PoC híbrido de `T20`, sino de la calidad general del orquestador de consultas del chatbot.

## Alcance

Incluye:

- definir una capa semántica robusta para mapear preguntas ? intención ? campos candidatos;
- desacoplar lógica de consulta de heurísticas acopladas a un dataset puntual;
- mejorar resolución de follow-ups multi-turno con memoria conversacional útil y acotada;
- introducir validaciones automáticas para evitar duplicados, campos basura y resultados semánticamente incorrectos;
- diseñar benchmark reproducible de calidad del chat con preguntas reales y preguntas adversariales;
- establecer criterios de fallback entre rutas determinísticas, SQL-RAG y capas híbridas futuras.

Excluye:

- reemplazo completo del stack actual por un agente distinto;
- rediseño completo de UI del chat salvo cambios mínimos para trazabilidad;
- infraestructura enterprise nueva no necesaria para mejorar calidad de respuesta.

## Problemas concretos a atacar

1. Preguntas semánticas del tipo:
   - "¿cuál es el proveedor?"
   - "¿cuáles son sus números de orden de compra?"
   - "¿qué tipos de documentos de Yolito tengo?"
   deben responder correctamente aunque cambien nombres de campos o labels.
2. El chat debe distinguir entre:
   - nombre del proveedor;
   - rut del proveedor;
   - correo del proveedor;
   - teléfono del proveedor.
3. El sistema debe evitar duplicados y valores vacíos/sintéticos (`Sin valor`, `—`, etc.).
4. El comportamiento debe escalar a nuevos tipos documentales sin requerir un fix por dataset.

## Líneas de diseño esperadas

- catálogo de intenciones del chat (`count`, `list_types`, `list_dates`, `list_suppliers`, `list_order_numbers`, etc.);
- capa de resolución semántica campo/label con sinónimos y priorización;
- rutas determinísticas para consultas de alta frecuencia;
- validación post-query para deduplicación, limpieza y score semántico básico;
- benchmark QA con dataset diverso y expected answers versionados.

## Archivos/módulos probables

- `backend/src/chat/chat.service.ts`
- `backend/src/chat/sql-rag.service.ts`
- nuevo módulo sugerido: `backend/src/chat/query-intent.service.ts`
- nuevo módulo sugerido: `backend/src/chat/field-resolution.service.ts`
- `backend/src/chat/*.spec.ts`
- `frontend/app/chat/page.tsx` (si se agrega trazabilidad o debug mínimo)
- `docs/04_trabajo/T28_calidad_chatbot_documental/`

## Criterios de aceptación

- El chat responde correctamente un set benchmark de consultas multi-turno sobre al menos 3 tipos documentales distintos.
- Preguntas por entidad + follow-up no dependen del dataset exacto usado en QA fundacional.
- No aparecen duplicados ni campos semánticamente incorrectos para consultas frecuentes.
- Existe evidencia automatizada mínima para regresiones del chat.
- Se documenta claramente cuándo entra una ruta determinística y cuándo una ruta generativa/híbrida.

## Verificación mínima

- `cd backend && pnpm test -- chat.service.spec.ts sql-rag.service.spec.ts`
- `cd backend && pnpm run build`
- benchmark manual/semiautomático en QA con casos versionados
- evidencia en `docs/04_trabajo/T28_calidad_chatbot_documental/README.md`

## Riesgos

- sobreajustar reglas a un subconjunto pequeño de documentos;
- introducir demasiada lógica rígida y perder flexibilidad ante documentos nuevos;
- degradar latencia si se encadenan demasiadas capas antes de responder.
