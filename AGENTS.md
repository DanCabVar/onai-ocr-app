# AGENTS.md — Harness ONAI OCR

## Propósito del harness

Este repo contiene el sistema ONAI OCR: aplicación full-stack para procesamiento inteligente de documentos con OCR, clasificación IA, extracción estructurada, storage R2, multi-tenant, billing y operación en VPS.

El objetivo del harness es que Smith, MC2 y subagentes puedan trabajar el proyecto sin perder contexto: entender estado actual, elegir tareas, seguir specs, probar cambios y dejar evidencia trazable.

## Regla principal

Antes de trabajar cualquier tarea, leer en este orden:

1. `AGENTS.md`
2. `PLAN_MAESTRO.md`
3. `02_contexto/resumen_ejecutivo.md`
4. `02_contexto/arquitectura_actual.md`
5. El spec correspondiente en `03_specs/`
6. La carpeta de trabajo `04_trabajo/TXX_*` si existe
7. Código fuente afectado

## Estado operativo canónico

`PLAN_MAESTRO.md` es el tablero canónico del proyecto.

MC2 puede usarse para orquestar subagentes y registrar tareas, pero si hay conflicto entre MC2 y este repo, prevalece `PLAN_MAESTRO.md` hasta que se actualice explícitamente.

Todo cambio de estado, prioridad, bloqueo, alcance o entregable debe reflejarse en `PLAN_MAESTRO.md`.

## Estructura

```txt
01_fuentes/      Fuentes, referencias y documentos externos/internos base
02_contexto/     Memoria estable del proyecto
03_specs/        Contratos de trabajo por feature/tarea
04_trabajo/      Workbench por tarea TXX
05_entregables/  Releases, QA reports, deploy notes y docs cliente
```

## Convenciones de tareas

Cada tarea relevante debe tener:

- ID `TXX`
- prioridad
- estado
- bloqueo/dependencia si aplica
- spec asociado
- entregable esperado
- criterio de aceptación
- verificación mínima: test, build, lint, curl, logs, screenshot o inspección directa

## Estados permitidos

- `No iniciada`
- `Disponible para agente`
- `En trabajo por agente`
- `En revisión`
- `Requiere decisión usuario`
- `Bloqueada por insumo`
- `Bloqueada por dependencia`
- `Bloqueada por infraestructura`
- `Lista para deploy`
- `Deployada`
- `Cerrada`
- `Backlog`

No usar estados ambiguos como “ok”, “avanzado” o “listo?” sin evidencia.

## Reglas con MC2/subagentes

Cuando una tarea se delegue desde MC2:

1. El mensaje al agente debe incluir el spec exacto.
2. Debe indicar archivos permitidos o zona de trabajo.
3. Debe pedir reporte final con:
   - archivos consultados;
   - archivos modificados;
   - comandos ejecutados;
   - evidencia de prueba;
   - riesgos o dudas;
   - estado sugerido para `PLAN_MAESTRO.md`.
4. Evitar que dos agentes editen el mismo archivo a la vez.
5. Para features grandes, usar branches separadas o carpetas de trabajo aisladas.

## Criterio de cierre

Una tarea no se marca `Cerrada` hasta que:

- cumple el spec;
- tiene evidencia de verificación;
- no rompe build/lint/test relevante;
- deploy/rollback está claro si toca producción;
- `PLAN_MAESTRO.md` queda actualizado;
- si aplica, se deja nota en `05_entregables/`.

## Reglas técnicas del proyecto

- Repo real de trabajo: `/root/.openclaw/workspace/onai-ocr-app`.
- Producción real: `/docker/onai-ocr`.
- No usar `/root/projects/onai-ocr-app` para deploy.
- Infra actual: Docker Compose + Traefik + GHCR.
- Dominio app: `https://ocr.moti.cl` y `https://ocr-app.moti.cl`.
- Backend API: `/api`.
- Storage documental: Cloudflare R2.
- DB: PostgreSQL.
- No exponer secretos en commits ni docs.

## Verificación mínima sugerida

Según el cambio:

- Backend: `cd backend && pnpm run build` y tests relevantes.
- Frontend: `cd frontend && pnpm run build` o `pnpm lint`.
- Processor: tests Python/ruff si toca `processor/`.
- Infra: `docker compose config`, health endpoints, logs.
- UI: screenshot o navegador cuando aplique.
- Producción: `curl https://ocr.moti.cl/api/auth/health` + container health.
