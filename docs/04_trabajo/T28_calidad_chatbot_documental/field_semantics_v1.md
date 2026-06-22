# T28 — Matriz semántica base v1

## Propósito

Primera tabla de resolución semántica para reducir mezcla entre campos relacionados y estabilizar respuestas del chat antes de ampliar nuevas rutas determinísticas.

## Convenciones

- **Campo canónico**: intención semántica que el usuario realmente quiere consultar.
- **Campos permitidos**: nombres/labels aceptables para responder esa intención.
- **Campos excluidos**: señales que parecen cercanas, pero no deben usarse para responder.
- **Sinónimos de usuario**: phrasing natural esperado en preguntas.
- **Reglas**: limpieza, deduplicación y priorización.

| Campo canónico | Intención | Campos permitidos | Campos excluidos | Sinónimos de usuario | Reglas |
|---|---|---|---|---|---|
| `supplier_name` | `list_supplier_names` | `nombre_proveedor`, `nombre del proveedor`, `proveedor` cuando el label incluya `nombre` | `rut_proveedor`, `telefono_proveedor`, `fax_proveedor`, `correo_proveedor`, `direccion_proveedor`, dominios derivados del correo | proveedor, nombre del proveedor, empresa proveedora | Priorizar campos que contengan `nombre` + `proveedor`; excluir valores numéricos/email; deduplicar por texto normalizado |
| `customer_name` | `list_customer_names` | `nombre_cliente`, `cliente`, `nombre receptor` si el documento modela cliente como receptor | `rut_cliente`, `celular_cliente`, `direccion_cliente` | cliente, nombre del cliente, empresa cliente | Preferir nombre explícito; si hay `receptor` y `cliente`, priorizar `cliente` salvo tipo documental que invierta el rol |
| `buyer_name` | `list_buyer_names` | `nombre_comprador`, `comprador`, `nombre del comprador (facturación)` | `rut_comprador`, `telefono_comprador`, `correo_comprador`, `direccion_comprador` | comprador, nombre del comprador, quién compra | Excluir contacto/dirección; aceptar variantes con `(facturación)` |
| `purchase_order_number` | `list_order_numbers` | `numero_orden_compra`, `numero de orden de compra`, `orden de compra` solo si el valor es claramente un identificador | `numero_oc_mts`, `pedido_vta`, `rut`, `telefono`, valores vacíos/sin valor | número de orden, número de OC, orden de compra | Filtrar solo documentos tipo `Orden de Compra` cuando la pregunta lo requiera; excluir valores vacíos y no identificadores |
| `dispatch_order_number` | `list_dispatch_order_numbers` | `numero_orden_despacho`, `numero orden despacho`, `n° orden despacho` | `orden de compra`, `pedido_vta`, `numero_oc_mts` | orden de despacho, número de despacho | No mezclar con orden de compra; aplicar por tipo documental cuando sea posible |
| `issue_date` | `list_issue_dates` | `fecha_emision`, `fecha de emisión`, `fecha y hora de emisión` | `fecha_entrega`, `fecha_vigencia`, `updated_at`, timestamps internos | fecha de emisión, cuándo se emitió, fecha del documento | Normalizar a fecha legible; si hay fecha y hora, permitir respuesta en fecha o fecha+hora |
| `document_type_name` | `list_document_types` | `document_type.name`, `tipo_documento`, `tipo` | nombres de archivo, clasificaciones intermedias, `sin tipo` salvo pregunta explícita | tipo, tipos de documento, clase de documento | Deduplicar siempre; excluir placeholders |
| `document_count` | `count_documents` | `count(distinct d.id)` | conteos por campos, filas multiplicadas por joins | cuántos documentos, total de documentos | Siempre usar `DISTINCT` por documento |
| `monetary_total` | `list_totals` | `total`, `monto_total`, `total_neto` según tipo y pregunta | `neto` cuando se pide `total final`, descuentos, cantidades | total, monto, total final, cuánto suma | Responder con contexto de qué total se devuelve; formatear moneda/numero consistentemente |

## Reglas transversales iniciales

1. Excluir valores vacíos: `Sin valor`, `—`, `-`, `null`, string vacío.
2. Excluir correos, RUTs y teléfonos cuando la intención pide un nombre.
3. Deduplicar por texto normalizado (`trim`, minúsculas, sin tildes).
4. Cuando haya contexto multi-turno, separar:
   - **entidad consultada**;
   - **campo objetivo**;
   - **tipo documental** si el usuario lo especifica.
5. Si una entidad proviene solo de un correo o dominio y no de un campo nombre, marcar ambigüedad en vez de afirmar.

## Próxima ampliación

En la siguiente iteración, extender esta matriz para:

- `rut_supplier`
- `supplier_email`
- `supplier_phone`
- `delivery_address`
- `dispatch_receiver_name`
- `payment_terms`
