# SPEC-14 — Carga paralela de archivos

## Tarea relacionada

- `T14` Mejorar throughput de subida de múltiples archivos.

## Objetivo

Reducir tiempo total de carga y procesamiento inicial para lotes de documentos, manteniendo control de errores, límites por plan y estabilidad del backend.

## Alcance

Incluye:

- evaluar flujo actual `upload-batch`/`upload-to-inbox`;
- aumentar paralelismo controlado en subida y encolado;
- reportar progreso real por archivo (subido, en proceso, error, completado);
- reforzar manejo de errores parciales y reintentos seguros.

Excluye:

- procesamiento OCR masivo enterprise sin límites;
- cambios de proveedor de almacenamiento.

## Archivos/módulos probables

- `backend/src/documents/documents.controller.ts`
- `backend/src/documents/documents.service.ts`
- `backend/src/documents/services/document-processing.service.ts`
- `frontend/components/pending-batch-modal.tsx`
- `frontend/components/upload-document-modal.tsx`

## Criterios de aceptación

- Lotes de 20+ archivos se suben sin bloquear UI.
- Errores de 1 archivo no cancelan todo el lote.
- Se visualiza estado por archivo en frontend.
- Se respetan límites de tamaño/tipo y límites de plan.

## Verificación mínima

- prueba manual con lote de 20 archivos mixtos válidos;
- `cd backend && pnpm run build`
- `cd frontend && pnpm run build`
- evidencia de tiempos antes/después y logs.

## Riesgos

- saturación de memoria por buffers concurrentes.
- picos de llamadas IA por lotes grandes.
- timeouts de proxy si la UX espera respuesta síncrona larga.

