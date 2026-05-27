# AGENTS.md — Harness ONAI OCR

## Propósito del harness

Este repo contiene el sistema ONAI OCR: aplicación full-stack para procesamiento inteligente de documentos con OCR, clasificación IA, extracción estructurada, storage R2, multi-tenant, billing y operación en VPS.

El objetivo del harness es que Smith, MC2 y subagentes puedan trabajar el proyecto sin perder contexto: entender estado actual, elegir tareas, seguir specs, probar cambios y dejar evidencia trazable.

## Regla principal

Antes de trabajar cualquier tarea, leer en este orden:

1. `docs/AGENTS.md`
2. `docs/PLAN_MAESTRO.md`
3. `docs/06_history/SPEC_HISTORY.md` para evitar retrabajo
4. `docs/02_contexto/resumen_ejecutivo.md`
5. `docs/02_contexto/arquitectura_actual.md`
6. El spec correspondiente en `docs/03_specs/active/`
7. Los runbooks de `docs/07_runbooks/` citados por el spec o por el tipo de cambio
8. La carpeta de trabajo `docs/04_trabajo/TXX_*` si existe
9. Código fuente afectado

## Autoridad documental

- `docs/PLAN_MAESTRO.md`: tablero canónico de estado, prioridad, bloqueo y próxima acción.
- `docs/03_specs/active/`: contratos canónicos de trabajo pendiente/en curso.
- `docs/03_specs/done/`: specs cerrados, archivados o reemplazados.
- `docs/06_history/SPEC_HISTORY.md`: índice histórico para evitar retrabajo.
- `docs/06_history/DECISIONS.md` y `06_history/decisions/`: decisiones tipo ADR.
- `docs/06_history/INCIDENTS.md`: incidentes relevantes.
- `docs/07_runbooks/`: procedimientos repetibles.
- `docs/05_entregables/`: evidencia final: releases, QA reports, deploy notes y docs cliente.

Si hay conflicto entre MC2 y este repo, prevalece `PLAN_MAESTRO.md` hasta que se actualice explícitamente.

## Estructura

```txt
01_fuentes/       Fuentes, referencias y documentos externos/internos base
02_contexto/      Memoria estable del proyecto, sin reemplazar el plan
03_specs/active/  Specs pendientes/en curso
03_specs/done/    Specs cerrados/archivados
04_trabajo/       Workbench por tarea TXX
05_entregables/   Releases, QA reports, deploy notes y docs cliente
06_history/       Historial, ADRs, incidentes y log de implementación
07_runbooks/      Procedimientos repetibles
```

## Regla anti-retrabajo

Antes de implementar, buscar el ID de tarea/spec en:

1. `docs/PLAN_MAESTRO.md`
2. `docs/06_history/SPEC_HISTORY.md`
3. `docs/03_specs/done/`
4. `docs/03_specs/active/`
5. `docs/06_history/IMPLEMENTATION_LOG.md` si la tarea parece histórica

Si algo ya fue implementado, no reimplementarlo. Si el spec activo contradice el historial, detenerse y reportar la contradicción.

## Convenciones de tareas

Cada tarea relevante debe tener:

- ID `TXX`
- prioridad
- estado
- bloqueo/dependencia si aplica
- spec asociado en `03_specs/active/` o `03_specs/done/`
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

## Transiciones de estado

| De | A | Evidencia requerida | Quién marca |
|---|---|---|---|
| `Backlog` / `No iniciada` | `Disponible para agente` | Spec existe, alcance claro, sin bloqueo inmediato | Smith / Danilo |
| `Disponible para agente` | `En trabajo por agente` | Agente asignado, zona de archivos definida | Smith / MC2 |
| `En trabajo por agente` | `En revisión` | Reporte del agente con archivos, comandos y evidencia | Agente / Smith |
| `En revisión` | `Lista para deploy` | Build/test/lint o verificación mínima OK, riesgos aceptados | Smith |
| `Lista para deploy` | `Deployada` | Deploy ejecutado + health/logs/screenshot según aplique | Smith |
| `Deployada` | `Cerrada` | `PLAN_MAESTRO.md`, `SPEC_HISTORY.md` y entregables actualizados | Smith |
| Cualquiera | `Bloqueada por *` | Bloqueo concreto + quién/qué lo desbloquea | Smith / agente |
| Cualquiera | `Requiere decisión usuario` | Decisión no inferible sin Danilo | Smith |

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
- `06_history/SPEC_HISTORY.md` queda actualizado;
- si aplica, el spec se mueve/copia desde `03_specs/active/` a `03_specs/done/`;
- si aplica, se deja nota en `05_entregables/`.

## Cuándo dividir vs consolidar specs

Dividir specs cuando:

- hay entregables independientes;
- tocan capas distintas con riesgos distintos;
- pueden trabajar agentes distintos sin pisarse;
- tienen criterios de aceptación claramente separados.

Consolidar o evitar crear un spec nuevo cuando:

- el cambio cabe como checklist dentro de un spec existente;
- solo es una corrección menor del mismo flujo;
- generaría specs de una sesión sin valor histórico.

Threshold operativo: si `03_specs/active/` supera 20 specs, hacer triage antes de agregar más.

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
- Harness/docs: `python3 scripts/validate-harness.py`.
