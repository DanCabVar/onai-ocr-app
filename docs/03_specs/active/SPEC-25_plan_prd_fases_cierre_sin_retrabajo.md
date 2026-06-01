# SPEC-25 — Plan PRD por fases para cierre de specs sin retrabajo

## Tarea relacionada

- `T25` Orquestar cierre de specs 13-24 (excepto 18 en backlog) con plan PRD por fases y plantilla estándar.

## Objetivo

Definir un marco único de ejecución para implementar/cerrar los specs trabajados, reduciendo retrabajo, asegurando dependencias y dejando evidencia homogénea de validación y cierre documental.

## Alcance

Incluye:

- plan por fases con orden canónico de ejecución;
- criterio de entrada/salida por fase;
- plantilla PRD mínima obligatoria por spec;
- mapeo de dependencias entre specs.

Excluye:

- reemplazar los specs activos existentes;
- ejecutar cambios funcionales de producto en este spec;
- redefinir estados históricos fuera de evidencia canónica.

## Plan PRD por fases (canónico)

1. Fase Fundacional (calidad y seguridad): `13, 22, 23, 16, 15`.
2. Fase Core producto-docs: `14, 21`.
3. Fase Seguridad de datos: `19` (en paralelo controlado con fase 2).
4. Fase Monetización: `17`.
5. Fase IA avanzada: `20, 24` (24 después de validación sólida de 21).

## Dependencias clave

- `SPEC-22` depende de baseline consolidado en `SPEC-13`.
- `SPEC-15` requiere secretos E2E para cierre (`E2E_BASE_URL`, `E2E_USER_EMAIL`, `E2E_USER_PASSWORD`).
- `SPEC-19` debe cerrar antes de dar por cerrados cambios sensibles de retrieval multi-tenant.
- `SPEC-24` depende de outputs validados de `SPEC-21`.
- `SPEC-17` requiere sandbox y webhooks estables antes de merge/deploy.

## Plantilla PRD mínima por spec (obligatoria)

Cada spec activo de estas fases debe completar, como mínimo:

1. Problema y objetivo medible.
2. Alcance / fuera de alcance.
3. Dependencias (specs previos y secretos/infra).
4. Diseño técnico y archivos a tocar.
5. Plan de pruebas (casos positivos, negativos y borde).
6. Riesgos + rollback.
7. Criterio de cierre (evidencia requerida en docs).

## Criterios de aceptación

- Existe orden de ejecución por fases y dependencias explícitas.
- Cada spec en fase activa tiene checklist PRD mínima completa.
- El estado de cada spec se actualiza en `PLAN_MAESTRO.md` y `SPEC_HISTORY.md` con evidencia.
- No se cierra ningún spec sin pruebas mínimas y entregable documental.

## Verificación mínima

- Validar consistencia entre:
  - `docs/PLAN_MAESTRO.md`;
  - `docs/06_history/SPEC_HISTORY.md`;
  - specs activos de `docs/03_specs/active/`.
- Ejecutar: `python3 docs/scripts/validate-harness.py`.

## Entregables esperados

- `SPEC-25` versionado en `docs/03_specs/active/`.
- estado `T25` incorporado en `PLAN_MAESTRO.md`.
- entrada `T25 / SPEC-25` en `SPEC_HISTORY.md`.

## Riesgos

- mover estados a revisión sin evidencia mínima puede generar falsos cierres;
- dependencia cruzada 21 -> 24 puede retrasar la fase IA avanzada;
- cerrar 15 sin secretos E2E introduce deuda de calidad en release.
