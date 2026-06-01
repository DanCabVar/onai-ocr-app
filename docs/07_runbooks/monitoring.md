# Runbook — Monitoring / health checks ONAI OCR

## Checks mínimos

- API: `curl -fsS https://ocr.moti.cl/api/auth/health`
- Containers: `docker compose ps` en `/docker/onai-ocr`
- Logs recientes: backend, frontend, processor
- Disco: `df -h`

## Alertas candidatas

- Health API no responde 2xx.
- Backend/processor reiniciando.
- Errores 5xx sostenidos.
- Disco alto.
- Fallas de acceso a R2/DB/IA provider.
