# T28 — Calidad y consistencia del chatbot documental

## Estado inicial

Spec creado a partir de la validación QA de `T20` en junio 2026.

## Motivación

Los ajustes recientes mejoraron el chat, pero la validación manual mostró que el problema real excede el alcance del PoC híbrido con grafo:

- ambigüedad entre campos relacionados;
- dependencia alta del phrasing del usuario;
- duplicados o mezclas de campos bajo una misma intención semántica;
- fragilidad ante documentos nuevos.

## Primeros insumos QA

Casos observados durante la validación:

- follow-ups sobre `Yolito` mejoran con contexto, pero `proveedor` puede mezclar nombre/rut/correo/teléfono;
- consultas por números de orden pueden traer valores vacíos o múltiples coincidencias si no se filtran semánticamente;
- tipos documentales ya muestran un comportamiento más sólido que proveedor/número OC.

## Próximo trabajo sugerido

1. Definir catálogo de intenciones del chat.
2. Definir resolución semántica por campo/label/sinónimo.
3. Armar benchmark QA versionado con expected answers.
4. Medir precisión por intención antes de seguir ampliando rutas determinísticas.
