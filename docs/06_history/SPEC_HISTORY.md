# SPEC_HISTORY — ONAI OCR

| ID | Spec | Estado | Última actualización | Evidencia / nota |
|---|---|---|---|---|
| SPEC-00 | `03_specs/active/SPEC-00_plan_maestro.md` | Activo transversal | 2026-05-27 | Pull + sincronización MC2; snapshot completo en `docs/06_history/MC2_TASKS_OCR_AI_2026-05-27.md`. |
| T08 / SPEC-01 | `03_specs/active/SPEC-01_rag_seguro_multitenant.md` | En revisión | 2026-05-27 | MC2 lo marca done; falta auditoría DB/código antes de cerrar en harness. |
| T01 / SPEC-02 | `03_specs/active/SPEC-02_batch_inbox.md` | Disponible | 2026-05-27 | Backend `upload-to-inbox` figura done; MC2 mantiene pendiente frontend modo inbox y QA leve checkbox. |
| T02 / SPEC-03 | `03_specs/active/SPEC-03_r2_cleanup.md` | Disponible | 2026-05-27 | MC2 mantiene pendiente script one-shot para limpiar legacy `extracted/`; requiere dry-run y aprobación para delete. |
| T05 / SPEC-04 | `03_specs/active/SPEC-04_planes_stripe_billing.md` | En revisión | 2026-05-27 | MC2 marca pricing/Stripe/límites como done; quedan oferta Enterprise y decisiones comerciales/facturación. |
| T06 / SPEC-05 | `03_specs/active/SPEC-05_admin_dashboard.md` | En revisión | 2026-05-27 | MC2 contiene tarea dashboard admin done; verificar existencia/rutas/permisos en código. |
| T04 / SPEC-06 | `03_specs/active/SPEC-06_ci_cd_deploy.md` | En revisión | 2026-05-27 | CI/CD real por GHCR + SSH; revisar contradicciones restantes. |
| T03 / SPEC-07 | `03_specs/active/SPEC-07_monitoring_observabilidad.md` | Disponible | 2026-05-27 | MC2 mantiene pendiente health checks, monitoring y alertas. |
| T07 / SPEC-08 | `03_specs/active/SPEC-08_onboarding.md` | Backlog | 2026-05-27 | Depende de UX producto; no aparece como pendiente MC2 explícito. |
| T09 / SPEC-09 | `03_specs/active/SPEC-09_dominio_produccion.md` | Requiere decisión usuario | 2026-05-27 | MC2 mantiene pendiente SSL/dominio propio `onaiconsulting.cl` o `onai.cl`. |
| T10 / SPEC-10 | `03_specs/active/SPEC-10_inferencia_muestras_paralelo_sse.md` | Disponible | 2026-05-27 | Nueva tarea MC2 pendiente: subir paralelismo y agregar progress events SSE. |
| T11 / SPEC-11 | `03_specs/active/SPEC-11_go_to_market_marketing.md` | Backlog | 2026-05-27 | Nueva tarea MC2 pendiente comercial: contenido LinkedIn/Instagram. |
| T12 / SPEC-12 | `03_specs/active/SPEC-12_operacion_legal_facturacion.md` | Requiere decisión usuario | 2026-05-27 | Nueva tarea MC2 pendiente: crear empresa/facturación; requiere acción humana. |
| T14 / SPEC-14 | `03_specs/active/SPEC-14_carga_paralela_archivos.md` | En trabajo por agente | 2026-05-27 | Rama de implementación activa `codex/spec-14-carga-paralela`; cambios funcionales quedan en esa rama y `deploy/all-features` solo actualiza estado documental. |
| T15 / SPEC-15 | `03_specs/active/SPEC-15_agente_qa_playwright.md` | Bloqueada por insumo | 2026-05-27 | Standby por falta de secrets E2E para validar flujo autenticado completo en CI; queda pendiente corrida con 5 casos y artifacts. |
| T16 / SPEC-16 | `03_specs/active/SPEC-16_test_obligatorio_por_spec.md` | En revisi�n | 2026-05-27 | Se agrega validador CI (`docs/scripts/validate-spec-test-policy.py`) + refuerzo de template/runbook; pendiente validacion en PR real de feature. |
| T17 / SPEC-17 | `03_specs/active/SPEC-17_integracion_pagos_polar_sh.md` | Requiere decision usuario | 2026-05-27 | Spec activo incorporado a tablero canonico; definir estrategia Stripe vs Polar antes de implementar. |
| T18 / SPEC-18 | `03_specs/active/SPEC-18_mejorar_landing.md` | Backlog | 2026-05-27 | Spec activo incorporado a tablero canonico; mejora comercial pendiente de priorizacion. |
| T19 / SPEC-19 | `03_specs/active/SPEC-19_revision_separacion_tenant.md` | Disponible | 2026-05-27 | Spec activo incorporado a tablero canonico; auditoria end-to-end de aislamiento multi-tenant pendiente. |
| T20 / SPEC-20 | `03_specs/active/SPEC-20_mejorar_agent_rag_neo4j.md` | Backlog | 2026-05-27 | Spec activo incorporado a tablero canonico; iniciativa exploratoria sujeta a madurez de hardening actual. |
| T21 / SPEC-21 | `03_specs/active/SPEC-21_respaldo_documentos_markdown_obsidian.md` | Backlog | 2026-05-27 | Spec activo incorporado a tablero canonico; pendiente definir retencion y seguridad de backups Markdown. |
| MC2-DONE-20260527 | `03_specs/done/SPEC-DONE-20260527_mc2_ocr_ai_completed.md` | Cerrada / importada | 2026-05-27 | Consolidado de 89 tareas `done` desde MC2 OCR AI para trazabilidad anti-retrabajo. |
