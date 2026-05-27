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
3. Si el cambio esta asociado a un spec activo, completar su seccion `Plan de prueba / verificacion minima` con casos positivos, negativos y de borde.
4. Implementar o actualizar al menos 1 test automatizado (excepto si aplica excepcion justificada en el spec).
5. Ejecutar verificacion minima segun capa:
   - Backend: `cd backend && pnpm run build`
   - Frontend: `cd frontend && pnpm run build` o `pnpm lint`
   - Processor: tests/ruff si aplica
6. Registrar evidencia en el reporte final y, si corresponde, en `docs/05_entregables/qa_reports/`.