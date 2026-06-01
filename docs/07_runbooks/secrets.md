# Runbook — Secretos ONAI OCR

## Reglas

- No commitear secretos, tokens, `.env` reales ni dumps sensibles.
- No documentar valores secretos en specs, history ni entregables.
- Si una tarea requiere rotar o inspeccionar secretos, pedir confirmación antes de acciones destructivas o externas.
- Preferir referencias a ubicación/variable, no valores.

## Evidencia aceptable

- Nombre de variable presente/ausente.
- Hash parcial o últimos 4 caracteres solo si es necesario y seguro.
- Captura/log sanitizado.
