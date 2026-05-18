# Deploy note — Estado CI/CD ONAI OCR — 2026-05-18

## Evidencia observada

`gh run list --repo DanCabVar/onai-ocr-app` muestra deploys exitosos del workflow `Deploy to Production (master)` el `2026-04-02`.

Workflow relevante:

- `.github/workflows/deploy-master.yml`
- Trigger: push a `master`
- Build/push: GHCR
- Deploy: SSH al VPS
- Path: `/docker/onai-ocr`
- Comando: `docker compose pull && docker compose up -d --remove-orphans`

## Verificación productiva

- `https://ocr.moti.cl` responde `200`.
- `https://ocr.moti.cl/api/auth/health` responde `200` con `status: ok`.
- Containers productivos activos: frontend, backend, processor, postgres.

## Decisión documental

Se actualizó `/root/.openclaw/workspace/INFRA.md` porque decía que GitHub Actions no deployaba y que todo era manual. Eso quedó obsoleto para `master`.
