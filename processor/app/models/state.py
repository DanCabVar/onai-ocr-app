"""LangGraph state definitions for the batch processing pipeline.

The state flows through the graph:
  validate -> classify_all -> homologate -> fan_out_types -> [process_type] -> aggregate
"""

from __future__ import annotations

import operator
from typing import Annotated, TypedDict

from app.models.schemas import (
    ConsolidatedField,
    ConsolidatedSchema,
    CreatedTypeResult,
    DocumentClassification,
    TypeGroup,
)


# ---------------------------------------------------------------------------
# Uploaded file representation (serialisable — no raw buffers in state)
# ---------------------------------------------------------------------------
class FileInfo(TypedDict):
    """Lightweight file descriptor kept in graph state.

    The actual binary data is stored on disk (tmp_path) to avoid bloating
    state with multi-MB buffers.
    """

    filename: str
    mime_type: str
    tmp_path: str  # path to the temp file on disk
    size_bytes: int


# ---------------------------------------------------------------------------
# Main graph state
# ---------------------------------------------------------------------------
class BatchState(TypedDict):
    """Shared state for the batch-processing graph."""

    # --- Inputs (set once at start) ---
    user_id: int
    upload_samples: bool
    files: list[FileInfo]

    # --- Step 1: Classification ---
    classifications: Annotated[list[DocumentClassification], operator.add]

    # --- Step 2: Homologation & grouping ---
    type_groups: list[TypeGroup]

    # --- Step 3+: Per-type processing (results aggregated) ---
    results: Annotated[list[CreatedTypeResult], operator.add]
    errors: Annotated[list[str], operator.add]

    # --- Progress tracking ---
    current_step: str
    progress_pct: int


# ---------------------------------------------------------------------------
# Sub-state sent to the per-document classification node via Send()
# ---------------------------------------------------------------------------
class ClassifyDocState(TypedDict):
    """State slice sent to each parallel classify-document node."""

    file: FileInfo
    user_id: int


# ---------------------------------------------------------------------------
# Sub-state sent to the per-type processing sub-graph via Send()
# ---------------------------------------------------------------------------
class ProcessTypeState(TypedDict):
    """State slice sent to each parallel process-type node."""

    type_group: TypeGroup
    # Files that belong to this type
    files: list[FileInfo]
    # Classification data for re-use (avoids duplicate LLM calls)
    classifications: list[DocumentClassification]
    # User context
    user_id: int
    upload_samples: bool
