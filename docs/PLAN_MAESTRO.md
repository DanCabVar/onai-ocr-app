# PLAN_MAESTRO.md â€” ONAI OCR

## PropÃ³sito

Tablero operativo canÃ³nico del proyecto ONAI OCR. Define estado actual, prioridades, tareas, specs, bloqueos y prÃ³ximos pasos para Smith, MC2 y subagentes.

## Estado general

- Proyecto: `ONAI OCR`
- Repo: `github.com/DanCabVar/onai-ocr-app`
- Workspace: `/root/.openclaw/workspace/onai-ocr-app`
- Branch base de integración: `dev`
- Flujo de promoción: `codex/spec-*` → `dev` → `qa` → `master`
- ProducciÃ³n Docker Compose: `/docker/onai-ocr`
- URLs pÃºblicas: `https://ocr.moti.cl`, `https://ocr-app.moti.cl`
- API health: `https://ocr.moti.cl/api/auth/health`
- MC2 board: `OCR AI`
- Board ID: `feb3547b-3f99-4b54-a68e-b6fd014bd112`

## Snapshot operativo â€” 2026-05-27

- Pull realizado sobre `deploy/all-features`: entraron commits que movieron `AGENTS.md` de `docs/` a la raÃ­z del repo y ajustaron su referencia a `docs/PLAN_MAESTRO.md`.
- Harness documental queda bajo `docs/`, excepto `AGENTS.md`, que vive en la raÃ­z para que los agentes lo encuentren automÃ¡ticamente.
- MC2 operativo en `https://mc2.moti.cl`.
- MC2 board OCR AI: 98 tareas; 89 `done`, 9 `inbox`.
- Snapshot completo MC2: `docs/06_history/MC2_TASKS_OCR_AI_2026-05-27.md`.
- Specs done importados desde MC2: `docs/03_specs/done/SPEC-DONE-20260527_mc2_ocr_ai_completed.md`.
- CI/CD por GitHub Actions existe; workflow `deploy-master.yml` hizo deploy exitoso a producciÃ³n el `2026-04-02` vÃ­a GHCR + SSH.

## Arquitectura resumida

| Capa | TecnologÃ­a | Estado |
|---|---|---|
| Frontend | Next.js | ProducciÃ³n activa |
| Backend | NestJS | ProducciÃ³n activa, health ok |
| Processor | Python/LangGraph-ish | ProducciÃ³n activa, con intenciÃ³n histÃ³rica de deprecar/consolidar en NestJS |
| DB | PostgreSQL | ProducciÃ³n activa |
| Storage | Cloudflare R2 | Activo; legacy `extracted/` pendiente de limpieza segura |
| IA/OCR | Mistral + Gemini | Activo |
| Reverse proxy | Traefik | Activo |
| CI/CD | GitHub Actions + GHCR + SSH | Activo para deploy producciÃ³n; documentar/ordenar ramas |
| OrquestaciÃ³n agentes | MC2 | Activo como tablero; harness repo es fuente canÃ³nica |

## Lectura MC2 â€” quÃ© ya estÃ¡ realizado

MC2 marca como `done` 89 tareas. Las lÃ­neas relevantes para no retrabajar:

- Deploy inicial en `ocr.moti.cl` completado.
- MigraciÃ³n a Cloudflare R2 completada y Google Drive legacy eliminado en gran parte.
- Esquema multi-tenant, suscripciones, lÃ­mites de plan y hardening RAG/SQL figuran como completados en MC2.
- Landing/pricing/Stripe checkout/webhooks figuran como completados en MC2.
- RAG SQL/chat inteligente y mÃºltiples fixes de seguridad/API figuran como completados.
- Backend batch/inbox (`upload-to-inbox` + worker background) completado.
- Modal confirming con 3 opciones y acciÃ³n backend `assign_type` completados.
- EliminaciÃ³n real de documentos y bloqueo de eliminaciÃ³n de tipos con documentos completados.
- Fixes QA recientes completados: `/almacenamiento` redirect, alias `inferFromSamplesWithProgress`, polling aceptable, eliminaciÃ³n real.

Regla: cualquier tarea marcada done en MC2 debe verificarse contra cÃ³digo/producciÃ³n antes de reabrirse, pero no se reimplementa sin evidencia de drift.

## Tareas prioritarias vigentes

| ID | Prioridad | Tarea | Estado | Spec | Bloqueo / dependencia | Entregable | PrÃ³xima acciÃ³n |
|---|---:|---|---|---|---|---|---|
| T01 | Alta | Cerrar frontend modo inbox/background upload | Disponible para agente | `docs/03_specs/active/SPEC-02_batch_inbox.md` | Backend ya figura done en MC2; queda UX/modal/panel | Checkbox, upload background y estados visibles en `/documents` | Auditar UI actual y cerrar pendiente MC2 |
| T02 | Media-Alta | Script limpieza R2 legacy `extracted/` | Disponible para agente | `docs/03_specs/active/SPEC-03_r2_cleanup.md` | Destructivo; delete real requiere aprobaciÃ³n posterior | Script seguro + reporte dry-run | Implementar dry-run y guardar reporte |
| T03 | Alta | Health checks, monitoring y alertas | Disponible para agente | `docs/03_specs/active/SPEC-07_monitoring_observabilidad.md` | Definir canal de alerta | Script/checks + runbook + logs | DiseÃ±ar checks mÃ­nimos y alerta no ruidosa |
| T04 | Alta | DocumentaciÃ³n CI/CD e infraestructura | En revisiÃ³n | `docs/03_specs/active/SPEC-06_ci_cd_deploy.md` | Ninguno | Docs consistentes con deploy real | Revisar contradicciones restantes y cerrar |
| T05 | Media | Planes, Stripe, billing y oferta Enterprise | En revisiÃ³n | `docs/03_specs/active/SPEC-04_planes_stripe_billing.md` | Pricing/empresa/facturaciÃ³n chilena requieren decisiÃ³n | Estado tÃ©cnico verificado + pendientes comerciales separados | Auditar cÃ³digo Stripe/lÃ­mites antes de cerrar |
| T06 | Media | Admin dashboard ONAI | En revisiÃ³n | `docs/03_specs/active/SPEC-05_admin_dashboard.md` | Confirmar si lo done en MC2 existe en cÃ³digo | Dashboard admin verificado o brecha documentada | Revisar rutas/admin y permisos |
| T07 | Media | Onboarding usuario nuevo | Backlog | `docs/03_specs/active/SPEC-08_onboarding.md` | Depende de UX producto | Flujo primer tipo/documento | Crear spec detallado cuando se priorice |
| T08 | Alta | Hardening multi-tenant/RAG seguro | En revisiÃ³n | `docs/03_specs/active/SPEC-01_rag_seguro_multitenant.md` | MC2 lo marca done, falta evidencia local actual | AuditorÃ­a DB/cÃ³digo + prueba aislamiento | Auditar antes de confiar en producciÃ³n |
| T09 | Baja-Media | Dominio profesional ONAI | Requiere decisiÃ³n usuario | `docs/03_specs/active/SPEC-09_dominio_produccion.md` | Elegir `onaiconsulting.cl`, `onai.cl` u otro | DNS/SSL/Traefik del dominio final | Esperar decisiÃ³n de dominio |
| T10 | Alta | Inferir desde Muestras: paralelismo 10+ docs + progreso SSE | Disponible para agente | `docs/03_specs/active/SPEC-10_inferencia_muestras_paralelo_sse.md` | Riesgo rate limits Mistral/Gemini | SemÃ¡foros ajustados + progreso visible | Auditar servicio actual y diseÃ±ar throttling seguro |
| T11 | Baja | Go-to-market: marketing LinkedIn/Instagram | Backlog | `docs/03_specs/active/SPEC-11_go_to_market_marketing.md` | Requiere estrategia/mensajes | Calendario/contenido inicial | Postergar hasta decisiÃ³n comercial |
| T12 | Baja | OperaciÃ³n legal/facturaciÃ³n Chile | Requiere decisiÃ³n usuario | `docs/03_specs/active/SPEC-12_operacion_legal_facturacion.md` | AcciÃ³n humana/SII/empresa | Checklist legal-operativo | No ejecutar acciones externas sin instrucciÃ³n explÃ­cita |
| T13 | Alta | MigraciÃ³n a pnpm + remediaciÃ³n inicial de dependencias | En revisiÃ³n | `docs/03_specs/active/SPEC-13_migracion_pnpm.md` | Quedan vulnerabilidades residuales de stack base | CI en pnpm + reducciÃ³n de vulnerabilidades + reporte T13 | Validar cierre tÃ©cnico y traspasar residuales a T22 |
| T14 | Alta | Carga paralela de archivos + progreso real por archivo | En revisión | `docs/03_specs/active/SPEC-14_carga_paralela_archivos.md` | Pendiente validación operativa (lote 20+, benchmark antes/después, error parcial, límites por plan) y cierre documental | Throughput mejorado, estado por archivo en UI y reporte benchmark T14 | Ejecutar validaciones operativas pendientes, consolidar evidencia y mover a Lista para deploy |
| T15 | Media | Agente QA automatizado con Playwright | Bloqueada por insumo | `docs/03_specs/active/SPEC-15_agente_qa_playwright.md` | Falta provisionar secrets E2E (`E2E_BASE_URL`, `E2E_USER_EMAIL`, `E2E_USER_PASSWORD`) para smoke autenticado en CI | Suite E2E smoke + artifacts + runbook QA | Esperar variables E2E y luego ejecutar corrida completa en CI (5 casos) |
| T16 | Alta | Test obligatorio por cada nuevo spec | En revisiï¿½n | `docs/03_specs/active/SPEC-16_test_obligatorio_por_spec.md` | Ajuste de plantilla/spec + validacion CI | Politica ejecutable de testing por spec + checklist | Validar CI y evidencia de uso con primer PR de feature |
| T17 | Media | Integracion de pagos con Polar.sh | En revisi?n | `docs/03_specs/active/SPEC-17_integracion_pagos_polar_sh.md` | Pendiente configurar secrets/sandbox Polar y ejecutar smoke end-to-end en QA antes de promoci?n | Integraci?n checkout/webhook Polar + compatibilidad Stripe legacy ya integrada en `dev-local` con build OK y `polar.service.spec.ts` en verde | Promover `dev -> qa`, configurar credenciales Polar de QA y validar checkout/portal/webhook completo |
| T18 | Media | Mejorar landing comercial | Backlog | `docs/03_specs/active/SPEC-18_mejorar_landing.md` | Coordinar mensaje con oferta comercial vigente | Landing optimizada con metricas de conversion | Priorizar luego de cerrar pendientes tecnicos de alta criticidad |
| T19 | Alta | Revision de separacion por tenant | Cerrada | `docs/03_specs/active/SPEC-19_revision_separacion_tenant.md` | Complementa auditoria de seguridad de T08; hardening RAG/RLS/storage auditado, corregido hallazgo de inferencia cross-tenant y validado en QA que tipos y chat responden aislados por tenant | Informe de auditoria + hardening + pruebas de fuga cruzada | Cerrada con evidencia QA en `docs/04_trabajo/T19_revision_separacion_tenant/REPORTE_T19_2026-05-27.md` |
| T20 | Media | Mejorar agente RAG con grafo Neo4j | En revisión | `docs/03_specs/active/SPEC-20_mejorar_agent_rag_neo4j.md` | Validación QA parcial OK: follow-ups, fechas, tipos y parte de consultas por entidad mejoran; pendiente benchmark de calidad/latencia y validación controlada del híbrido/fallback. La robustez transversal del chatbot frente a documentos nuevos se desacopla en `T28` | PoC híbrida SQL+grafo integrada en `dev-local` detrás de feature flag con evidencia QA parcial | Cerrar esta iteración de T20 y continuar mejoras generales del chatbot desde `T28`; dejar T20 pendiente solo para benchmark/evidencia del híbrido |
| T21 | Media | Respaldo de documentos Markdown (Obsidian) | En revisión | `docs/03_specs/active/SPEC-21_respaldo_documentos_markdown_obsidian.md` | Pendiente validación operativa final (retención, datos sensibles, consistencia de reproceso) | Generacion `.md` por documento con frontmatter + enlaces tipo Obsidian | Cerrar QA funcional/operativo y consolidar evidencia para merge |
| T22 | Alta | RemediaciÃ³n de vulnerabilidades residuales post-SPEC-13 | En revisiÃ³n | `docs/03_specs/active/SPEC-22_remediacion_vulnerabilidades_residuales.md` | Residual high en lodash depende de parche npm >=4.18.0 o reemplazo de dependencia raÃ­z | RemediaciÃ³n ejecutada + evidencia en `docs/04_trabajo/T22_remediacion_vulnerabilidades_residuales/README.md` | Monitorear release parcheado de lodash y cerrar residual con upgrade estructural |
| T23 | Alta | Estandarizar configuración ESLint (frontend + backend) | En revisión | `docs/03_specs/active/SPEC-23_estandarizar_eslint_config.md` | Pendiente validación final lint+build en ambos proyectos y evidencia CI | Config ESLint versionada + CI ejecutando lint obligatorio en ambos proyectos | Consolidar evidencia final y preparar merge a rama deploy |
| T24 | Alta | RAG híbrido sobre Markdown grafo (Obsidian-ready) | En revisión | `docs/03_specs/active/SPEC-24_rag_hibrido_markdown_grafo_obsidian.md` | Depende de outputs de SPEC-21 y control estricto de aislamiento por tenant | Retrieval híbrido con trazabilidad de fuentes desde respaldos Markdown | Validar E2E tenant real y preparar merge desde `codex/spec-24-rag-hibrido-markdown-grafo-obsidian`; evidencia en `docs/04_trabajo/T24_rag_hibrido_markdown_grafo_obsidian/README.md` |
| T25 | Alta | Plan PRD por fases para cierre sin retrabajo | Disponible para agente | `docs/03_specs/active/SPEC-25_plan_prd_fases_cierre_sin_retrabajo.md` | Requiere disciplina de ejecución y evidencia homogénea por spec | Hoja de ruta de implementación/cierre por fases + plantilla PRD mínima estandarizada | Ejecutar fase fundacional y actualizar estados con evidencia por cada spec |
| T26 | Alta | Migraciones DB seguras en CI/CD | En revisión | `docs/03_specs/active/SPEC-26_db_migrations_ci_cd.md` | Implementación base validada en QA: configuración TypeORM centralizada, scripts `db:*`, workflow QA con migrate y bootstrap histórico tolerante; resta validar flujo productivo con backup real | Migraciones versionadas, `synchronize` desactivado en QA/prod, backup prod y runbook DB | Mantener en revisión hasta validar promoción controlada a producción con backup+migrate |
| T27 | Media-Alta | Migración controlada de TypeORM a Prisma | Backlog | `docs/03_specs/active/SPEC-27_migracion_typeorm_a_prisma.md` | Depende de T26; cambio transversal de backend | Backend usando Prisma con baseline seguro y QA completo | Ejecutar después de T26, por módulos y con rollback claro |
| T28 | Alta | Calidad y consistencia del chatbot documental | En revisión | `docs/03_specs/active/SPEC-28_calidad_chatbot_documental.md` | Iteración 1 validada en QA (5 PASS / 7 FAIL). Iteración 2 corrige las 4 causas raíz: entity resolution current-first (no hereda filename del bot), tipos con `inferred_type` (LEFT JOIN), resolución sobre campos extraídos+inferidos, scoping exclusivo por filename y guard de ambigüedad (`T28-014`). 47 tests + build OK en `dev-local`. Falta re-validar en QA los casos `fixing` del benchmark | Estrategia robusta de chatbot + benchmark versionado + regresiones automáticas | Promover `dev-local → dev → qa` y re-correr benchmark; confirmar PASS de T28-002/004/005/007/010/014/015 y marcar `fixing`→`pass` |

## Harness operativo â€” 2026-05-27

- `AGENTS.md` vive en raÃ­z del repo.
- Harness documental vive en `docs/`: fuentes, contexto, specs, trabajo, entregables, history, runbooks, templates y scripts.
- Specs activos viven en `docs/03_specs/active/`.
- Historial operativo vive en `docs/06_history/`.
- Validador estructural: `python3 docs/scripts/validate-harness.py`.

## Runbooks obligatorios segÃºn tarea

| Caso | Leer |
|---|---|
| Deploy, rollback, CI/CD o producciÃ³n | `docs/07_runbooks/deploy.md` |
| Branches, merges o promociones | `docs/07_runbooks/branch-flow.md` |
| Desarrollo/verificaciÃ³n local | `docs/07_runbooks/local-dev.md` |
| Secretos, env vars o credenciales | `docs/07_runbooks/secrets.md` |
| Monitoring, health checks o alertas | `docs/07_runbooks/monitoring.md` |

## Flujo de ramas actualizado — 2026-06-01

- `dev` queda como rama de integración clonada desde `deploy/all-features`.
- Cada feature/spec debe nacer y mantenerse en una rama propia `codex/spec-XX-*` hasta revisión.
- Promoción obligatoria: `dev → qa → master`.
- `qa` despliega el ambiente QA; `master` despliega producción.
- `deploy/all-features` queda legacy temporal y no se elimina hasta instrucción explícita de Danilo.
- Runbook obligatorio: `docs/07_runbooks/branch-flow.md`.

## Riesgos principales

- MC2 contiene tareas histÃ³ricas y tareas tÃ©cnicas/comerciales mezcladas; este plan consolida lo vigente.
- Varias tareas crÃ­ticas figuran `done` en MC2, pero algunas requieren verificaciÃ³n contra cÃ³digo/DB antes de cerrarse en harness.
- T13 estÃ¡ en revisiÃ³n: la migraciÃ³n a pnpm quedÃ³ aplicada, pero vulnerabilidades residuales pasan a seguimiento activo en T22.
- T26/T27: antes de seguir cambiando schema, estabilizar migraciones DB en CI/CD y luego migrar TypeORM → Prisma de forma controlada.
- Limpieza R2 puede ser destructiva: exigir dry-run y aprobaciÃ³n explÃ­cita antes de `--execute`.
- Aumentar paralelismo en inferencia puede disparar rate limits/costos si no hay semÃ¡foros y backoff.
- Cambios de dominio pueden romper variables bakeadas, redirects, CORS o callbacks.
- Tareas legales/comerciales no deben automatizarse como acciones externas sin confirmaciÃ³n de Danilo.

## PrÃ³xima sesiÃ³n recomendada

1. T01: cerrar UX de modo inbox/background upload.
2. T02: preparar script R2 dry-run, sin delete real.
3. T10: revisar paralelismo/SSE de Inferir desde Muestras.
4. T03: health checks/alertas mÃ­nimas.
5. T08/T05/T06: auditar tareas marcadas done por MC2 antes de cerrarlas en harness.




