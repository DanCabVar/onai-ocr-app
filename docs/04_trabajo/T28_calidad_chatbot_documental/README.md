# T28 � Calidad y consistencia del chatbot documental

## Estado inicial

Spec creado a partir de la validaci�n QA de `T20` en junio 2026.

## Motivaci�n

Los ajustes recientes mejoraron el chat, pero la validaci�n manual mostr� que el problema real excede el alcance del PoC h�brido con grafo:

- ambig�edad entre campos relacionados;
- dependencia alta del phrasing del usuario;
- duplicados o mezclas de campos bajo una misma intenci�n sem�ntica;
- fragilidad ante documentos nuevos.

## Cierre de la iteraci�n previa

La iteraci�n actual se cierra dejando:

- `T20` con validaci�n QA parcial OK;
- mejoras puntuales en follow-ups, fechas, tipos y n�meros de orden;
- pendiente sem�ntica abierta en resoluci�n robusta de proveedor y otras entidades relacionadas;
- decisi�n expl�cita de no seguir parchando caso a caso dentro de `T20`.

## Primeros insumos QA

Casos observados durante la validaci�n:

- follow-ups sobre `Yolito` mejoran con contexto, pero `proveedor` puede mezclar nombre/rut/correo/tel�fono;
- consultas por n�meros de orden pueden traer valores vac�os o m�ltiples coincidencias si no se filtran sem�nticamente;
- tipos documentales ya muestran un comportamiento m�s s�lido que proveedor/n�mero OC;
- los OCR/datos extra�dos muestran que los valores correctos existen en la plataforma, por lo que el gap es de interpretaci�n/orquestaci�n del chat y no de OCR base.

## Plan operativo propuesto

### Fase 1 � Benchmark y cat�logo

1. Definir benchmark QA base con 15-20 preguntas versionadas.
2. Clasificar cada pregunta por intenci�n.
3. Marcar expected answer y tolerancias.
4. Separar preguntas simples, multi-turno y ambiguas.

### Fase 2 � Resoluci�n sem�ntica

1. Crear matriz `campo canonico -> labels -> sinonimos -> exclusiones`.
2. Priorizar campos de nombre por sobre rut/correo/tel�fono/direcci�n.
3. Agregar limpieza sem�ntica post-query.
4. Evitar duplicados y valores vac�os de forma centralizada.

### Fase 3 � Orquestaci�n y fallback

1. Definir qu� preguntas pasan por ruta determin�stica.
2. Definir qu� preguntas pasan por SQL-RAG generativo.
3. Definir se�ales de fallback y logging �til.
4. Medir latencia y precisi�n por estrategia.

### Fase 4 � Regresiones

1. Agregar regresiones automatizadas por intenci�n cr�tica.
2. Repetir benchmark QA sobre documentos distintos al dataset actual.
3. Consolidar evidencia final para cierre o divisi�n adicional del trabajo.

## Arranque sugerido para la pr�xima sesi�n

### Paso 1 � Benchmark inicial

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

### Paso 2 � Primer lote de preguntas

Armar 15 preguntas base repartidas entre:

- conteos;
- tipos de documento;
- fechas de emisi�n;
- n�meros de orden de compra;
- proveedor / cliente / comprador;
- follow-ups multi-turno.

### Paso 3 � Matriz sem�ntica base

Definir una primera tabla para intenciones cr�ticas:

- `proveedor`
- `cliente`
- `comprador`
- `numero_orden_compra`
- `fecha_emision`
- `tipo_documento`

Y para cada una:

- campos permitidos;
- campos excluidos;
- sin�nimos/labels frecuentes;
- reglas de deduplicaci�n.

### Paso 4 � Primera regresi�n automatizada

Agregar regresiones m�nimas para:

- `proveedor` no mezcla correo/rut/tel�fono;
- `n�meros de OC` no devuelve vac�os ni valores fuera del tipo correcto;
- `tipos de documento` deduplica correctamente;
- follow-ups conservan contexto �til sin contaminar la entidad buscada.

## Entregables de la pr�xima sesi�n

- benchmark inicial versionado;
- matriz de resoluci�n de campos;
- propuesta de `query-intent.service.ts` y `field-resolution.service.ts`;
- primer set de regresiones automatizadas.

## Avance dejado preparado

- benchmark inicial creado en `docs/04_trabajo/T28_calidad_chatbot_documental/benchmark_v1.csv`
- matriz sem�ntica base creada en `docs/04_trabajo/T28_calidad_chatbot_documental/field_semantics_v1.md`

## Pr�ximo paso recomendado

Ir directo a implementaci�n de Fase 2:

1. crear `query-intent.service.ts`;
2. crear `field-resolution.service.ts`;
3. mover reglas actuales de proveedor/OC/fechas a esa capa;
4. convertir los casos `T28-003` a `T28-007` en regresiones automatizadas.

## Implementación Fases 2 y 3 — 2026-06-22

### Qué se construyó

Se introdujo una capa explícita de intención + resolución semántica para el
chat documental, desacoplando la lógica determinística del orquestador SQL-RAG:

- `backend/src/chat/query-intent.service.ts`: clasifica la pregunta (con o sin
  contexto multi-turno) en una intención del catálogo y extrae/depura la
  entidad rastreada. No genera SQL. Incluye:
  - catálogo de intenciones con precedencia explícita (fecha → conteo → total →
    proveedor/cliente → orden de compra → tipos);
  - detección de **nombre de archivo** como ancla precisa de un documento
    puntual (`OC_Yolito2.pdf`);
  - depuración de entidad (`cleanEntity` + stopwords) que reduce capturas
    ruidosas del patrón de respaldo "de <…>" (ej. "la orden de compra de
    Yolito2" → "yolito2"; "compra tengo de Sodimac" → "sodimac").
- `backend/src/chat/field-resolution.service.ts`: materializa la matriz de
  `field_semantics_v1.md` como reglas de campo canónico (grupos de coincidencia
  por `name`/`label` + términos de exclusión) y construye las cláusulas SQL
  JSONB (match de campo, exclusión de valores vacíos, anclaje por entidad,
  match exacto de filename sin arrastrar prefijos).
- `backend/src/chat/sql-rag.service.ts`: `buildDeterministicFieldQuery` delega
  en ambos servicios y arma cada consulta vía helpers por intención. La lógica
  inline de proveedor/OC/fechas/conteo/tipos quedó eliminada del servicio.

### Cobertura determinística (intenciones activas)

| Intención | Con entidad | Sin entidad (tenant) |
|---|---|---|
| `count_documents` | sí | sí (agregado) |
| `list_document_types` | sí | sí (agregado) |
| `list_supplier_names` | sí | sí (agregado) |
| `list_customer_names` | sí | sí (agregado) |
| `list_issue_dates` | sí | no (cae a generativo) |
| `list_order_numbers` | sí | no |
| `list_totals` | sí | no |

`buyer_name` y `dispatch_order_number` quedan en la matriz como contrato listo,
sin cablear (no hay caso de benchmark que las exija de forma limpia).

### Fase 3 — Orquestación y trazabilidad

- Árbol de fallback explícito: **aclaración → determinística → generativa (LLM)
  → general (conversacional) → mensaje de error**.
- Detección de **statement de aclaración** ("el nombre del comprador es X"):
  responde con acknowledgement contextual y conserva el contexto en lugar de
  ejecutar SQL que devolvería "sin resultados" (cierra `T28-015`).
- `SqlRagResult`/`ChatQueryResult` exponen `strategy`
  (`deterministic|generative|general`) e `intent`, y se loguea
  `route user=… intent=… strategy=… rows=…` por consulta, para depurar y
  preparar la medición por estrategia en QA. No se exponen internals al usuario.

### Decisiones de diseño

- **Separación estricta**: intención (semántica, sin SQL) vs resolución
  (SQL/acceso a datos). El `SqlRagService` solo orquesta y ensambla.
- **Agregados seguros sin entidad**: solo conteo/tipos/proveedores/clientes se
  resuelven a nivel de tenant cuando no hay entidad; fechas/órdenes/totales sin
  entidad siguen cayendo a generativo para no volcar todo el tenant.
- **Exclusiones explícitas anti-mezcla**: proveedor exige `nombre`+`proveedor`
  y excluye `rut`/`correo`/`telefono`/`fax`/`direccion`; OC excluye el
  correlativo interno `numero_oc_mts` (forbidden `054_00655119`) y se restringe
  al tipo `Orden de Compra`; total excluye `neto` (forbidden `559.200`).
- **No sobreajuste a Yolito**: alias `total_documentos_yolito` → `total_documentos`;
  reglas por campo canónico/semántica, no por dataset.
- **Aislamiento multi-tenant intacto**: toda consulta mantiene `d.user_id = $1`,
  el reescritor de vistas tenant-scoped y el `set_config` RLS (sin cambios).

### Tests ejecutados

- `backend/src/chat/t28-benchmark-regressions.spec.ts` (nuevo): regresiones
  para `T28-001`, `T28-002` y `T28-003`..`T28-013` que validan la forma
  semántica del SQL determinístico (dedupe, tipo correcto, exclusión de
  campos/valores prohibidos, anclaje exacto por archivo o entidad depurada,
  agregados sin filtro ruidoso, filtro `$1`).
- `backend/src/chat/query-intent.service.spec.ts` (nuevo): tests unitarios de
  precedencia de intenciones, anclaje por archivo, depuración de entidad y
  detección de statements de aclaración.
- `cd backend && pnpm test` → **7 suites / 42 tests en verde** (incluye
  `chat.service.spec.ts` y `sql-rag.service.spec.ts`).
- `cd backend && pnpm run build` → OK.

### Estado de desarrollo

Desarrollo determinístico de T28 **completo** para todos los casos del benchmark
salvo el adversarial `T28-014`. La validación funcional restante es en vivo
(QA), por diseño.

### Pendiente — Fase 4 (validación en QA, requiere ambiente con datos)

- **Benchmark QA en vivo**: ejecutar `benchmark_v1.csv` contra datos reales y
  ≥3 tipos documentales; marcar los casos del CSV de `draft` → validado.
- Medición de **latencia por estrategia** (ya hay log `strategy`) y ranking fino
  cuando coexisten varios valores candidatos: requieren tráfico/datos reales.
- `T28-014` (ambigüedad por dominio/correo, ej. "proveedor de Grupo TX"):
  decisión de diseño deliberada — los casos adversariales se resuelven por la
  ruta generativa (que puede matizar) y se evalúan en QA; no se fuerzan reglas
  rígidas, evitando el sobreajuste que advierte el propio spec. Si la data de un
  tenant lo amerita, se agrega un guard data-driven con su regresión.
