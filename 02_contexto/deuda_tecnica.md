# Deuda técnica — ONAI OCR

## Alta prioridad

- Verificar que RLS/vistas filtradas para RAG multi-tenant estén realmente aplicadas en producción.
- Cerrar UX de upload background/inbox en frontend.
- Agregar monitoring, health checks y alertas.
- Mantener docs de infra/CI/CD sincronizados con producción real.

## Media prioridad

- Script seguro para limpiar objetos legacy `extracted/` en R2.
- Mejorar paralelismo de inferencia desde muestras a 10+ documentos con feedback de progreso.
- Consolidar ramas/features acumuladas para evitar drift.
- Revisar endpoints legacy Google Drive en docs/logs si ya no son parte del producto.

## Producto/comercial

- Stripe y enforcement real de planes.
- Admin dashboard para uso, costos, tenants y analítica.
- Onboarding de usuario nuevo.
- Dominio profesional ONAI y assets comerciales.

## Operación

- Runbook de deploy/rollback.
- Backups DB/R2 documentados.
- Alertas por caída de health, errores 5xx y agotamiento de disco.
