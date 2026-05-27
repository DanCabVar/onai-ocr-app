# SPEC-03 — Limpieza R2 legacy `extracted/`

## Tarea relacionada

- `T02` Script limpieza R2 legacy `extracted/`.

## Objetivo

Crear un script seguro para listar y opcionalmente eliminar objetos legacy bajo rutas `{userId}/extracted/` en el bucket R2 `onai-ocr-documents`.

## Regla crítica

No ejecutar borrado real sin dry-run previo y aprobación explícita de Danilo/Smith en una sesión posterior.

## Alcance

Incluye:

- script con modo `--dry-run` por defecto;
- listado de objetos candidatos;
- conteo y tamaño total;
- opción explícita `--execute` o similar;
- logs en archivo bajo `04_trabajo/T02_r2_cleanup/`.

Excluye:

- cambios al schema DB;
- migraciones destructivas adicionales.

## Archivos/módulos probables

- `backend/scripts/` o `scripts/`
- `04_trabajo/T02_r2_cleanup/`

## Criterios de aceptación

- Dry-run funciona sin borrar.
- Reporte muestra exactamente qué borraría.
- Delete real requiere flag explícito y no es default.
- Credenciales no quedan impresas ni commiteadas.

## Verificación mínima

- Ejecutar dry-run.
- Guardar reporte dry-run.
- Revisión del script.

## Riesgos

- Borrar documentos útiles por patrón demasiado amplio.
- Exponer credenciales R2 en logs.
