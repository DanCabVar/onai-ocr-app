# Matriz de riesgos — ONAI OCR

| Riesgo | Severidad | Señal | Mitigación |
|---|---:|---|---|
| Filtración cross-tenant vía RAG/SQL | Alta | Query sin filtro usuario o acceso tabla directa | RLS, vistas `my_*`, tests de aislamiento |
| Drift entre MC2 y repo | Media-Alta | Tareas MC2 no reflejadas en plan | `PLAN_MAESTRO.md` canónico + sync periódico |
| Deploy rompe producción | Alta | Health falla tras workflow | Health checks, rollback a imagen anterior, deploy notes |
| Borrado accidental en R2 | Alta | Script delete sin dry-run | Dry-run obligatorio + confirmación explícita |
| Costos IA descontrolados | Media-Alta | Uso masivo OCR/extracción | límites por plan, rate limits, métricas admin |
| UX batch confusa | Media | Docs quedan pending sin guía clara | PendingBatchModal + polling claro |
| Secretos en repo/logs | Alta | `.env` o keys commiteadas | gitignore, revisión, rotación si ocurre |
| Falta de monitoring | Media-Alta | Caídas detectadas tarde | cron/alertas/health dashboard |
