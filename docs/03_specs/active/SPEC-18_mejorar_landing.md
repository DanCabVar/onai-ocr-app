# SPEC-18 — Mejorar landing comercial

## Tarea relacionada

- `T18` Optimizar landing para conversión.

## Objetivo

Mejorar claridad de propuesta de valor, confianza y conversión en la landing, alineando mensaje con OCR B2B y planes reales del producto.

## Alcance

Incluye:

- rediseño de hero, beneficios, casos de uso y CTA;
- bloque de pricing/planes consistente con backend;
- prueba de performance básica (Core Web Vitals);
- instrumentación de eventos clave (click CTA, registro, pricing).

Excluye:

- rediseño completo del dashboard autenticado.

## Archivos/módulos probables

- `frontend/components/landing/*`
- `frontend/app/page.tsx`
- `frontend/app/pricing/page.tsx`
- `frontend/app/globals.css`

## Criterios de aceptación

- Mensaje principal y CTA comprensibles en <10 segundos.
- CTA principal y secundario medibles por analytics.
- Vista responsive correcta en móvil y desktop.
- No degradar build ni performance de forma significativa.

## Verificación mínima

- `cd frontend && pnpm run build`
- revisión visual desktop/móvil;
- captura de métricas Lighthouse comparativas antes/después.

## Riesgos

- inconsistencias entre promesa comercial y capacidad real.
- regresiones de estilo por cambios globales de CSS.
- sobrecarga visual que perjudique claridad.

