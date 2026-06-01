# SPEC-15 — Agente QA automatizado con Playwright

## Tarea relacionada

- `T15` Crear flujo QA E2E automatizado con Playwright.

## Objetivo

Implementar un agente QA que ejecute pruebas E2E de smoke y regresión crítica en frontend/backend, con reportes reutilizables para cada release.

## Alcance

Incluye:

- bootstrap de Playwright en el frontend (o carpeta `tests/e2e` dedicada);
- suite inicial de smoke: auth, upload, listado, detalle, eliminación;
- ejecución headless en CI con artifacts (trace, screenshots, video opcional);
- guía operativa para correr QA local y en pipeline.

Excluye:

- cobertura E2E total de todas las rutas desde la primera iteración.

## Archivos/módulos probables

- `frontend/` o `tests/e2e/` (según decisión técnica)
- `.github/workflows/*`
- `docs/07_runbooks/local-dev.md`
- `docs/05_entregables/qa_reports/`

## Criterios de aceptación

- Existe comando único para correr smoke E2E.
- CI ejecuta la suite y publica artifacts ante fallo.
- Fallos QA entregan evidencia accionable (paso, selector, screenshot/trace).
- Runbook QA documentado.

## Verificación mínima

- ejecución local de al menos 5 casos smoke;
- ejecución en CI con artifacts visibles;
- reporte QA inicial en `docs/05_entregables/qa_reports/`.

## Riesgos

- flakiness por waits no determinísticos.
- dependencia de datos de prueba no aislados por tenant.
- mayor tiempo de pipeline si no se separa smoke vs regresión completa.

