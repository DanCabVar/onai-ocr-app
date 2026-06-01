# ADR-20260525 — Harness híbrido ONAI OCR

- Status: Accepted
- Date: 2026-05-25
- Spec/contexto: `03_specs/active/SPEC-00_plan_maestro.md`

## Context

El harness inicial de ONAI OCR era limpio, pero le faltaban mecanismos operativos presentes en `colectyred-docs`: separación active/done, historial, runbooks, templates y validación.

## Options evaluated

1. Mantener harness inicial simple.
2. Copiar completo el modelo ColectyRed.
3. Adoptar modelo híbrido: conservar `01_fuentes`, `02_contexto`, `04_trabajo`, `05_entregables` y sumar `03_specs/active|done`, `06_history`, `07_runbooks`, `templates`, `scripts/validate-harness.py`.

## Decision

Adoptar el modelo híbrido.

## Consequences

- Mejor continuidad y menor retrabajo.
- Más archivos/documentación que mantener.
- El validador debe ejecutarse antes de cerrar cambios al harness.

## Reversibility

Reversible moviendo specs y consolidando historial, aunque no recomendado si empiezan a trabajar varios agentes.
