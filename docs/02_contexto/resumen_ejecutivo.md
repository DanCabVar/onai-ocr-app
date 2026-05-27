# Resumen ejecutivo — ONAI OCR

ONAI OCR es una plataforma SaaS para procesamiento inteligente de documentos: permite subir documentos, aplicar OCR, clasificar tipos, extraer campos estructurados, homologar schemas, consultar información y gestionar almacenamiento.

## Propuesta de valor

Reducir trabajo manual de lectura, clasificación y tabulación documental usando OCR + IA, con foco inicial en empresas que manejan alto volumen de PDFs/documentos administrativos.

## Capacidades actuales

- OCR con Mistral.
- Clasificación y extracción con Gemini.
- Inferencia de tipos de documento desde muestras.
- Homologación de campos equivalentes.
- Re-extracción con schema unificado.
- Upload batch y flujo de documentos pendientes.
- Storage en Cloudflare R2.
- Multi-tenant por usuario.
- Chat/RAG en desarrollo.
- CI/CD con GHCR + SSH para producción `master`.

## Estado operativo observado — 2026-05-18

- App pública arriba: `https://ocr.moti.cl`.
- Health backend ok: `https://ocr.moti.cl/api/auth/health`.
- Containers productivos corriendo: frontend, backend, processor, postgres.
- DB productiva con 10 usuarios, 64 documentos y 13 tipos de documento.
- MC2 operativo en `https://mc2.moti.cl`, board OCR AI con 98 tareas históricas.

## Foco próximo

1. Ordenar proyecto bajo harness + SDD.
2. Sincronizar MC2 con `PLAN_MAESTRO.md`.
3. Cerrar UX de batch/inbox background.
4. Agregar monitoring/alertas.
5. Auditar seguridad multi-tenant/RAG.
6. Preparar billing/admin/onboarding para producto comercial.
