# T13 — Línea base de seguridad y migración a pnpm

Fecha: 2026-05-27  
Branch de trabajo: `codex/spec-13-migracion-pnpm`  
Base commit analizada: `9f3f04d`

## Objetivo del paso 1

Levantar inventario actual antes de ejecutar cambios de migración:

- estado de uso de gestores de paquetes;
- lockfiles activos;
- vulnerabilidades actuales;
- criterio de éxito para validar mejora.

## Hallazgos

### 1) Estado de gestores y lockfiles

- Backend: existe `pnpm-lock.yaml`.
- Frontend: existe `pnpm-lock.yaml`.
- No se detectó `package-lock.json` en backend/frontend.

### 2) Uso de npm en CI/documentación crítica

Se detectó uso activo de `npm` en CI:

- `.github/workflows/ci.yml`
  - `npm ci`
  - `npm run lint`
  - `npm run build`

El resto de documentación principal ya usa mayormente `pnpm`.

### 3) Línea base de vulnerabilidades (producción)

Comandos ejecutados:

- `cd backend && pnpm audit --prod`
- `cd frontend && pnpm audit --prod`

Resultado backend:

- `58` vulnerabilidades
- severidad: `27 high`, `27 moderate`, `4 low`
- ejemplos relevantes:
  - `axios` (< `1.15.1`) reportado en advisory
  - `jws` transitivo vía auth/google libs
  - `glob`, `tar`, `qs` transitivos

Resultado frontend:

- `45` vulnerabilidades
- severidad: `1 critical`, `16 high`, `25 moderate`, `3 low`
- crítico principal:
  - `next@16.0.0` vulnerable; parche reportado en `>=16.0.7` y advisories posteriores sugieren `>=16.0.11` / `>=16.2.5` según vector.

## Criterio de éxito de la migración (definido para T13)

1. CI sin comandos `npm` (todo en `pnpm`).
2. Builds de backend/frontend exitosos con `pnpm` en entorno limpio.
3. Reducir vulnerabilidades críticas/altas respecto a esta línea base.
4. Mantener funcionalidad sin regresión en smoke básico.

## Riesgos detectados en la línea base

- Mover solo a `pnpm` no elimina vulnerabilidades por sí solo.
- Dependencias transitivas vulnerables pueden requerir `overrides` o upgrade indirecto.
- Cambios de versión de `next` pueden requerir ajustes de compatibilidad.

## Paso 2 ejecutado — migración técnica controlada

Cambios aplicados:

- workflow `CI - Lint & Build Check` migrado de `npm` a `pnpm`:
  - cache `pnpm`;
  - lockfile path `backend/pnpm-lock.yaml` y `frontend/pnpm-lock.yaml`;
  - setup `pnpm/action-setup@v4`;
  - instalación reproducible con `pnpm install --frozen-lockfile`;
  - comandos `pnpm run lint` y `pnpm run build`.

Validación ejecutada:

- `cd backend && pnpm install --frozen-lockfile`
- `cd frontend && pnpm install --frozen-lockfile`
- `cd backend && pnpm run build` (OK)
- `cd frontend && pnpm run build` (OK)

Notas:

- `pnpm` reportó advertencias de `approve-builds` para scripts de dependencias (`sharp`, `bcrypt`, `@nestjs/core`) en entorno local; no bloqueó instalación/build.

## Siguiente paso propuesto (Paso 3)

Hardening de supply chain y remediación:

- añadir política de seguridad de dependencias en CI (audit/checks por severidad);
- priorizar remediación de vulnerabilidades críticas/altas comenzando por `next` en frontend;
- definir y documentar excepciones temporales justificadas si aplica.

## Paso 3 ejecutado (parcial) — remediación inicial frontend

Acciones aplicadas en frontend:

- `next`: `16.0.0` -> `16.2.6`
- `axios`: `^1.13.1` (lock efectivo previo) -> `^1.15.2`

Comandos de validación:

- `cd frontend && pnpm run build` (OK, repetido tras upgrades)
- `cd frontend && pnpm audit --prod`

Resultado de auditoría frontend:

- antes de remediación: `45` vulnerabilidades (`1 critical`, `16 high`, `25 moderate`, `3 low`)
- después de remediación inicial: `5` vulnerabilidades (`1 high`, `4 moderate`)

Riesgo residual frontend:

- `lodash` transitivo vía `recharts` (high + moderate)
- `postcss` transitivo (moderate)

Estado backend (sin remediación aún):

- `58` vulnerabilidades (`27 high`, `27 moderate`, `4 low`)

Próximo foco recomendado:

1. remediación backend por lotes (priorizar `axios`, `qs`, `jws`, `glob/tar` transitorios);
2. evaluar `overrides` de `pnpm` donde no haya patch directo de dependencia raíz;
3. agregar gate de seguridad en CI en modo progresivo (sin bloquear inicialmente, luego endurecer).

## Paso 3 ejecutado (backend) — remediación por lotes

Cambios aplicados en backend:

- actualización de dependencias directas:
  - `axios` -> `1.16.1`
  - `googleapis` -> `172.0.0`
  - `multer` -> `2.1.1`
- endurecimiento con `pnpm.overrides` para transitorios vulnerables:
  - `qs`, `jws`, `glob`, `tar`, `validator`, `minimatch`, `uuid`, `fast-xml-parser`, `multer`

Validación ejecutada:

- `cd backend && pnpm install` (OK)
- `cd backend && pnpm run build` (OK)
- `cd backend && pnpm audit --prod`

Resultado backend:

- baseline inicial: `58` (`27 high`, `27 moderate`, `4 low`)
- estado actual: `8` (`2 high`, `5 moderate`, `1 low`)

Hallazgos residuales principales (requieren cambios más estructurales):

- `path-to-regexp` vía `@nestjs/platform-express>express` (high)
- `lodash` vía `@nestjs/config` (high/moderate; advisory pide versión no disponible en línea actual)
- `file-type` vía `@nestjs/common` (moderate)
- `@nestjs/core` advisory moderado en rama Nest actual
- `diff` vía `typeorm>ts-node` (low)

Conclusión operativa:

- la migración a `pnpm` quedó efectiva en CI y entorno local;
- la remediación redujo fuerte la superficie crítica;
- para bajar el riesgo residual se recomienda planificar upgrade coordinado de stack NestJS/Express/TypeORM.
