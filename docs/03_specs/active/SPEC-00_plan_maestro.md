# SPEC-00 — Plan maestro y sincronización MC2

## Objetivo

Mantener `docs/PLAN_MAESTRO.md` como fuente canónica del proyecto y sincronizarlo con MC2 cuando se creen, cierren o cambien tareas.

## Alcance

Incluye:

- actualización de prioridades, estados, bloqueos y entregables;
- registro de nuevas tareas `TXX`;
- creación de spec si la tarea requiere desarrollo/análisis;
- actualización de contexto estable en `docs/02_contexto/`.

Excluye:

- desarrollo de features específicas, salvo edición documental.

## Archivos relevantes

- `docs/PLAN_MAESTRO.md`
- `AGENTS.md`
- `docs/02_contexto/mc2_estado.md`
- `docs/03_specs/`

## Criterios de aceptación

- Toda tarea activa tiene ID único.
- Toda tarea activa tiene spec o justificación si es trivial.
- Estados no son ambiguos.
- Bloqueos y dependencias están claros.
- MC2 y plan maestro no contradicen lo esencial.

## Verificación mínima

- Inspección directa de `docs/PLAN_MAESTRO.md`.
- Si aplica, consulta MC2 board OCR AI.

## Reporte esperado

- Qué cambió.
- Por qué cambió.
- Tareas nuevas/cerradas.
- Dudas o riesgos.
