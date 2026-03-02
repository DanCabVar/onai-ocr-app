"""FastAPI server for the document processing microservice.

Exposes a single endpoint that receives files and runs the LangGraph pipeline.
The NestJS backend calls this service instead of running the processing inline.
"""

from __future__ import annotations

import logging
import os
import shutil
import tempfile
from pathlib import Path

from fastapi import FastAPI, File, Form, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware

from app.config import settings
from app.graph.batch_graph import batch_graph
from app.models.schemas import BatchProcessResponse, CreatedTypeResult
from app.models.state import BatchState, FileInfo

logging.basicConfig(
    level=logging.DEBUG if settings.debug else logging.INFO,
    format="%(asctime)s [%(name)s] %(levelname)s: %(message)s",
)
logger = logging.getLogger(__name__)

app = FastAPI(
    title="ONAI Document Processor",
    description="LangGraph-powered document processing pipeline",
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health")
async def health():
    return {"status": "ok", "service": "document-processor"}


@app.post("/process-batch", response_model=BatchProcessResponse)
async def process_batch(
    files: list[UploadFile] = File(...),
    user_id: int = Form(...),
    upload_samples: bool = Form(False),
):
    """Process a batch of documents through the LangGraph pipeline.

    This endpoint:
    1. Saves uploaded files to temp disk
    2. Builds initial state
    3. Invokes the LangGraph batch_graph
    4. Returns results
    """
    if not files:
        raise HTTPException(400, "No se proporcionaron archivos")
    if len(files) < 2:
        raise HTTPException(400, "Se requieren al menos 2 documentos")
    if len(files) > settings.max_batch_documents:
        raise HTTPException(400, f"Maximo {settings.max_batch_documents} archivos")

    # Save files to temp directory
    tmp_dir = tempfile.mkdtemp(prefix="onai_batch_")
    file_infos: list[FileInfo] = []

    try:
        for uploaded in files:
            tmp_path = os.path.join(tmp_dir, uploaded.filename)
            content = await uploaded.read()
            Path(tmp_path).write_bytes(content)

            file_infos.append(
                FileInfo(
                    filename=uploaded.filename,
                    mime_type=uploaded.content_type or "application/pdf",
                    tmp_path=tmp_path,
                    size_bytes=len(content),
                )
            )

        logger.info(
            f"Received {len(file_infos)} files from user {user_id} "
            f"(uploadSamples={upload_samples})"
        )

        # Build initial state
        initial_state: BatchState = {
            "user_id": user_id,
            "upload_samples": upload_samples,
            "files": file_infos,
            "classifications": [],
            "type_groups": [],
            "results": [],
            "errors": [],
            "current_step": "starting",
            "progress_pct": 0,
        }

        # Run the graph with concurrency control
        # max_concurrency limits parallel Send() nodes to avoid API rate limits
        config = {
            "max_concurrency": settings.max_parallel_classifications,
        }

        final_state = await batch_graph.ainvoke(initial_state, config=config)

        results: list[CreatedTypeResult] = final_state.get("results", [])
        errors: list[str] = final_state.get("errors", [])

        return BatchProcessResponse(
            success=len(results) > 0,
            message=f"{len(results)} tipo(s) procesado(s) exitosamente",
            created_types=results,
            total_documents_processed=len(file_infos),
            total_types_created=sum(1 for r in results if r.id > 0),
            errors=errors,
        )

    except Exception as e:
        logger.error(f"Pipeline failed: {e}", exc_info=True)
        raise HTTPException(500, f"Error en el procesamiento: {e}")

    finally:
        # Clean up temp files
        shutil.rmtree(tmp_dir, ignore_errors=True)


@app.get("/limits")
async def get_limits():
    """Return current processing limits and configuration."""
    return {
        "max_batch_documents": settings.max_batch_documents,
        "max_file_size_mb": settings.max_file_size_mb,
        "max_parallel_classifications": settings.max_parallel_classifications,
        "max_parallel_extractions": settings.max_parallel_extractions,
        "gemini_rpm_limit": settings.gemini_rpm_limit,
        "gemini_delay_between_calls_s": settings.gemini_delay_between_calls,
        "max_retries": settings.max_retries,
        "estimated_time_per_doc_s": settings.gemini_delay_between_calls * 3,
        "estimated_total_time_10_docs_s": _estimate_time(10),
        "allowed_mime_types": [
            "application/pdf",
            "image/png",
            "image/jpeg",
            "image/jpg",
        ],
    }


def _estimate_time(n_docs: int) -> float:
    """Estimate total processing time for n documents.

    LLM calls per pipeline:
      - classify: n calls (parallel in batches of max_parallel)
      - homologate: 1 call
      - consolidate: ~n_types calls (assume n/3 types)
      - re-extract (uploadSamples): n calls

    Total: n + 1 + n/3 + n = ~2.33n + 1 calls
    Each call takes ~gemini_delay seconds
    """
    delay = settings.gemini_delay_between_calls
    parallel = settings.max_parallel_classifications
    n_types = max(1, n_docs // 3)

    # Classification: batched in parallel groups
    classify_time = (n_docs / parallel) * delay
    # Homologation: 1 call
    homologate_time = delay
    # Consolidation: 1 per type
    consolidate_time = n_types * delay
    # Re-extraction: 1 per doc
    reextract_time = n_docs * delay

    return classify_time + homologate_time + consolidate_time + reextract_time


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(app, host="0.0.0.0", port=settings.port)
