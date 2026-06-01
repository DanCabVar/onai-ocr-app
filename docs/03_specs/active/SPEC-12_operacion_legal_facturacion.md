# SPEC-12 — Operación legal y facturación Chile

## Tarea relacionada

- `T12` Operación legal/facturación Chile.
- MC2: `Crear empresa (Empresa en un Día Chile) + facturación`.

## Objetivo

Ordenar el checklist operativo/legal para vender ONAI OCR en Chile: constitución/vehículo legal, inicio de actividades, emisión de documentos tributarios y procesos básicos de facturación.

## Regla crítica

No crear empresa, iniciar actividades, contratar servicios, firmar documentos ni enviar información a terceros sin instrucción explícita de Danilo.

## Alcance

Incluye:

- checklist de decisiones e información necesaria;
- opciones de facturación electrónica/SII;
- dependencias con Stripe/billing;
- riesgos y preguntas para contador/abogado;
- documentación interna de proceso.

Excluye:

- asesoría legal/tributaria definitiva;
- trámites externos ejecutados por el agente;
- almacenamiento de claves SII o datos sensibles en el repo.

## Archivos/módulos probables

- `docs/05_entregables/operacion/`
- `docs/03_specs/active/SPEC-04_planes_stripe_billing.md` para dependencias técnicas.

## Criterios de aceptación

- Checklist claro de pasos y decisiones.
- Separación entre tareas que puede preparar Smith y acciones que debe hacer Danilo/profesional.
- No quedan secretos ni datos personales sensibles en git.
- Dependencias con billing/Stripe documentadas.

## Verificación mínima

- Revisión documental.
- Confirmar que no se commitearon credenciales ni documentos personales.

## Riesgos

- Tratar una guía operativa como asesoría legal/tributaria.
- Exponer datos sensibles de empresa/personas.
- Acciones externas irreversibles sin aprobación.
