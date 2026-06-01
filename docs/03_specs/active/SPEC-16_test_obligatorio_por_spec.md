# SPEC-16 — Test obligatorio por cada nuevo spec

## Tarea relacionada

- `T16` Definir política y automatización de pruebas por spec.

## Objetivo

Asegurar que cada spec nuevo tenga pruebas asociadas desde su ejecución, evitando cambios sin validación y reduciendo regresiones.

## Definición operativa (obligatoria)

Para considerar un spec “en revisión” o “cerrado”, debe incluir:

1. `Test Plan` en el spec (casos positivos, negativos y borde).
2. Implementación de al menos 1 prueba automatizada nueva o actualización de prueba existente.
3. Evidencia de ejecución (`build/test` y resultado).
4. Registro en `docs/05_entregables/qa_reports/` cuando aplique.

## Alcance

Incluye:

- plantilla mínima de sección `Plan de prueba` para specs activos;
- checklist de PR: “este spec agrega/actualiza tests”;
- validación en CI que falle si no hay evidencia mínima para specs ejecutados.

Excluye:

- exigir cobertura 100%;
- reescribir todo el histórico de specs cerrados.

## Archivos/módulos probables

- `docs/templates/SPEC.template.md`
- `.github/workflows/*`
- `docs/PLAN_MAESTRO.md`
- `docs/07_runbooks/local-dev.md`

## Criterios de aceptación

- Queda explícito qué test mínimo se exige por spec.
- La plantilla de spec ya pide plan de pruebas concreto.
- CI/checklist bloquea cierre de trabajo sin evidencia mínima.
- Agentes reportan pruebas en formato estándar.

## Verificación mínima

- crear un spec piloto y validar que obliga plan de pruebas;
- PR de ejemplo con test nuevo y evidencia;
- ejecución CI con validación activa.

## Riesgos

- sobrecarga burocrática si la regla no es proporcional al cambio.
- falsos cumplimientos con pruebas triviales sin valor.
- fricción inicial para tareas de documentación pura (definir excepción controlada).

