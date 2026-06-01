# SPEC-14 â€” Carga paralela de archivos

## Tarea relacionada

- `T14` Mejorar throughput de subida de mÃºltiples archivos.

## Objetivo

Reducir tiempo total de carga y procesamiento inicial para lotes de documentos, manteniendo control de errores, lÃ­mites por plan y estabilidad del backend.

## Alcance

Incluye:

- evaluar flujo actual `upload-batch`/`upload-to-inbox`;
- aumentar paralelismo controlado en subida y encolado;
- reportar progreso real por archivo (subido, en proceso, error, completado);
- reforzar manejo de errores parciales y reintentos seguros.

Excluye:

- procesamiento OCR masivo enterprise sin lÃ­mites;
- cambios de proveedor de almacenamiento.

## Archivos/mÃ³dulos probables

- `backend/src/documents/documents.controller.ts`
- `backend/src/documents/documents.service.ts`
- `backend/src/documents/services/document-processing.service.ts`
- `frontend/components/pending-batch-modal.tsx`
- `frontend/components/upload-document-modal.tsx`

## Criterios de aceptaciÃ³n

- Lotes de 20+ archivos se suben sin bloquear UI.
- Errores de 1 archivo no cancelan todo el lote.
- Se visualiza estado por archivo en frontend.
- Se respetan lÃ­mites de tamaÃ±o/tipo y lÃ­mites de plan.

## VerificaciÃ³n mÃ­nima

- prueba manual con lote de 20 archivos mixtos vÃ¡lidos;
- `cd backend && pnpm run build`
- `cd frontend && pnpm run build`
- evidencia de tiempos antes/despuÃ©s y logs.

## Riesgos

- saturaciÃ³n de memoria por buffers concurrentes.
- picos de llamadas IA por lotes grandes.
- timeouts de proxy si la UX espera respuesta sÃ­ncrona larga.


## Estado actual (2026-05-27)

Estado: En revisión.

Implementación funcional completada en rama codex/spec-14-carga-paralela. Pendientes de cierre operativo/documental:

- prueba real con lote 20+ en entorno objetivo;
- benchmark antes/después con evidencia de tiempos y throughput;
- validación explícita de error parcial (1 archivo falla sin cortar lote);
- confirmación de límites por plan en flujo paralelo (casos borde);
- opcional recomendado: mover concurrencias (4/3) a variables de entorno;
- opcional recomendado: migración formal DB para processing_step si producción no usa synchronize;
- cierre documental final en plan/history/entregables.
