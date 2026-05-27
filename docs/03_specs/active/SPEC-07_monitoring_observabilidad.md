# SPEC-07 — Monitoring, health checks y alertas

## Tarea relacionada

- `T03` Monitoring, health checks y alertas.

## Objetivo

Detectar rápido caídas o degradación de ONAI OCR y dejar un runbook mínimo de operación.

## Alcance inicial

Incluye:

- health checks para frontend, backend, processor y DB;
- verificación HTTP externa de `ocr.moti.cl`;
- chequeo Docker health;
- alerta por Telegram/OpenClaw/cron si falla;
- reporte/log local;
- runbook básico.

Excluye:

- observabilidad enterprise completa con Prometheus/Grafana, salvo decisión posterior.

## Criterios de aceptación

- Existe comando/script reproducible de health.
- Falla si backend health no responde ok.
- Falla si container crítico no está running/healthy.
- Deja log con timestamp.
- Tiene instrucción clara de recuperación inicial.

## Verificación mínima

- Ejecutar script de health.
- Simular o revisar path de error sin tumbar producción.
- Documentar resultado en `05_entregables/qa_reports/` o `deploy_notes/`.

## Riesgos

- Alertas ruidosas.
- Falsos positivos por timeouts momentáneos.
- No monitorear costos/uso IA.
