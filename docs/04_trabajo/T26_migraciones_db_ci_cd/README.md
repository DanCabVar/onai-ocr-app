# T26 — Migraciones DB seguras en CI/CD

## Estado de esta iteración

- Spec: `docs/03_specs/active/SPEC-26_db_migrations_ci_cd.md`
- Estado sugerido: `En revisión`

## Hallazgos base

1. El backend seguía con `synchronize: true` en `backend/src/app.module.ts`.
2. No existían scripts formales `db:migrate`, `db:revert`, `db:show`.
3. El deploy QA ejecutaba solo `docker compose pull/up`, sin paso explícito de migración.
4. El deploy producción ejecutaba solo `docker compose pull/up`, sin backup DB previo ni migraciones explícitas.

## Cambios aplicados

1. Se centraliza la configuración TypeORM:
   - `backend/src/database/typeorm.config.ts`
   - `backend/src/database/data-source.ts`
2. `synchronize` queda controlado por ambiente:
   - por defecto `false` cuando `NODE_ENV=production`;
   - override explícito posible vía `TYPEORM_SYNCHRONIZE=true|false`.
3. Se agregan scripts operativos:
   - `pnpm db:migrate`
   - `pnpm db:revert`
   - `pnpm db:show`
4. Se agrega `deploy-qa.yml` al branch de trabajo con paso:
   - `docker compose up -d postgres`
   - `docker compose run --rm backend pnpm db:migrate`
5. Se actualiza `deploy-master.yml` con:
   - backup previo vía `pg_dump`;
   - ejecución explícita de `pnpm db:migrate`;
   - health check posterior.
6. Se actualizan runbooks:
   - `docs/07_runbooks/deploy.md`
   - `docs/07_runbooks/branch-flow.md`

## Verificación local ejecutada

- `cd backend && pnpm run build`
- verificación de `dist/database/data-source.js` compilado y opciones TypeORM resueltas

## Pendientes para cierre

1. Validar workflow QA real con secrets/infra.
2. Ejecutar `db:show` o `db:migrate` en ambiente QA real y guardar evidencia.
3. Confirmar que producción usa el workflow `deploy-master.yml` canónico y no uno legacy alternativo.
4. Dejar nota final en `PLAN_MAESTRO.md` / `SPEC_HISTORY.md` tras validación de ambiente.
