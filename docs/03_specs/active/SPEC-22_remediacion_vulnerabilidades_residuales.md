# SPEC-22 — Remediación de vulnerabilidades residuales post-migración pnpm

## Tarea relacionada

- `T22` Reducir vulnerabilidades residuales tras `SPEC-13`.

## Objetivo

Eliminar o mitigar las vulnerabilidades residuales que quedaron después de la migración a `pnpm` y de la remediación inicial de dependencias, con foco en hallazgos de severidad `high`.

## Contexto

Luego de `SPEC-13`, la superficie de riesgo bajó significativamente:

- Frontend: `45` -> `5` vulnerabilidades.
- Backend: `58` -> `8` vulnerabilidades.

Persisten hallazgos en dependencias base del stack (Nest/Express/TypeORM y transitivas) que requieren cambios más estructurales que simples updates puntuales.

## Alcance incluido

- inventario final de vulnerabilidades residuales (frontend/backend) con paths exactos;
- propuesta de remediación por bloques:
  - upgrades de stack NestJS/Express relacionados;
  - upgrades seguros en `@nestjs/config`, `@nestjs/common`, `@nestjs/platform-express`, `@nestjs/core` y transitivas;
  - ajustes de `pnpm.overrides` donde sea razonable;
- plan de mitigación temporal para hallazgos sin parche directo;
- recomendación opcional: evaluar pasar la auditoría de CI de modo no bloqueante a bloqueante por severidad.

## Fuera de alcance

- migración mayor de framework que implique rediseño funcional completo;
- hardening de infraestructura no relacionado a dependencias de Node;
- cambios de producto no vinculados a seguridad.

## Archivos/módulos relevantes

- `backend/package.json`
- `backend/pnpm-lock.yaml`
- `frontend/package.json`
- `frontend/pnpm-lock.yaml`
- `.github/workflows/ci.yml`
- `docs/04_trabajo/T13_migracion_pnpm/README.md`

## Criterios de aceptación

- vulnerabilidades `critical` y `high` residuales en frontend/backend reducidas a `0` o justificadas con mitigación documentada y fecha de resolución;
- pipeline CI con política explícita de auditoría (threshold y modo de bloqueo definidos);
- build de frontend/backend exitosa tras cambios;
- reporte de antes/después por severidad y por paquete.

## Plan de prueba / verificación mínima

- `cd backend && pnpm install && pnpm run build && pnpm audit --prod`
- `cd frontend && pnpm install && pnpm run build && pnpm audit --prod`
- evidencia de comparación baseline vs estado final.

## Riesgos y rollback

- upgrades de Nest/Express pueden introducir incompatibilidades.
- overrides excesivos pueden generar deriva funcional.
- rollback: revertir commit de remediación, restaurar lockfiles previos y mantener auditoría en modo no bloqueante temporalmente.

## Reporte esperado del agente

- Archivos consultados.
- Archivos modificados.
- Comandos ejecutados.
- Evidencia de prueba.
- Riesgos/dudas.
- Cambio sugerido en `PLAN_MAESTRO.md`.
