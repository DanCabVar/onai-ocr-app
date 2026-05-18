# SPEC-04 — Planes, Stripe y billing

## Tarea relacionada

- `T05` Stripe/billing/planes.

## Objetivo

Implementar monetización SaaS con planes, checkout, webhooks y enforcement de límites.

## Alcance inicial

Incluye:

- modelo de planes Free/Starter/Pro/Enterprise;
- checkout Stripe;
- webhook para activar/cambiar suscripción;
- límites por documentos/mes/tipos/usuarios según plan;
- UI pricing conectada a backend;
- estado de suscripción en settings/admin.

Excluye:

- facturación chilena/SII automática, salvo decisión posterior.

## Archivos/módulos probables

- `backend/src/subscriptions*`
- `backend/src/billing*`
- `frontend/app/pricing*`
- `frontend/app/settings*`

## Criterios de aceptación

- Usuario puede iniciar checkout.
- Webhook actualiza suscripción de forma idempotente.
- Límites se hacen cumplir en backend.
- UI muestra plan actual y límites.
- Tests o verificación con Stripe test mode.

## Verificación mínima

- Backend build.
- Frontend build.
- Prueba con Stripe test mode o mock documentado.

## Riesgos

- Cobrar sin activar plan.
- Activar plan sin pago confirmado.
- Límites solo visuales y no backend.
