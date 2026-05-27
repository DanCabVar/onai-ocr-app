# Runbook - Desarrollo local ONAI OCR

## Objetivo

Dar una guia minima para levantar/verificar componentes locales sin confundirlos con produccion.

## Checklist

1. Confirmar branch y status:
   ```bash
   git branch --show-current
   git status --short
   ```
2. Revisar spec activo antes de tocar codigo.
3. Ejecutar verificacion minima segun capa:
   - Backend: `cd backend && pnpm run build`
   - Frontend: `cd frontend && pnpm run build` o `pnpm lint`
   - E2E smoke (Playwright): `cd frontend && pnpm run test:e2e:install && pnpm run test:e2e:smoke`
   - Processor: tests/ruff si aplica
4. Registrar evidencia en el reporte final y, si corresponde, en `docs/05_entregables/`.

## E2E smoke (SPEC-15)

Variables opcionales para flujo autenticado y operaciones sobre documentos:

- `E2E_BASE_URL` (ejemplo: `https://ocr.moti.cl` o `http://127.0.0.1:3000`)
- `E2E_USER_EMAIL`
- `E2E_USER_PASSWORD`

Comportamiento:

- Sin credenciales `E2E_USER_*`, la suite ejecuta smoke publico de login y omite pruebas autenticadas.
- Con credenciales, ejecuta smoke de auth, listado, detalle, upload y eliminacion.
