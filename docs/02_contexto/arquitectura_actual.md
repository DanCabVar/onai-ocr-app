# Arquitectura actual — ONAI OCR

## Runtime productivo

```txt
Internet
  ↓
Cloudflare DNS
  ↓
Traefik host network :80/:443
  ├─ ocr.moti.cl / ocr-app.moti.cl → frontend:3000
  └─ /api/* → backend:4000
        ↓
      PostgreSQL
        ↓
      Processor Python:8000
        ↓
      Mistral/Gemini/R2
```

## Servicios Docker

| Servicio | Container | Rol |
|---|---|---|
| Frontend | `onai-ocr-frontend` | UI Next.js |
| Backend | `onai-ocr-backend` | API NestJS |
| Processor | `onai-ocr-processor` | OCR/procesamiento Python |
| DB | `onai-ocr-postgres` | PostgreSQL |
| Proxy | `traefik-traefik-1` | TLS/routing |

## Código y deploy

- Código: `/root/.openclaw/workspace/onai-ocr-app`.
- Compose productivo: `/docker/onai-ocr/docker-compose.yml`.
- Imágenes productivas desde GHCR.
- Workflow confirmado: `.github/workflows/deploy-master.yml`.
- Deploy actual: push a `master` → build GHCR → SSH → `docker compose pull && docker compose up -d --remove-orphans`.

## URLs

- Frontend/app: `https://ocr.moti.cl`, `https://ocr-app.moti.cl`.
- API health: `https://ocr.moti.cl/api/auth/health`.
- MC2: `https://mc2.moti.cl`.

## Datos productivos observados

- `users`: 10
- `documents`: 64
- `document_types`: 13

## Nota de seguridad

No documentar secretos en el repo. Variables sensibles viven en `.env`, GitHub Secrets o `/root/.openclaw/credentials/secrets.json` según corresponda.
