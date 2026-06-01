# SPEC-23 — Estandarizar configuración ESLint (frontend + backend)

## Tarea relacionada

- `T23` Definir y estandarizar ESLint en todo el monorepo.

## Objetivo

Establecer una configuración ESLint explícita y mantenible para `frontend` y `backend`, de forma que `pnpm run lint` sea confiable en local y CI, y pueda volver a ser obligatorio como gate de calidad.

## Contexto

En el estado actual, los jobs CI de lint fallan o deben saltarse porque no existe configuración ESLint detectada (`eslint.config.*` o `.eslintrc*`) en los proyectos.  
Esto genera falsos rojos o fuerza workarounds condicionales.

## Alcance incluido

- definir estrategia de configuración:
  - opción A: config independiente por proyecto (`frontend` y `backend`);
  - opción B: config compartida base + extensiones por proyecto;
- crear archivos de configuración ESLint requeridos;
- alinear scripts `lint` en `package.json` con la estrategia elegida;
- validar ejecución local y en CI;
- volver obligatorio lint en CI una vez verificada la configuración.

## Fuera de alcance

- refactor masivo de estilo en todo el repo (se permite baseline con warnings/errores acotados);
- introducción de herramientas extra no necesarias para ESLint (ej. reglas de seguridad avanzadas) en esta fase inicial.

## Archivos/módulos relevantes

- `backend/package.json`
- `frontend/package.json`
- `backend/*eslint*` (nuevo)
- `frontend/*eslint*` (nuevo)
- `.github/workflows/ci.yml`

## Criterios de aceptación

- `pnpm run lint` ejecuta en backend y frontend sin error de “missing config”.
- Configuración ESLint queda versionada y documentada.
- CI ejecuta lint en ambos proyectos de forma obligatoria (sin skip por falta de config).
- Build de frontend/backend sigue pasando tras activar lint.

## Plan de prueba / verificación mínima

- `cd backend && pnpm install && pnpm run lint && pnpm run build`
- `cd frontend && pnpm install && pnpm run lint && pnpm run build`
- validar run CI verde en rama de trabajo con lint habilitado.

## Riesgos y rollback

- aparición de muchos errores de lint heredados al activar reglas estrictas.
- incompatibilidades entre versiones de plugins/configs de ESLint.
- rollback: mantener configuración mínima funcional y activar reglas más estrictas por etapas.

## Recomendación de implementación

- comenzar con configuración mínima y pragmática para desbloquear CI;
- luego endurecer reglas progresivamente (por ejemplo en `SPEC-23.1` o tarea derivada) para evitar bloquear entregas críticas.

## Reporte esperado del agente

- Archivos consultados.
- Archivos modificados.
- Comandos ejecutados.
- Evidencia de prueba.
- Riesgos/dudas.
- Cambio sugerido en `PLAN_MAESTRO.md`.

