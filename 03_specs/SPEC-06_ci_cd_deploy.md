# SPEC-06 — CI/CD, deploy y documentación de infraestructura

## Tarea relacionada

- `T04` Actualizar documentación CI/CD e infraestructura.

## Objetivo

Alinear documentación y workflows con el estado real de producción.

## Estado conocido

- `deploy-master.yml` deployó exitosamente a producción el `2026-04-02`.
- Deploy actual usa GHCR + SSH:
  - build imágenes;
  - push a GHCR;
  - SSH al VPS;
  - `cd /docker/onai-ocr`;
  - `docker compose pull`;
  - `docker compose up -d --remove-orphans`.

## Alcance

Incluye:

- actualizar docs que digan que CI/CD no está activo;
- documentar ramas reales (`master`, `main`, `dev`) y estado recomendado;
- documentar deploy manual y automático;
- documentar verificación post-deploy;
- registrar rollback básico.

Excluye:

- cambiar workflows sin decisión explícita.

## Archivos relevantes

- `/root/.openclaw/workspace/INFRA.md`
- `.github/workflows/*.yml`
- `02_contexto/arquitectura_actual.md`
- `05_entregables/deploy_notes/`

## Criterios de aceptación

- No queda contradicción entre docs principales.
- Se distingue deploy manual vs automático.
- Se documenta healthcheck post-deploy.
- Se documenta path correcto `/docker/onai-ocr`.

## Verificación mínima

- Leer docs actualizados.
- `gh run list` o evidencia histórica del workflow.
- `curl https://ocr.moti.cl/api/auth/health`.
