# QA Report - SPEC-15 Playwright Smoke

Fecha: 2026-05-27
Spec: `docs/03_specs/active/SPEC-15_agente_qa_playwright.md`

## Alcance

- Bootstrap Playwright en frontend.
- Suite smoke E2E inicial.
- Integracion CI con artifacts ante falla.

## Casos smoke definidos

1. Render de login.
2. Auth y acceso a dashboard (con credenciales E2E).
3. Listado de documentos.
4. Apertura de detalle de documento.
5. Upload y eliminacion de documento.

## Comandos de ejecucion

```bash
cd frontend
pnpm install
pnpm run test:e2e:install
pnpm run test:e2e:smoke
```

## Evidencia

- Reporte HTML Playwright: `frontend/playwright-report/`.
- Artifacts CI en falla: `playwright-smoke-artifacts`.
- Ejecucion local (2026-05-27):
  - `pnpm run test:e2e:smoke`
  - Resultado: `1 passed`, `4 skipped` (casos autenticados omitidos por falta de `E2E_USER_*`).

## Notas

- Si no existen `E2E_USER_EMAIL` y `E2E_USER_PASSWORD`, solo corre smoke publico y se omiten casos autenticados.
- Para flujo completo, definir `E2E_BASE_URL` + credenciales validas del entorno objetivo.
