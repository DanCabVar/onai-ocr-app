"""Node: Validate uploaded documents before processing."""

from __future__ import annotations

import logging

from app.config import settings
from app.models.state import BatchState

logger = logging.getLogger(__name__)

ALLOWED_MIME_TYPES = {"application/pdf", "image/png", "image/jpeg", "image/jpg"}


def validate_documents(state: BatchState) -> dict:
    """Validate all uploaded files.

    Checks:
    - At least 2 files (required for type inference)
    - No more than max_batch_documents
    - Allowed MIME types
    - File size within limits
    """
    files = state["files"]
    errors: list[str] = []

    if len(files) < 2:
        errors.append("Se requieren al menos 2 documentos para inferir tipos")
    if len(files) > settings.max_batch_documents:
        errors.append(f"Maximo {settings.max_batch_documents} archivos permitidos")

    valid_files = []
    for f in files:
        if f["mime_type"] not in ALLOWED_MIME_TYPES:
            errors.append(f"Tipo no permitido: {f['filename']} ({f['mime_type']})")
            continue
        if f["size_bytes"] > settings.max_file_size_mb * 1024 * 1024:
            errors.append(f"Archivo muy grande: {f['filename']}")
            continue
        valid_files.append(f)

    logger.info(
        f"Validation: {len(valid_files)}/{len(files)} files valid, {len(errors)} errors"
    )

    return {
        "files": valid_files,
        "errors": errors,
        "current_step": "validated",
        "progress_pct": 5,
    }
