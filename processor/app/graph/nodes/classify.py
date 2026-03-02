"""Node: Classify individual documents using Gemini Vision.

This node is called once per document via Send() for parallel classification.
It performs classification AND field extraction in a single LLM call
(optimisation over the original code which made 2 calls per document).
"""

from __future__ import annotations

import logging

from app.models.schemas import DocumentClassification
from app.models.state import ClassifyDocState
from app.services import gemini_service

logger = logging.getLogger(__name__)


async def classify_single_document(state: ClassifyDocState) -> dict:
    """Classify one document and extract its fields.

    Called in parallel via Send() — one instance per document.
    Returns a single-element list that gets operator.add-merged into
    BatchState.classifications.
    """
    file_info = state["file"]
    filename = file_info["filename"]

    logger.info(f"Classifying: {filename}")

    try:
        classification = await gemini_service.classify_and_extract_fields(
            file_path=file_info["tmp_path"],
            mime_type=file_info["mime_type"],
        )
        # Override filename since Gemini sees the tmp path
        classification.filename = filename

        logger.info(
            f"Classified '{filename}' as '{classification.inferred_type}' "
            f"({len(classification.fields)} fields, confidence={classification.confidence:.2f})"
        )
        return {"classifications": [classification]}

    except Exception as e:
        logger.error(f"Failed to classify '{filename}': {e}")
        return {
            "classifications": [
                DocumentClassification(
                    filename=filename,
                    inferred_type="Documento Sin Clasificar",
                    summary=f"Error: {e}",
                    confidence=0.0,
                )
            ]
        }
