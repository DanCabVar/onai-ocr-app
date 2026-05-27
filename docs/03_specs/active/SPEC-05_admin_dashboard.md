# SPEC-05 — Admin dashboard

## Tarea relacionada

- `T06` Admin dashboard ONAI.

## Objetivo

Crear/consolidar dashboard interno para Danilo/ONAI con métricas de tenants, uso, costos, procesamiento y salud operativa.

## Alcance

Incluye:

- lista de usuarios/tenants;
- documentos procesados;
- tipos creados;
- uso estimado IA/OCR;
- errores recientes;
- estados de suscripción;
- acceso protegido por rol admin.

Excluye:

- analítica avanzada de negocio si no hay datos suficientes.

## Archivos/módulos probables

- branch local `claude/admin-dashboard` o `feature/admin-dashboard` como referencia;
- `backend/src/admin*`;
- `frontend/app/admin*`.

## Criterios de aceptación

- Solo admin accede.
- Métricas cargan desde backend real.
- No expone datos sensibles innecesarios.
- UI usable en desktop.

## Verificación mínima

- Backend build.
- Frontend build.
- Prueba login admin/no-admin.

## Riesgos

- Filtrar documentos/PII en panel admin.
- Duplicar trabajo ya existente en branches.
