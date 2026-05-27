# ADR-20260518 — Harness + SDD

- Status: Accepted
- Date: 2026-05-18
- Spec/contexto: `AGENTS.md`, `PLAN_MAESTRO.md`

## Context

ONAI OCR necesita continuidad entre Smith, MC2 y subagentes sin perder contexto operativo ni duplicar trabajo.

## Options evaluated

1. Mantener solo código + memoria conversacional.
2. Usar MC2 como única fuente de verdad.
3. Usar harness en repo con plan, contexto, specs, trabajo y entregables.

## Decision

Adoptar estructura de ingeniería de harnesses y spec-driven development. `PLAN_MAESTRO.md` es la fuente canónica; MC2 orquesta, pero no reemplaza el plan en repo.

## Consequences

- Las tareas relevantes deben tener spec.
- El trabajo intermedio vive en `04_trabajo/TXX_*`.
- Releases, QA y deploy notes viven en `05_entregables/`.

## Reversibility

Reversible si el proyecto migra a otro gestor canónico, pero requiere migrar historial/specs.
