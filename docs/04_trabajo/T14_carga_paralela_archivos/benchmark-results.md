# Benchmark Results — T14 Carga Paralela

Fecha:

Entorno:

- API base URL:
- Branch:
- Commit:
- Dataset:
- Cantidad de archivos:
- Mezcla tipos (pdf/jpg/png/webp):

## Configuración

- Endpoint: `POST /api/documents/upload-batch`
- Polling: `POST /api/documents/batch-status` (cada 2s)
- Runs:

## Baseline (antes)

| Run | Upload ms | Procesamiento ms | Total ms | Completed | Pending | Errors |
|---|---:|---:|---:|---:|---:|---:|
| 1 |  |  |  |  |  |  |
| 2 |  |  |  |  |  |  |
| 3 |  |  |  |  |  |  |

Promedio baseline:

## Actual (después)

| Run | Upload ms | Procesamiento ms | Total ms | Completed | Pending | Errors |
|---|---:|---:|---:|---:|---:|---:|
| 1 |  |  |  |  |  |  |
| 2 |  |  |  |  |  |  |
| 3 |  |  |  |  |  |  |

Promedio actual:

## Delta

- Mejora upload:
- Mejora total:
- Comportamiento ante errores parciales:

## Evidencia

- JSON de salida: `docs/04_trabajo/T14_carga_paralela_archivos/benchmark-output.json`
- Logs backend:
- Screenshot UI con progreso por archivo:
