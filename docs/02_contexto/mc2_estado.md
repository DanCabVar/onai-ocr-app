# MC2 — Estado OCR AI

Última sincronización: 2026-05-27.

## Board

- Nombre: `OCR AI`
- Board ID: `feb3547b-3f99-4b54-a68e-b6fd014bd112`
- Total observado: 98 tareas
- Realizadas: 89
- Pendientes/inbox: 9
- Snapshot completo: `docs/06_history/MC2_TASKS_OCR_AI_2026-05-27.md`

## Pendientes MC2 vigentes

| Prioridad | Tarea MC2 | Mapeo harness/spec | Nota |
|---|---|---|---|
| Media | QA leve: checkbox background visible solo post-selección archivos | T01 / `docs/03_specs/active/SPEC-02_batch_inbox.md` | Aceptable/no bloqueante; documentar criterio UX. |
| Alta | Aumentar paralelo en Inferir desde Muestras a 10+ docs | T10 / `docs/03_specs/active/SPEC-10_inferencia_muestras_paralelo_sse.md` | Subir semáforos OCR 3→5, classify 5→10, extract 3→5; agregar SSE/progress events. |
| Media | Migración DB/script para limpiar `extracted/` existentes en R2 | T02 / `docs/03_specs/active/SPEC-03_r2_cleanup.md` | Destructivo; exige dry-run y aprobación antes de delete real. |
| Alta | Frontend modo inbox en upload modal | T01 / `docs/03_specs/active/SPEC-02_batch_inbox.md` | Backend MC2 ya figura completado; queda cierre UX/frontend. |
| Baja | Oferta Enterprise: servidores dedicados + modelos open source | T05 / `docs/03_specs/active/SPEC-04_planes_stripe_billing.md` | Agregar como variante Enterprise/premium, no implementación inmediata. |
| Baja | Contenido marketing: LinkedIn + Instagram para empresas | T11 / `docs/03_specs/active/SPEC-11_go_to_market_marketing.md` | Tarea comercial fuera del core técnico. |
| Baja | Crear empresa + facturación | T12 / `docs/03_specs/active/SPEC-12_operacion_legal_facturacion.md` | Requiere decisión/acción humana; no automatizar. |
| Alta | Health checks, monitoring y alertas | T03 / `docs/03_specs/active/SPEC-07_monitoring_observabilidad.md` | Pendiente operativo. |
| Baja | SSL propio + dominio `onaiconsulting.cl` o `onai.cl` | T09 / `docs/03_specs/active/SPEC-09_dominio_produccion.md` | Bloqueado por decisión de dominio final. |

## Lectura operativa

MC2 confirma que la mayoría del trabajo core quedó realizado: deploy inicial, R2, multi-tenant, RAG SQL, landing/pricing/Stripe, batch backend, confirming modal, eliminación real de documentos y varios fixes QA.

Los pendientes reales se concentran en:

1. Cierre UX del modo inbox/background upload.
2. Limpieza segura de legacy R2 `extracted/`.
3. Monitoring/alertas.
4. Performance/progreso en Inferir desde Muestras.
5. Decisiones comerciales/legales/dominio.

MC2 se usa como orquestador/kanban para subagentes, pero `docs/PLAN_MAESTRO.md` queda como fuente canónica del estado del proyecto.
