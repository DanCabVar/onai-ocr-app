# Runbook — Deploy / rollback ONAI OCR

## Contexto

Leer también `docs/07_runbooks/branch-flow.md` antes de promover ramas o disparar deploys.


- Producción Docker Compose: `/docker/onai-ocr`
- Código fuente: `/root/.openclaw/workspace/onai-ocr-app`
- URLs: `https://ocr.moti.cl`, `https://ocr-app.moti.cl`
- Health API: `https://ocr.moti.cl/api/auth/health`
- CI/CD real: GitHub Actions `deploy-master.yml` vía GHCR + SSH.

## Verificación mínima antes/después

```bash
curl -fsS https://ocr.moti.cl/api/auth/health
```

Si se toca compose/infra:

```bash
cd /docker/onai-ocr
docker compose config
docker compose ps
docker compose logs --tail=100 backend frontend processor
```

## Regla

No usar `/root/projects/onai-ocr-app` para deploy. La ruta válida de trabajo es `/root/.openclaw/workspace/onai-ocr-app`.


## Flujo de ramas

El deploy normal no se hace desde branches sueltas. El flujo canónico es:

```txt
codex/spec-XX-* → dev → qa → master
```

- `dev`: integración de specs/features.
- `qa`: despliegue preproducción en `/docker/onai-ocr-qa`.
- `master`: despliegue producción en `/docker/onai-ocr`.
- `deploy/all-features`: legacy temporal; no usar para trabajo nuevo ni promociones nuevas.

Promover a producción solo después de que QA haya terminado OK y tenga health/container check correcto.
