# DECISIONS — ONAI OCR

Índice de decisiones arquitectónicas/operativas. Las decisiones nuevas deben registrarse como ADR en `06_history/decisions/` usando `templates/DECISION.template.md`.

| ADR | Fecha | Estado | Decisión | Spec/contexto |
|---|---|---|---|---|
| `decisions/ADR-20260518-harness-sdd.md` | 2026-05-18 | Accepted | Adoptar harness + spec-driven development. | `AGENTS.md`, `PLAN_MAESTRO.md` |
| `decisions/ADR-20260518-ci-cd-real.md` | 2026-05-18 | Accepted | Reconocer `deploy-master.yml` como CI/CD real de producción vía GHCR + SSH. | `03_specs/active/SPEC-06_ci_cd_deploy.md` |
| `decisions/ADR-20260525-harness-hibrido.md` | 2026-05-25 | Accepted | Evolucionar ONAI OCR a harness híbrido: specs active/done + history + runbooks + templates + validador. | `SPEC-00`, comparación con ColectyRed Docs |
