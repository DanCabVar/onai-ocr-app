# PLAN_MAESTRO.md — ONAI OCR

## Propósito

Tablero operativo canónico del proyecto ONAI OCR. Define estado actual, prioridades, tareas, specs, bloqueos y próximos pasos para Smith, MC2 y subagentes.

## Estado general

- Proyecto: `ONAI OCR`
- Repo: `github.com/DanCabVar/onai-ocr-app`
- Workspace: `/root/.openclaw/workspace/onai-ocr-app`
- Branch local actual: `deploy/all-features`
- Producción Docker Compose: `/docker/onai-ocr`
- URLs públicas: `https://ocr.moti.cl`, `https://ocr-app.moti.cl`
- API health: `https://ocr.moti.cl/api/auth/health`
- MC2 board: `OCR AI`
- Board ID: `feb3547b-3f99-4b54-a68e-b6fd014bd112`

## Snapshot operativo — 2026-05-18

- App pública responde `200`.
- Backend health responde `status: ok`.
- Containers `frontend`, `backend`, `processor`, `postgres` corriendo.
- DB productiva observada:
  - `users`: 10
  - `documents`: 64
  - `document_types`: 13
- MC2 operativo en `https://mc2.moti.cl`.
- MC2 board OCR AI: 98 tareas; 89 `done`, 9 `inbox`.
- CI/CD por GitHub Actions existe; workflow `deploy-master.yml` hizo deploy exitoso a producción el `2026-04-02` vía GHCR + SSH.

## Arquitectura resumida

| Capa | Tecnología | Estado |
|---|---|---|
| Frontend | Next.js | Producción activa |
| Backend | NestJS | Producción activa, health ok |
| Processor | Python/LangGraph-ish | Producción activa, health ok |
| DB | PostgreSQL | Producción activa |
| Storage | Cloudflare R2 | Activo |
| IA/OCR | Mistral + Gemini | Activo |
| Reverse proxy | Traefik | Activo |
| CI/CD | GitHub Actions + GHCR + SSH | Activo para `master`; revisar ramas `dev/main` |
| Orquestación agentes | MC2 | Activo como tablero; subagentes sin actividad reciente |

## Tareas prioritarias

| ID | Prioridad | Tarea | Estado | Spec | Bloqueo / dependencia | Entregable | Próxima acción |
|---|---:|---|---|---|---|---|---|
| T01 | Alta | Frontend modo inbox/background upload | Disponible para agente | `SPEC-02_batch_inbox.md` | Backend ya tiene endpoint; falta UI final/polling UX | Modal/panel funcional para upload background | Revisar implementación actual y cerrar UX |
| T02 | Media-Alta | Script limpieza R2 legacy `extracted/` | Disponible para agente | `SPEC-03_r2_cleanup.md` | Requiere modo dry-run antes de borrar | Script seguro + reporte dry-run | Implementar script con dry-run y confirmación |
| T03 | Alta | Monitoring, health checks y alertas | Disponible para agente | `SPEC-07_monitoring_observabilidad.md` | Definir canal de alerta | Health dashboard/checks mínimos | Diseñar checks y cron/alertas |
| T04 | Alta | Actualizar documentación CI/CD e infraestructura | Disponible para agente | `SPEC-06_ci_cd_deploy.md` | Ninguno | Docs consistentes con deploy real | Actualizar `INFRA.md` y docs repo |
| T05 | Media-Alta | Stripe/billing/planes | Backlog | `SPEC-04_planes_stripe_billing.md` | Requiere decisión de pricing final | Checkout + enforcement planes | Validar modelo comercial antes de implementar |
| T06 | Media-Alta | Admin dashboard ONAI | Backlog | `SPEC-05_admin_dashboard.md` | Definir métricas y rol admin | Dashboard interno de uso/costos/tenants | Revisar branches existentes y consolidar |
| T07 | Media | Onboarding usuario nuevo | Backlog | `SPEC-08_onboarding.md` | Depende de UX producto | Flujo primer tipo/documento | Crear spec detallado luego |
| T08 | Alta | Hardening multi-tenant/RAG seguro | En revisión | `SPEC-01_rag_seguro_multitenant.md` | Confirmar migraciones realmente aplicadas en prod | RLS/vistas/prompt verificados | Auditar DB y backend |
| T09 | Media | Dominio profesional ONAI | Backlog | `SPEC-09_dominio_produccion.md` | Decisión dominio final | DNS/SSL/Traefik actualizado | Definir dominio oficial |

## Riesgos principales

- `INFRA.md` estaba desactualizado respecto al CI/CD real.
- MC2 contiene tareas históricas; debe sincronizarse con este plan para evitar doble verdad.
- Subagentes de MC2 aparecen registrados pero sin actividad reciente; si se reactivan, darles specs concretos.
- Hay ramas/features locales acumuladas; riesgo de duplicidad o merges conflictivos.
- RLS/RAG seguro figura como done en MC2, pero debe verificarse contra DB/código antes de confiar en producción.
- Limpieza R2 puede ser destructiva: exigir dry-run y respaldo mental/registro antes de ejecutar delete real.

## Próxima sesión recomendada

1. Cerrar T04: documentación CI/CD/infra.
2. Tomar T01 con subagente frontend o Smith directo.
3. Tomar T02 con modo dry-run, sin borrar hasta revisar output.
4. Auditar T08 antes de seguir escalando RAG/chat.
