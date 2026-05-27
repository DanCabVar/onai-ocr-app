# ADR-20260518 — CI/CD real de producción

- Status: Accepted
- Date: 2026-05-18
- Spec/contexto: `03_specs/active/SPEC-06_ci_cd_deploy.md`

## Context

La documentación previa indicaba deploy manual, pero se detectó que `deploy-master.yml` ya ejecutó deploy exitoso a producción el 2026-04-02 vía GHCR + SSH.

## Options evaluated

1. Seguir documentando deploy manual.
2. Declarar GitHub Actions como CI/CD real y auditar ramas `dev/main` antes de usarlas.

## Decision

Reconocer `deploy-master.yml` como camino real de producción, manteniendo revisión pendiente de workflows `dev/main`.

## Consequences

- La documentación de infra debe mantenerse sincronizada con GitHub Actions.
- Cambios de deploy deben validar GHCR, SSH y `/docker/onai-ocr`.

## Reversibility

Reversible si se decide volver a deploy manual o migrar a otro pipeline.
