# T22 — Remediación de vulnerabilidades residuales post SPEC-13

Fecha: 2026-05-27
Branch de trabajo: `codex/spec-22-remediacion-vulnerabilidades-residuales`

## Alcance ejecutado

- Remediación directa de hallazgos `high` con parche disponible.
- Reducción de superficie `moderate` cuando existía parche compatible.
- Política de auditoría CI explicitada (modo bloqueante/no bloqueante por severidad).
- Mitigación temporal documentada para hallazgos `high` sin parche publicable en npm.

## Cambios aplicados

### Backend

- `backend/package.json`
  - `pnpm.overrides.path-to-regexp = 0.1.13` (mitiga CVE-2026-4867 / GHSA-37ch-88jc-xwx2)
  - `pnpm.overrides.lodash = 4.17.23` (reduce advisories previos de lodash con parche <=4.17.x)

### Frontend

- `frontend/package.json`
  - `pnpm.overrides.lodash = 4.17.23` (reduce advisories previos de lodash con parche <=4.17.x)

### CI

- `.github/workflows/ci.yml`
  - `pnpm audit --prod --audit-level=critical` en modo bloqueante.
  - `pnpm audit --prod --audit-level=high` en modo no bloqueante (visibilidad obligatoria).

## Evidencia antes/después (audit --prod)

### Backend

- Antes (baseline T22): `8` vulnerabilidades (`2 high`, `5 moderate`, `1 low`)
- Después: `6` vulnerabilidades (`1 high`, `4 moderate`, `1 low`)

Residual `high`:

- `lodash` vía `@nestjs/config>lodash` (GHSA-r5fr-rjxr-66jc)
  - advisory exige `lodash >=4.18.0`
  - a fecha 2026-05-27 no existe release estable 4.18.x en npm

### Frontend

- Antes (baseline T22): `5` vulnerabilidades (`1 high`, `4 moderate`)
- Después: `4` vulnerabilidades (`1 high`, `3 moderate`)

Residual `high`:

- `lodash` vía `recharts>lodash` (GHSA-r5fr-rjxr-66jc)
  - advisory exige `lodash >=4.18.0`
  - a fecha 2026-05-27 no existe release estable 4.18.x en npm

## Mitigación temporal de residuales high (sin parche npm disponible)

1. Mantener `lodash` fijado en `4.17.23` para cubrir CVEs anteriores ya parchadas en esa línea.
2. Prohibir en código propio el uso de `_.template` con `imports` dinámicos o controlados por usuario.
3. Mantener auditoría de `high` visible en CI en cada PR/push.
4. Revisar semanalmente disponibilidad real de `lodash >=4.18.0` o actualización de `@nestjs/config`/`recharts` que elimine dependencia vulnerable.

Mitigaciones complementarias de severidad `moderate` residual:

- Backend (`@nestjs/common>file-type` y `@nestjs/core`): mantener límites de tamaño de archivos de entrada, validación MIME/formatos y no exponer SSE con `event/id` derivados de input no confiable.
- Frontend (`postcss` transitivo): no interpolar CSS de usuario no confiable dentro de etiquetas `<style>` renderizadas en servidor.

## Fecha objetivo de resolución

- Revisión de estado: 2026-06-03
- Acción esperada: actualizar a versión parcheada real (cuando exista en npm) o reemplazar dependencia raíz afectada.

## Comandos ejecutados

- `cd backend && pnpm install --frozen-lockfile && pnpm audit --prod --audit-level=high`
- `cd frontend && pnpm install --frozen-lockfile && pnpm audit --prod --audit-level=high`
- `cd backend && pnpm audit --prod --json`
- `cd frontend && pnpm audit --prod --json`
- `cd backend && pnpm install && pnpm run build && pnpm audit --prod --audit-level=high`
- `cd frontend && pnpm install && pnpm run build && pnpm audit --prod --audit-level=high`

## Estado sugerido para PLAN_MAESTRO.md

- `T22`: pasar de `Disponible para agente` a `En revisión` con nota:
  - `high` reducidas, residuales `lodash` sin parche npm disponible documentadas con mitigación temporal y fecha objetivo.
