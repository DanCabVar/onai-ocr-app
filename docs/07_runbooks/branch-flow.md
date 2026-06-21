# Runbook — Flujo de ramas y despliegues ONAI OCR

## Flujo canónico

```txt
codex/spec-XX-*  →  dev  →  qa  →  master
feature/spec     integración  QA     producción
```

## Reglas obligatorias

1. Toda feature o spec se trabaja en una rama propia, normalmente `codex/spec-XX-nombre`.
2. No fusionar ramas de feature/spec directo a `qa` ni a `master`.
3. La rama `dev` es la rama de integración. Recibe merges de specs cuando estén revisados.
4. La rama `qa` solo recibe promociones desde `dev`.
5. La rama `master` solo recibe promociones desde `qa` después de validar QA.
6. `deploy/all-features` queda como rama legacy temporal. No crear trabajo nuevo sobre ella. Más adelante se eliminará cuando Danilo lo confirme.
7. No usar `/root/projects/onai-ocr-app` para deploy ni validaciones. El workspace válido es `/root/.openclaw/workspace/onai-ocr-app`.

## Qué despliega cada rama

| Rama | Rol | Deploy esperado |
|---|---|---|
| `dev` | Integración de specs/features | Ambiente dev cuando esté configurado. Si faltan secrets `DEV_*`, no confiar en ese workflow. |
| `qa` | Validación preproducción | GitHub Actions `Deploy to QA Server`, stack `/docker/onai-ocr-qa`, imágenes GHCR tag `:qa`. |
| `master` | Producción | GitHub Actions `Deploy to Production (master)`, stack `/docker/onai-ocr`, imágenes GHCR tag `:latest`. |
| `deploy/all-features` | Legacy temporal | No usar para nuevas promociones. Pendiente de eliminación futura. |

## Procedimiento de promoción

### 1. Feature/spec → dev

Antes de mergear una spec a `dev`:

- Revisar el spec y evidencia en `docs/04_trabajo/TXX_*`.
- Ejecutar verificación mínima aplicable: build, lint, test, curl, logs o inspección directa.
- Actualizar `docs/PLAN_MAESTRO.md`, historial/spec si corresponde.
- Mergear a `dev` con mensaje trazable, por ejemplo: `merge: spec-XX to dev`.

### 2. dev → qa

```bash
git checkout qa
git pull --ff-only origin qa
git merge --no-ff origin/dev -m "merge: promote dev to qa"
git push origin qa
```

Luego verificar GitHub Actions:

```bash
gh run list --repo DanCabVar/onai-ocr-app --branch qa --limit 3
gh run watch <run_id> --repo DanCabVar/onai-ocr-app
```

Validación mínima QA:

```bash
curl -fsS https://qa-ocr.moti.cl/api/auth/health
cd /docker/onai-ocr-qa && docker compose ps
```

Si QA falla, no promover a `master`; corregir en rama de spec o `dev` según corresponda y repetir.

### 3. qa → master

Solo después de QA OK:

```bash
git checkout master
git pull --ff-only origin master
git merge --no-ff origin/qa -m "merge: promote qa to production"
git push origin master
```

Luego verificar GitHub Actions:

```bash
gh run list --repo DanCabVar/onai-ocr-app --branch master --limit 3
gh run watch <run_id> --repo DanCabVar/onai-ocr-app
```

Validación mínima producción:

```bash
curl -fsS https://ocr.moti.cl/api/auth/health
cd /docker/onai-ocr && docker compose ps
```

## Notas de seguridad operacional

- No hacer cherry-picks directos a producción salvo hotfix explícito y documentado.
- Si una rama dispara deploy, esperar resultado antes de la siguiente promoción.
- Si un workflow queda `completed/failure`, revisar logs con `gh run view <run_id> --log-failed` antes de continuar.
- Si el cambio toca DB/migraciones, revisar backup/rollback antes de promover a `master`.
- No exponer secrets en documentación ni logs.

## Estado inicial de esta regla

El 2026-06-01 se creó `dev` como clon de `deploy/all-features`, se promovió `dev → qa` y luego `qa → master`. Desde este punto, el flujo esperado es trabajar specs en ramas separadas y promover exclusivamente por `dev → qa → master`.
