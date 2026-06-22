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

## Iteración 2 — corrección de FAIL de QA (2026-06-22)

La 1.ª iteración se validó en QA con 5 PASS y 7 FAIL. Esta iteración ataca las
4 causas raíz detectadas (entity resolution, scoping por documento, agregaciones
por entidad y ambigüedad) sin sobreajustar al dataset.

### Causas raíz y correcciones

1. **Entity drift desde el historial.** `extractTrackedEntity` escaneaba toda la
   cadena contextual (incluidos turnos del asistente) y el primer filename ganaba.
   → `resolveEntity` ahora **prioriza la pregunta actual**; solo hereda del
   contexto si la pregunta actual no aporta entidad, y exclusivamente de turnos
   del **usuario** (`collectUserContext`), nunca de lo que citó el bot.
   - Corrige: `T28-010` (fecha de OC_Yolito2 usaba OC_Yolito), `T28-004`
     (conteo daba 1 porque heredaba un filename del bot).
2. **`list_document_types` ignoraba el tipo inferido.** Hacía `INNER JOIN
   document_types` y solo leía `dt.name`; los docs tipo "Otros" (tipo real en
   `inferred_data.inferred_type`) quedaban fuera. → `LEFT JOIN` + `CASE` que toma
   el tipo real o, si es "Otros"/placeholder, el `inferred_type`, filtrando
   placeholders. Corrige `T28-002` (vacío) y `T28-007` (faltaba Orden de Despacho).
3. **Resolución de campos solo sobre `extracted_data.fields`.** → todas las
   consultas de campo ahora escanean también `inferred_data.key_fields`
   (`combinedFieldsExpression`), robusteciendo docs inferidos. La rama OC además
   acepta el tipo por `inferred_type`.
4. **Scoping por filename no exclusivo.** Cuando la entidad es un archivo, el
   scope se ancla **solo** a `filename` (sin OR sobre OCR/summary/campos), evitando
   arrastrar otros documentos que lo mencionen. Refuerza `T28-008/009/010`.
5. **Ambigüedad (`T28-014`).** Entidades capturadas por el patrón débil "de X" en
   una pregunta por NOMBRE (proveedor/cliente) se marcan ambiguas
   (`isAmbiguousEntity`) y el chat **pide aclaración** en vez de afirmar. Las
   anclas fuertes (filename, rol, contexto) no se ven afectadas, por lo que
   `T28-006/009` siguen respondiendo directo.

### Entity resolution / scoping / ambiguity — resumen

- **Entity resolution**: pregunta actual > contexto de usuario > nada; fuente de
  la entidad etiquetada (`filename|role|scope|loose|context`) para calibrar
  confianza.
- **Scoping**: filename ⇒ match exclusivo por `filename`; entidad ⇒ match amplio
  (filename/OCR/summary/campos extraídos e inferidos).
- **Ambiguity**: `loose` + intención de nombre ⇒ aclaración; nunca inventa
  equivalencia fuerte.

### Tests ejecutados (iteración 2)

- `cd backend && pnpm test` → **7 suites / 47 tests en verde**.
- `cd backend && pnpm run build` → OK.
- Regresiones nuevas: entity-drift (archivo del bot no contamina), conteo por
  entidad current-first, tipos con `inferred_type` (`LEFT JOIN`), scoping
  exclusivo por filename, `isAmbiguousEntity` para "proveedor de Grupo TX".

### Casos esperados a mejorar (re-validar en QA)

`T28-002`, `T28-004`, `T28-005`, `T28-007`, `T28-010`, `T28-014`, `T28-015`
(marcados `fixing` en `benchmark_v1.csv`). Los 5 PASS previos
(`T28-001/003/006/008/009`) se preservan por construcción y por regresión.

### Riesgos pendientes

- La corrección de tipos asume que el catch-all del sistema se llama "Otros";
  si un tenant nombra distinto su tipo genérico, hay que parametrizarlo.
- `combinedFieldsExpression` asume que `inferred_data.key_fields` comparte
  estructura `{name,value,label}` (documentado en el schema). Validar en QA.
- La re-validación funcional definitiva es en QA con datos reales (este trabajo
  es determinístico y probado en unit, no ejecuta SQL real).
