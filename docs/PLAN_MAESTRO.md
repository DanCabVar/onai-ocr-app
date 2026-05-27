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

## Snapshot operativo — 2026-05-27

- Pull realizado sobre `deploy/all-features`: entraron commits que movieron `AGENTS.md` de `docs/` a la raíz del repo y ajustaron su referencia a `docs/PLAN_MAESTRO.md`.
- Harness documental queda bajo `docs/`, excepto `AGENTS.md`, que vive en la raíz para que los agentes lo encuentren automáticamente.
- MC2 operativo en `https://mc2.moti.cl`.
- MC2 board OCR AI: 98 tareas; 89 `done`, 9 `inbox`.
- Snapshot completo MC2: `docs/06_history/MC2_TASKS_OCR_AI_2026-05-27.md`.
- Specs done importados desde MC2: `docs/03_specs/done/SPEC-DONE-20260527_mc2_ocr_ai_completed.md`.
- CI/CD por GitHub Actions existe; workflow `deploy-master.yml` hizo deploy exitoso a producción el `2026-04-02` vía GHCR + SSH.

## Arquitectura resumida

| Capa | Tecnología | Estado |
|---|---|---|
| Frontend | Next.js | Producción activa |
| Backend | NestJS | Producción activa, health ok |
| Processor | Python/LangGraph-ish | Producción activa, con intención histórica de deprecar/consolidar en NestJS |
| DB | PostgreSQL | Producción activa |
| Storage | Cloudflare R2 | Activo; legacy `extracted/` pendiente de limpieza segura |
| IA/OCR | Mistral + Gemini | Activo |
| Reverse proxy | Traefik | Activo |
| CI/CD | GitHub Actions + GHCR + SSH | Activo para deploy producción; documentar/ordenar ramas |
| Orquestación agentes | MC2 | Activo como tablero; harness repo es fuente canónica |

## Lectura MC2 — qué ya está realizado

MC2 marca como `done` 89 tareas. Las líneas relevantes para no retrabajar:

- Deploy inicial en `ocr.moti.cl` completado.
- Migración a Cloudflare R2 completada y Google Drive legacy eliminado en gran parte.
- Esquema multi-tenant, suscripciones, límites de plan y hardening RAG/SQL figuran como completados en MC2.
- Landing/pricing/Stripe checkout/webhooks figuran como completados en MC2.
- RAG SQL/chat inteligente y múltiples fixes de seguridad/API figuran como completados.
- Backend batch/inbox (`upload-to-inbox` + worker background) completado.
- Modal confirming con 3 opciones y acción backend `assign_type` completados.
- Eliminación real de documentos y bloqueo de eliminación de tipos con documentos completados.
- Fixes QA recientes completados: `/almacenamiento` redirect, alias `inferFromSamplesWithProgress`, polling aceptable, eliminación real.

Regla: cualquier tarea marcada done en MC2 debe verificarse contra código/producción antes de reabrirse, pero no se reimplementa sin evidencia de drift.

## Tareas prioritarias vigentes

| ID | Prioridad | Tarea | Estado | Spec | Bloqueo / dependencia | Entregable | Próxima acción |
|---|---:|---|---|---|---|---|---|
| T01 | Alta | Cerrar frontend modo inbox/background upload | Disponible para agente | `docs/03_specs/active/SPEC-02_batch_inbox.md` | Backend ya figura done en MC2; queda UX/modal/panel | Checkbox, upload background y estados visibles en `/documents` | Auditar UI actual y cerrar pendiente MC2 |
| T02 | Media-Alta | Script limpieza R2 legacy `extracted/` | Disponible para agente | `docs/03_specs/active/SPEC-03_r2_cleanup.md` | Destructivo; delete real requiere aprobación posterior | Script seguro + reporte dry-run | Implementar dry-run y guardar reporte |
| T03 | Alta | Health checks, monitoring y alertas | Disponible para agente | `docs/03_specs/active/SPEC-07_monitoring_observabilidad.md` | Definir canal de alerta | Script/checks + runbook + logs | Diseñar checks mínimos y alerta no ruidosa |
| T04 | Alta | Documentación CI/CD e infraestructura | En revisión | `docs/03_specs/active/SPEC-06_ci_cd_deploy.md` | Ninguno | Docs consistentes con deploy real | Revisar contradicciones restantes y cerrar |
| T05 | Media | Planes, Stripe, billing y oferta Enterprise | En revisión | `docs/03_specs/active/SPEC-04_planes_stripe_billing.md` | Pricing/empresa/facturación chilena requieren decisión | Estado técnico verificado + pendientes comerciales separados | Auditar código Stripe/límites antes de cerrar |
| T06 | Media | Admin dashboard ONAI | En revisión | `docs/03_specs/active/SPEC-05_admin_dashboard.md` | Confirmar si lo done en MC2 existe en código | Dashboard admin verificado o brecha documentada | Revisar rutas/admin y permisos |
| T07 | Media | Onboarding usuario nuevo | Backlog | `docs/03_specs/active/SPEC-08_onboarding.md` | Depende de UX producto | Flujo primer tipo/documento | Crear spec detallado cuando se priorice |
| T08 | Alta | Hardening multi-tenant/RAG seguro | En revisión | `docs/03_specs/active/SPEC-01_rag_seguro_multitenant.md` | MC2 lo marca done, falta evidencia local actual | Auditoría DB/código + prueba aislamiento | Auditar antes de confiar en producción |
| T09 | Baja-Media | Dominio profesional ONAI | Requiere decisión usuario | `docs/03_specs/active/SPEC-09_dominio_produccion.md` | Elegir `onaiconsulting.cl`, `onai.cl` u otro | DNS/SSL/Traefik del dominio final | Esperar decisión de dominio |
| T10 | Alta | Inferir desde Muestras: paralelismo 10+ docs + progreso SSE | Disponible para agente | `docs/03_specs/active/SPEC-10_inferencia_muestras_paralelo_sse.md` | Riesgo rate limits Mistral/Gemini | Semáforos ajustados + progreso visible | Auditar servicio actual y diseñar throttling seguro |
| T11 | Baja | Go-to-market: marketing LinkedIn/Instagram | Backlog | `docs/03_specs/active/SPEC-11_go_to_market_marketing.md` | Requiere estrategia/mensajes | Calendario/contenido inicial | Postergar hasta decisión comercial |
| T12 | Baja | Operación legal/facturación Chile | Requiere decisión usuario | `docs/03_specs/active/SPEC-12_operacion_legal_facturacion.md` | Acción humana/SII/empresa | Checklist legal-operativo | No ejecutar acciones externas sin instrucción explícita |
| T13 | Alta | Migración a pnpm + remediación inicial de dependencias | En revisión | `docs/03_specs/active/SPEC-13_migracion_pnpm.md` | Quedan vulnerabilidades residuales de stack base | CI en pnpm + reducción de vulnerabilidades + reporte T13 | Validar cierre técnico y traspasar residuales a T22 |
| T14 | Alta | Carga paralela de archivos + progreso real por archivo | En trabajo por agente | `docs/03_specs/active/SPEC-14_carga_paralela_archivos.md` | Validaci�n manual de throughput 20+ y evidencia antes/despu�s pendiente | Throughput mejorado, estado por archivo en UI y reporte benchmark T14 | Ejecutar benchmark reproducible y cerrar evidencia en `docs/04_trabajo/T14_carga_paralela_archivos/` |
| T15 | Media | Agente QA automatizado con Playwright | Bloqueada por insumo | `docs/03_specs/active/SPEC-15_agente_qa_playwright.md` | Falta provisionar secrets E2E (`E2E_BASE_URL`, `E2E_USER_EMAIL`, `E2E_USER_PASSWORD`) para smoke autenticado en CI | Suite E2E smoke + artifacts + runbook QA | Esperar variables E2E y luego ejecutar corrida completa en CI (5 casos) |
| T16 | Alta | Test obligatorio por cada nuevo spec | En revisi�n | `docs/03_specs/active/SPEC-16_test_obligatorio_por_spec.md` | Ajuste de plantilla/spec + validacion CI | Politica ejecutable de testing por spec + checklist | Validar CI y evidencia de uso con primer PR de feature |
| T17 | Media | Integracion de pagos con Polar.sh | En revisi�n | `docs/03_specs/active/SPEC-17_integracion_pagos_polar_sh.md` | Validar sandbox Polar, secrets y smoke antes de merge/deploy | Implementacion checkout/webhook Polar + compatibilidad Stripe legacy en rama de spec | Revisar PR `codex/spec-17-integracion-polar-sh` y ejecutar checklist de validacion |
| T18 | Media | Mejorar landing comercial | Backlog | `docs/03_specs/active/SPEC-18_mejorar_landing.md` | Coordinar mensaje con oferta comercial vigente | Landing optimizada con metricas de conversion | Priorizar luego de cerrar pendientes tecnicos de alta criticidad |
| T19 | Alta | Revision de separacion por tenant | En revision | `docs/03_specs/active/SPEC-19_revision_separacion_tenant.md` | Complementa auditoria de seguridad de T08 | Informe de auditoria + hardening + pruebas de fuga cruzada | Validar E2E con 2 tenants y cerrar evidencia final |
| T20 | Media | Mejorar agente RAG con grafo Neo4j | En trabajo por agente | docs/03_specs/active/SPEC-20_mejorar_agent_rag_neo4j.md | Incrementa complejidad operativa e infraestructura | Diseno + PoC de consulta hibrida SQL+grafo | Implementacion funcional en rama codex/spec-20-mejorar-agent-rag-neo4j; mantener deploy en docs-only hasta validacion benchmark |
| T21 | Media | Respaldo de documentos Markdown (Obsidian) | En trabajo por agente | `docs/03_specs/active/SPEC-21_respaldo_documentos_markdown_obsidian.md` | Revisar retencion y datos sensibles antes de merge/deploy | Generacion `.md` por documento con frontmatter + enlaces tipo Obsidian | Implementacion funcional en rama `codex/spec-21-markdown-obsidian-graph`; mantener `deploy/all-features` en docs-only hasta validacion final |
| T22 | Alta | Remediación de vulnerabilidades residuales post-SPEC-13 | Disponible para agente | `docs/03_specs/active/SPEC-22_remediacion_vulnerabilidades_residuales.md` | Puede requerir upgrades estructurales Nest/Express/TypeORM | Plan y ejecución de remediación residual con evidencia | Priorizar hallazgos high restantes y definir mitigaciones |

## Harness operativo — 2026-05-27

- `AGENTS.md` vive en raíz del repo.
- Harness documental vive en `docs/`: fuentes, contexto, specs, trabajo, entregables, history, runbooks, templates y scripts.
- Specs activos viven en `docs/03_specs/active/`.
- Historial operativo vive en `docs/06_history/`.
- Validador estructural: `python3 docs/scripts/validate-harness.py`.

## Runbooks obligatorios según tarea

| Caso | Leer |
|---|---|
| Deploy, rollback, CI/CD o producción | `docs/07_runbooks/deploy.md` |
| Desarrollo/verificación local | `docs/07_runbooks/local-dev.md` |
| Secretos, env vars o credenciales | `docs/07_runbooks/secrets.md` |
| Monitoring, health checks o alertas | `docs/07_runbooks/monitoring.md` |

## Riesgos principales

- MC2 contiene tareas históricas y tareas técnicas/comerciales mezcladas; este plan consolida lo vigente.
- Varias tareas críticas figuran `done` en MC2, pero algunas requieren verificación contra código/DB antes de cerrarse en harness.
- T13 está en revisión: la migración a pnpm quedó aplicada, pero vulnerabilidades residuales pasan a seguimiento activo en T22.
- Limpieza R2 puede ser destructiva: exigir dry-run y aprobación explícita antes de `--execute`.
- Aumentar paralelismo en inferencia puede disparar rate limits/costos si no hay semáforos y backoff.
- Cambios de dominio pueden romper variables bakeadas, redirects, CORS o callbacks.
- Tareas legales/comerciales no deben automatizarse como acciones externas sin confirmación de Danilo.

## Próxima sesión recomendada

1. T01: cerrar UX de modo inbox/background upload.
2. T02: preparar script R2 dry-run, sin delete real.
3. T10: revisar paralelismo/SSE de Inferir desde Muestras.
4. T03: health checks/alertas mínimas.
5. T08/T05/T06: auditar tareas marcadas done por MC2 antes de cerrarlas en harness.

