# T28 — Calidad y consistencia del chatbot documental

## Estado inicial

Spec creado a partir de la validación QA de `T20` en junio 2026.

## Motivación

Los ajustes recientes mejoraron el chat, pero la validación manual mostró que el problema real excede el alcance del PoC híbrido con grafo:

- ambigüedad entre campos relacionados;
- dependencia alta del phrasing del usuario;
- duplicados o mezclas de campos bajo una misma intención semántica;
- fragilidad ante documentos nuevos.

## Cierre de la iteración previa

La iteración actual se cierra dejando:

- `T20` con validación QA parcial OK;
- mejoras puntuales en follow-ups, fechas, tipos y números de orden;
- pendiente semántica abierta en resolución robusta de proveedor y otras entidades relacionadas;
- decisión explícita de no seguir parchando caso a caso dentro de `T20`.

## Primeros insumos QA

Casos observados durante la validación:

- follow-ups sobre `Yolito` mejoran con contexto, pero `proveedor` puede mezclar nombre/rut/correo/teléfono;
- consultas por números de orden pueden traer valores vacíos o múltiples coincidencias si no se filtran semánticamente;
- tipos documentales ya muestran un comportamiento más sólido que proveedor/número OC;
- los OCR/datos extraídos muestran que los valores correctos existen en la plataforma, por lo que el gap es de interpretación/orquestación del chat y no de OCR base.

## Plan operativo propuesto

### Fase 1 — Benchmark y catálogo

1. Definir benchmark QA base con 15-20 preguntas versionadas.
2. Clasificar cada pregunta por intención.
3. Marcar expected answer y tolerancias.
4. Separar preguntas simples, multi-turno y ambiguas.

### Fase 2 — Resolución semántica

1. Crear matriz `campo canonico -> labels -> sinonimos -> exclusiones`.
2. Priorizar campos de nombre por sobre rut/correo/teléfono/dirección.
3. Agregar limpieza semántica post-query.
4. Evitar duplicados y valores vacíos de forma centralizada.

### Fase 3 — Orquestación y fallback

1. Definir qué preguntas pasan por ruta determinística.
2. Definir qué preguntas pasan por SQL-RAG generativo.
3. Definir señales de fallback y logging útil.
4. Medir latencia y precisión por estrategia.

### Fase 4 — Regresiones

1. Agregar regresiones automatizadas por intención crítica.
2. Repetir benchmark QA sobre documentos distintos al dataset actual.
3. Consolidar evidencia final para cierre o división adicional del trabajo.

## Arranque sugerido para la próxima sesión

### Paso 1 — Benchmark inicial

Crear un archivo versionado con al menos estas columnas:

- `id`
- `intent`
- `conversation_context`
- `question`
- `expected_answer`
- `allowed_variants`
- `forbidden_terms`
- `source_documents`
- `status`

### Paso 2 — Primer lote de preguntas

Armar 15 preguntas base repartidas entre:

- conteos;
- tipos de documento;
- fechas de emisión;
- números de orden de compra;
- proveedor / cliente / comprador;
- follow-ups multi-turno.

### Paso 3 — Matriz semántica base

Definir una primera tabla para intenciones críticas:

- `proveedor`
- `cliente`
- `comprador`
- `numero_orden_compra`
- `fecha_emision`
- `tipo_documento`

Y para cada una:

- campos permitidos;
- campos excluidos;
- sinónimos/labels frecuentes;
- reglas de deduplicación.

### Paso 4 — Primera regresión automatizada

Agregar regresiones mínimas para:

- `proveedor` no mezcla correo/rut/teléfono;
- `números de OC` no devuelve vacíos ni valores fuera del tipo correcto;
- `tipos de documento` deduplica correctamente;
- follow-ups conservan contexto útil sin contaminar la entidad buscada.

## Entregables de la próxima sesión

- benchmark inicial versionado;
- matriz de resolución de campos;
- propuesta de `query-intent.service.ts` y `field-resolution.service.ts`;
- primer set de regresiones automatizadas.
