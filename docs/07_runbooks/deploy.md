# Runbook â€” Deploy / rollback ONAI OCR

## Contexto

Leer tambiÃ©n `docs/07_runbooks/branch-flow.md` antes de promover ramas o disparar deploys.


- ProducciÃ³n Docker Compose: `/docker/onai-ocr`
- CÃ³digo fuente: `/root/.openclaw/workspace/onai-ocr-app`
- URLs: `https://ocr.moti.cl`, `https://ocr-app.moti.cl`
- Health API: `https://ocr.moti.cl/api/auth/health`
- CI/CD real: GitHub Actions `deploy-master.yml` vÃ­a GHCR + SSH.

## VerificaciÃ³n mÃ­nima antes/despuÃ©s

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

No usar `/root/projects/onai-ocr-app` para deploy. La ruta vÃ¡lida de trabajo es `/root/.openclaw/workspace/onai-ocr-app`.


## Flujo de ramas

El deploy normal no se hace desde branches sueltas. El flujo canÃ³nico es:

```txt
codex/spec-XX-* â†’ dev â†’ qa â†’ master
```

- `dev`: integraciÃ³n de specs/features.
- `qa`: despliegue preproducciÃ³n en `/docker/onai-ocr-qa`.
- `master`: despliegue producciÃ³n en `/docker/onai-ocr`.
- `deploy/all-features`: legacy temporal; no usar para trabajo nuevo ni promociones nuevas.

Promover a producciÃ³n solo despuÃ©s de que QA haya terminado OK y tenga health/container check correcto.

## Sección DB / migraciones

- QA y producción no deben depender de `synchronize: true`.
- El mecanismo canónico de schema es TypeORM con migraciones versionadas.
- Scripts backend esperados:
  - `pnpm db:show`
  - `pnpm db:migrate`
  - `pnpm db:revert`

### QA

Antes de levantar toda la app en `/docker/onai-ocr-qa`, el workflow debe:

```bash
docker compose pull
docker compose up -d postgres
docker compose run --rm backend pnpm db:migrate
docker compose up -d --remove-orphans
```

Validación mínima:

```bash
curl -fsS https://qa-ocr.moti.cl/api/auth/health
cd /docker/onai-ocr-qa && docker compose ps
```

### Producción

Antes de correr migraciones en `/docker/onai-ocr`, crear backup y luego aplicar:

```bash
mkdir -p ./backups
docker compose pull
docker compose up -d postgres
docker compose exec -T postgres sh -lc 'PGPASSWORD="$DB_PASSWORD" pg_dump -U "$DB_USER" "$DB_NAME"' > ./backups/pre-migration-YYYYMMDD-HHMMSS.sql
docker compose run --rm backend pnpm db:migrate
docker compose up -d --remove-orphans
```

Validación mínima:

```bash
curl -fsS https://ocr.moti.cl/api/auth/health
cd /docker/onai-ocr && docker compose ps
```

### Regla operacional

- No promover dumps de QA a producción.
- Promover exclusivamente migraciones versionadas.
- Usar `db:revert` solo si la migración tiene `down` seguro y probado.
