# SPEC-02 — Batch inbox y upload background

## Tarea relacionada

- `T01` Frontend modo inbox/background upload.

## Objetivo

Cerrar el flujo UX para subir documentos en segundo plano, monitorear progreso y resolver documentos pendientes sin bloquear al usuario.

## Estado conocido

Backend ya expone endpoints relacionados:

- `POST /api/documents/upload-to-inbox`
- `POST /api/documents/batch-status`
- `POST /api/documents/resolve-pending-batch`

MC2 registra que backend Fase 3 fue completado y que queda pendiente frontend modo inbox.

## Alcance

Incluye:

- checkbox o acción clara “Procesar en segundo plano”;
- panel/lista de docs `queued/processing/pending_confirmation/completed/error`;
- polling razonable;
- resolver pendientes batch si corresponde;
- mensajes claros de éxito/error;
- responsive básico.

Excluye:

- reescribir completo el pipeline OCR;
- cambios destructivos de storage.

## Archivos/módulos probables

- `frontend/app/**`
- `frontend/components/**upload**`
- `frontend/lib/**api**`
- `backend/src/**documents**` solo si aparece bug de contrato.

## Criterios de aceptación

- Usuario puede subir N docs al inbox/background.
- UI muestra progreso/estado sin reload manual.
- Documentos pendientes tienen acción clara de resolución.
- Errores backend se muestran y no quedan toasts falsos.
- No rompe upload normal existente.

## Verificación mínima

- `cd frontend && pnpm run build`.
- Si toca backend: `cd backend && pnpm run build`.
- Prueba manual o screenshot del flujo.

## Riesgos

- Polling demasiado agresivo.
- Estado visual inconsistente con DB.
- Duplicar lógica entre modals existentes.
