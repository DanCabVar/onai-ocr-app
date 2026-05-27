# Runbook — Desarrollo local ONAI OCR

## Objetivo

Dar una guía mínima para levantar/verificar componentes locales sin confundirlos con producción.

## Checklist

1. Confirmar branch y status:
   ```bash
   git branch --show-current
   git status --short
   ```
2. Revisar spec activo antes de tocar código.
3. Ejecutar verificación mínima según capa:
   - Backend: `cd backend && pnpm run build`
   - Frontend: `cd frontend && pnpm run build` o `pnpm lint`
   - Processor: tests/ruff si aplica
4. Registrar evidencia en el reporte final y, si corresponde, en `05_entregables/`.
