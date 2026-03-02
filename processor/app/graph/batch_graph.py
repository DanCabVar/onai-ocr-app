"""LangGraph definition for the batch document processing pipeline.

Graph topology:
                              ┌─────────────────────┐
                              │     validate         │
                              └──────────┬───────────┘
                                         │
                              ┌──────────▼───────────┐
                              │  fan_out_classify     │ ──── Send() per doc
                              └──────────┬───────────┘
                         ┌───────────────┼───────────────┐
                    ┌────▼────┐    ┌────▼────┐    ┌────▼────┐
                    │classify │    │classify │    │classify │  (parallel, max N)
                    │  doc 1  │    │  doc 2  │    │  doc 3  │
                    └────┬────┘    └────┬────┘    └────┬────┘
                         └───────────────┼───────────────┘
                              ┌──────────▼───────────┐
                              │ homologate_and_group  │  (1 LLM call)
                              └──────────┬───────────┘
                                         │
                              ┌──────────▼───────────┐
                              │   fan_out_types       │ ──── Send() per type
                              └──────────┬───────────┘
                         ┌───────────────┼───────────────┐
                    ┌────▼────┐    ┌────▼────┐    ┌────▼────┐
                    │ process │    │ process │    │ process │  (parallel per type)
                    │ type A  │    │ type B  │    │ type C  │
                    └────┬────┘    └────┬────┘    └────┬────┘
                         └───────────────┼───────────────┘
                              ┌──────────▼───────────┐
                              │     aggregate         │
                              └──────────────────────┘

LLM call budget (10 docs, 2 new types, uploadSamples=true):
  Original (TypeScript): ~33 calls
  Optimised (LangGraph): ~10 (classify) + 1 (homologate) + 2 (consolidate) + 10 (re-extract) = 23 calls
  Saved: 10 calls (the duplicate classify+extract in step 3 of the original)
"""

from __future__ import annotations

import logging

from langgraph.graph import END, START, StateGraph
from langgraph.types import Send

from app.config import settings
from app.models.state import (
    BatchState,
    ClassifyDocState,
    ProcessTypeState,
)
from app.graph.nodes.classify import classify_single_document
from app.graph.nodes.homologate import homologate_and_group
from app.graph.nodes.process_type import process_type_group
from app.graph.nodes.validate import validate_documents

logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# Router functions (conditional edges)
# ---------------------------------------------------------------------------

def should_continue_after_validation(state: BatchState) -> str:
    """After validation, abort if no valid files remain."""
    if not state.get("files"):
        return "abort"
    return "classify"


def fan_out_classifications(state: BatchState) -> list[Send]:
    """Send() one classify task per document — runs in parallel.

    max_concurrency is enforced at the graph.invoke() level.
    """
    user_id = state["user_id"]
    sends = []
    for f in state["files"]:
        sends.append(
            Send(
                "classify_document",
                ClassifyDocState(file=f, user_id=user_id),
            )
        )
    logger.info(f"Fan-out: {len(sends)} classification tasks")
    return sends


def fan_out_type_processing(state: BatchState) -> list[Send]:
    """Send() one process task per type group — runs in parallel."""
    groups = state.get("type_groups", [])
    if not groups:
        return [Send("aggregate", {})]

    files = state["files"]
    classifications = state["classifications"]
    user_id = state["user_id"]
    upload_samples = state["upload_samples"]

    file_map = {f["filename"]: f for f in files}

    sends = []
    for group in groups:
        group_files = [file_map[fn] for fn in group.filenames if fn in file_map]
        group_cls = [c for c in classifications if c.filename in group.filenames]

        sends.append(
            Send(
                "process_type",
                ProcessTypeState(
                    type_group=group,
                    files=group_files,
                    classifications=group_cls,
                    user_id=user_id,
                    upload_samples=upload_samples,
                ),
            )
        )

    logger.info(f"Fan-out: {len(sends)} type processing tasks")
    return sends


def aggregate_results(state: BatchState) -> dict:
    """Final node — summarize results."""
    results = state.get("results", [])
    errors = state.get("errors", [])

    logger.info(
        f"Pipeline complete: {len(results)} types processed, {len(errors)} errors"
    )

    return {
        "current_step": "completed",
        "progress_pct": 100,
    }


# ---------------------------------------------------------------------------
# Abort handler
# ---------------------------------------------------------------------------

def abort_pipeline(state: BatchState) -> dict:
    """Called when validation fails — no valid files."""
    return {
        "current_step": "aborted",
        "progress_pct": 0,
        "errors": state.get("errors", []) + ["Pipeline abortado: sin archivos validos"],
    }


# ---------------------------------------------------------------------------
# Build the graph
# ---------------------------------------------------------------------------

def build_batch_graph() -> StateGraph:
    """Construct and compile the batch processing graph."""
    graph = StateGraph(BatchState)

    # Add nodes
    graph.add_node("validate", validate_documents)
    graph.add_node("classify_document", classify_single_document)
    graph.add_node("homologate", homologate_and_group)
    graph.add_node("process_type", process_type_group)
    graph.add_node("aggregate", aggregate_results)
    graph.add_node("abort", abort_pipeline)

    # Entry edge
    graph.add_edge(START, "validate")

    # After validation: abort or fan-out classification
    graph.add_conditional_edges(
        "validate",
        should_continue_after_validation,
        {"abort": "abort", "classify": "fan_out_classify"},
    )

    # Fan-out: one classify per document (parallel)
    graph.add_node("fan_out_classify", lambda _: {"current_step": "classifying", "progress_pct": 10})
    graph.add_conditional_edges("fan_out_classify", fan_out_classifications)

    # After ALL classifications are done → homologate
    graph.add_edge("classify_document", "homologate")

    # After homologation → fan-out per type
    graph.add_conditional_edges("homologate", fan_out_type_processing)

    # After ALL type processing is done → aggregate
    graph.add_edge("process_type", "aggregate")

    # Terminal edges
    graph.add_edge("aggregate", END)
    graph.add_edge("abort", END)

    return graph.compile()


# Pre-compiled graph instance
batch_graph = build_batch_graph()
