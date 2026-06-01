# SPEC-09 — Dominio profesional y producción ONAI

## Tarea relacionada

- `T09` Dominio profesional ONAI.

## Objetivo

Migrar o complementar `ocr.moti.cl` con dominio profesional definitivo para ONAI, manteniendo SSL, rutas API y compatibilidad.

## Estado conocido MC2 — 2026-05-27

MC2 mantiene pendiente `SSL propio + dominio onaiconsulting.cl o onai.cl`. El spec queda en `Requiere decisión usuario` hasta elegir dominio final.

## Alcance

Incluye:

- decisión dominio final;
- DNS Cloudflare;
- labels Traefik;
- variables frontend/backend URLs;
- redirects si aplica;
- verificación SSL.

## Criterios de aceptación

- Dominio final responde frontend.
- `/api/auth/health` responde por dominio final.
- SSL válido.
- Dominios antiguos siguen funcionando o redirigen según decisión.

## Riesgos

- Romper OAuth/callbacks si URLs cambian.
- Variables bakeadas en frontend requieren rebuild.
