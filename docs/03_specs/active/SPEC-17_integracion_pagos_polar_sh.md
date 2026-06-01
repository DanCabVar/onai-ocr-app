# SPEC-17 — Integración de pagos con Polar.sh

## Tarea relacionada

- `T17` Integrar flujo comercial con Polar.sh.

## Objetivo

Evaluar e implementar integración de pagos con Polar.sh para suscripciones/checkout, con webhooks robustos y sincronización de estado de plan por tenant.

## Alcance

Incluye:

- análisis comparativo de convivencia o reemplazo respecto a Stripe;
- diseño de modelo de suscripción y mapping de planes;
- implementación de checkout + webhook + actualización de límites;
- tolerancia a reintentos/eventos duplicados.

Excluye:

- migración masiva irreversible sin plan de rollback;
- facturación tributaria local completa (se trata en spec legal separado).

## Archivos/módulos probables

- `backend/src/subscriptions/*`
- `backend/src/stripe/*` (si hay convivencia/migración)
- `frontend/app/pricing/page.tsx`
- `frontend/lib/api/*subscription*`

## Criterios de aceptación

- Checkout Polar funcional en entorno de prueba.
- Eventos de pago actualizan estado de suscripción en DB.
- Límites de plan se aplican correctamente tras cambio de estado.
- Existe estrategia documentada: coexistencia Stripe/Polar o migración.

## Verificación mínima

- pruebas end-to-end en sandbox de Polar.sh;
- pruebas de webhook con reintento y deduplicación;
- `cd backend && pnpm run build` y pruebas relevantes de suscripción.

## Riesgos

- inconsistencia de estado entre proveedor y DB.
- edge cases de downgrade/cancelación.
- complejidad extra si Stripe queda activo en paralelo.

