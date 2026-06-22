# T28 � Matriz sem�ntica base v1

## Prop�sito

Primera tabla de resoluci�n sem�ntica para reducir mezcla entre campos relacionados y estabilizar respuestas del chat antes de ampliar nuevas rutas determin�sticas.

## Convenciones

- **Campo can�nico**: intenci�n sem�ntica que el usuario realmente quiere consultar.
- **Campos permitidos**: nombres/labels aceptables para responder esa intenci�n.
- **Campos excluidos**: se�ales que parecen cercanas, pero no deben usarse para responder.
- **Sin�nimos de usuario**: phrasing natural esperado en preguntas.
- **Reglas**: limpieza, deduplicaci�n y priorizaci�n.

| Campo can�nico | Intenci�n | Campos permitidos | Campos excluidos | Sin�nimos de usuario | Reglas |
|---|---|---|---|---|---|
| `supplier_name` | `list_supplier_names` | `nombre_proveedor`, `nombre del proveedor`, `proveedor` cuando el label incluya `nombre` | `rut_proveedor`, `telefono_proveedor`, `fax_proveedor`, `correo_proveedor`, `direccion_proveedor`, dominios derivados del correo | proveedor, nombre del proveedor, empresa proveedora | Priorizar campos que contengan `nombre` + `proveedor`; excluir valores num�ricos/email; deduplicar por texto normalizado |
| `customer_name` | `list_customer_names` | `nombre_cliente`, `cliente`, `nombre receptor` si el documento modela cliente como receptor | `rut_cliente`, `celular_cliente`, `direccion_cliente` | cliente, nombre del cliente, empresa cliente | Preferir nombre expl�cito; si hay `receptor` y `cliente`, priorizar `cliente` salvo tipo documental que invierta el rol |
| `buyer_name` | `list_buyer_names` | `nombre_comprador`, `comprador`, `nombre del comprador (facturaci�n)` | `rut_comprador`, `telefono_comprador`, `correo_comprador`, `direccion_comprador` | comprador, nombre del comprador, qui�n compra | Excluir contacto/direcci�n; aceptar variantes con `(facturaci�n)` |
| `purchase_order_number` | `list_order_numbers` | `numero_orden_compra`, `numero de orden de compra`, `orden de compra` solo si el valor es claramente un identificador | `numero_oc_mts`, `pedido_vta`, `rut`, `telefono`, valores vac�os/sin valor | n�mero de orden, n�mero de OC, orden de compra | Filtrar solo documentos tipo `Orden de Compra` cuando la pregunta lo requiera; excluir valores vac�os y no identificadores |
| `dispatch_order_number` | `list_dispatch_order_numbers` | `numero_orden_despacho`, `numero orden despacho`, `n� orden despacho` | `orden de compra`, `pedido_vta`, `numero_oc_mts` | orden de despacho, n�mero de despacho | No mezclar con orden de compra; aplicar por tipo documental cuando sea posible |
| `issue_date` | `list_issue_dates` | `fecha_emision`, `fecha de emisi�n`, `fecha y hora de emisi�n` | `fecha_entrega`, `fecha_vigencia`, `updated_at`, timestamps internos | fecha de emisi�n, cu�ndo se emiti�, fecha del documento | Normalizar a fecha legible; si hay fecha y hora, permitir respuesta en fecha o fecha+hora |
| `document_type_name` | `list_document_types` | `document_type.name`, `tipo_documento`, `tipo` | nombres de archivo, clasificaciones intermedias, `sin tipo` salvo pregunta expl�cita | tipo, tipos de documento, clase de documento | Deduplicar siempre; excluir placeholders |
| `document_count` | `count_documents` | `count(distinct d.id)` | conteos por campos, filas multiplicadas por joins | cu�ntos documentos, total de documentos | Siempre usar `DISTINCT` por documento |
| `monetary_total` | `list_totals` | `total`, `monto_total`, `total_neto` seg�n tipo y pregunta | `neto` cuando se pide `total final`, descuentos, cantidades | total, monto, total final, cu�nto suma | Responder con contexto de qu� total se devuelve; formatear moneda/numero consistentemente |

## Reglas transversales iniciales

1. Excluir valores vac�os: `Sin valor`, `�`, `-`, `null`, string vac�o.
2. Excluir correos, RUTs y tel�fonos cuando la intenci�n pide un nombre.
3. Deduplicar por texto normalizado (`trim`, min�sculas, sin tildes).
4. Cuando haya contexto multi-turno, separar:
   - **entidad consultada**;
   - **campo objetivo**;
   - **tipo documental** si el usuario lo especifica.
5. Si una entidad proviene solo de un correo o dominio y no de un campo nombre, marcar ambig�edad en vez de afirmar.

## Pr�xima ampliaci�n

En la siguiente iteraci�n, extender esta matriz para:

- `rut_supplier`
- `supplier_email`
- `supplier_phone`
- `delivery_address`
- `dispatch_receiver_name`
- `payment_terms`

## Regla explícita: `list_order_numbers` (T28, iteración 3)

**Definición:** "números de orden de compra" devuelve el valor del campo
`numero_orden_compra` (ver fila `purchase_order_number`) **solo de documentos cuyo
tipo —real (`document_types.name`) o inferido (`inferred_data.inferred_type`)— es
`Orden de Compra`**.

**No incluye:**

- referencias a una OC que aparezcan dentro de documentos de **otro tipo** (p.
  ej. una `Orden de Despacho` que menciona la OC asociada): eso es una
  cross-reference, no "tus números de orden de compra";
- el correlativo interno `numero_oc_mts` ni `pedido_vta` (excluidos por la matriz);
- valores vacíos/placeholders.

**Justificación:** el número de OC es propiedad del documento de tipo `Orden de
Compra`. Incluir referencias desde despachos generaría duplicados y ambigüedad, y
contradice el `expected_answer` del caso `T28-005` (un único `052_00514607-1`).

**Consistencia de respuesta:** la ruta determinística antepone el scope explícito
("Según tus documentos de tipo Orden de Compra: …") para que el usuario entienda
de dónde sale el resultado. Si en el futuro se necesita incluir referencias desde
despachos, será una intención distinta (`list_referenced_order_numbers`), no una
ampliación implícita de esta.

## Regla de síntesis de respuesta (T28, iteración 3)

Cuando la ruta **determinística** ya produjo filas estructuradas, la respuesta
textual se genera **localmente** (sin LLM) a partir de esas filas. El LLM no
sintetiza la respuesta final en esta ruta, para evitar que contradiga el dato
estructurado (caso observado: la tabla traía el proveedor pero el texto decía "no
tengo el nombre del proveedor"). El LLM solo formatea en la ruta **generativa**, y
recibe únicamente la pregunta actual, no el contexto conversacional completo.
