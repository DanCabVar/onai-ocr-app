# SPEC-13 — Migración a pnpm en todo el monorepo

## Tarea relacionada

- `T13` Estandarizar gestor de paquetes en `pnpm`.

## Objetivo

Eliminar inconsistencias entre gestores (`npm`, `yarn`, `pnpm`) y dejar el repo completo operando con `pnpm` de forma reproducible en local, CI y producción.

## Alcance

Incluye:

- auditar uso actual de gestores en `frontend/`, `backend/`, scripts y docs;
- unificar comandos de instalación/build/test/lint en `pnpm`;
- validar lockfiles y política de un solo lockfile por proyecto;
- actualizar workflows CI/CD y documentación operativa.

Excluye:

- cambios funcionales de producto;
- upgrades mayores de framework no necesarios para la migración.

## Archivos/módulos probables

- `frontend/package.json`, `backend/package.json`
- `frontend/pnpm-lock.yaml`, `backend/pnpm-lock.yaml`
- `.github/workflows/*`
- `README.md`, `docs/07_runbooks/local-dev.md`, `docs/07_runbooks/deploy.md`

## Criterios de aceptación

- Comandos oficiales de desarrollo usan `pnpm`.
- CI ejecuta instalación y build con `pnpm` sin fallback a `npm`.
- No quedan referencias activas a `npm install` o `yarn install` en docs críticas.
- Build de frontend y backend exitosa en entorno limpio.

## Verificación mínima

- `cd backend && pnpm install && pnpm run build`
- `cd frontend && pnpm install && pnpm run build`
- ejecución de pipeline CI en rama con resultado verde.

## Riesgos

- lockfile drift entre entornos.
- scripts heredados que asumen `npm`.
- incompatibilidades de caché en CI.

