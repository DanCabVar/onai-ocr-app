# Decisiones — ONAI OCR

## 2026-05-18 — Harness + SDD

Se adopta estructura de ingeniería de harnesses y spec-driven development para ONAI OCR.

Decisión:

- `PLAN_MAESTRO.md` será la fuente canónica.
- MC2 seguirá como herramienta de orquestación de subagentes, no como única fuente de verdad.
- Features/tareas relevantes tendrán spec en `03_specs/`.
- Trabajo intermedio irá en `04_trabajo/TXX_*`.
- Releases, QA y deploy notes irán en `05_entregables/`.

## 2026-05-18 — CI/CD real

Se detecta que el workflow `deploy-master.yml` ya ejecutó deploy exitoso a producción vía GHCR + SSH el 2026-04-02.

Esto corrige memoria/documentación anterior que indicaba deploy 100% manual.
