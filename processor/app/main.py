"""FastAPI server for the document processing microservice.

Exposes endpoints to:
  - Process batches of documents through the LangGraph pipeline
  - Stream progress via SSE (Server-Sent Events)
  - Query processing limits
"""

from __future__ import annotations

import asyncio
import json
import logging
import os
import shutil
import tempfile
import uuid
from pathlib import Path

from fastapi import FastAPI, File, Form, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse

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

# In-memory progress store for SSE streaming
_progress_store: dict[str, dict] = {}


@app.get("/health")
async def health():
    return {"status": "ok", "service": "document-processor"}


@app.post("/process-batch", response_model=BatchProcessResponse)
async def process_batch(
    files: list[UploadFile] = File(...),
    user_id: int = Form(...),
    upload_samples: bool = Form(False),
):
    """Process a batch of documents through the LangGraph pipeline."""
    if not files:
        raise HTTPException(400, "No se proporcionaron archivos")
    if len(files) < 2:
        raise HTTPException(400, "Se requieren al menos 2 documentos")
    if len(files) > settings.max_batch_documents:
        raise HTTPException(400, f"Maximo {settings.max_batch_documents} archivos")

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
        shutil.rmtree(tmp_dir, ignore_errors=True)


@app.post("/process-batch-stream")
async def process_batch_stream(
    files: list[UploadFile] = File(...),
    user_id: int = Form(...),
    upload_samples: bool = Form(False),
):
    """Process a batch of documents and stream progress via SSE.

    Returns a Server-Sent Events stream with progress updates, then the final result.
    Each event has the format:
      event: progress
      data: {"step": "classifying", "progress_pct": 25, "message": "..."}

      event: complete
      data: {"success": true, "created_types": [...], ...}

      event: error
      data: {"error": "..."}
    """
    if not files:
        raise HTTPException(400, "No se proporcionaron archivos")
    if len(files) < 2:
        raise HTTPException(400, "Se requieren al menos 2 documentos")

    tmp_dir = tempfile.mkdtemp(prefix="onai_batch_")
    file_infos: list[FileInfo] = []

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

    async def event_stream():
        try:
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

            config = {
                "max_concurrency": settings.max_parallel_classifications,
            }

            # Stream intermediate states using astream
            final_state = None
            async for state_update in batch_graph.astream(initial_state, config=config):
                # astream yields dicts keyed by node name
                for node_name, node_output in state_update.items():
                    step = node_output.get("current_step", node_name)
                    pct = node_output.get("progress_pct", 0)

                    step_labels = {
                        "starting": "Iniciando procesamiento...",
                        "validated": "Archivos validados",
                        "classifying": f"Clasificando {len(file_infos)} documentos...",
                        "classify_document": "Clasificando documento...",
                        "homologated": "Homologando tipos de documento...",
                        "process_type": "Procesando tipo de documento...",
                        "completed": "Procesamiento completado",
                        "aborted": "Procesamiento abortado",
                    }

                    msg = step_labels.get(step, f"Procesando: {step}")

                    progress_data = {
                        "step": step,
                        "progress_pct": pct,
                        "message": msg,
                    }
                    yield f"event: progress\ndata: {json.dumps(progress_data)}\n\n"

                    final_state = {**initial_state, **node_output}

            # Build final response
            if final_state:
                results = final_state.get("results", [])
                errors = final_state.get("errors", [])

                response_data = BatchProcessResponse(
                    success=len(results) > 0,
                    message=f"{len(results)} tipo(s) procesado(s) exitosamente",
                    created_types=results,
                    total_documents_processed=len(file_infos),
                    total_types_created=sum(1 for r in results if hasattr(r, 'id') and r.id > 0),
                    errors=errors,
                )
                yield f"event: complete\ndata: {response_data.model_dump_json()}\n\n"
            else:
                yield f'event: error\ndata: {{"error": "No se obtuvo resultado del pipeline"}}\n\n'

        except Exception as e:
            logger.error(f"Stream pipeline failed: {e}", exc_info=True)
            yield f'event: error\ndata: {{"error": "{str(e)}"}}\n\n'

        finally:
            shutil.rmtree(tmp_dir, ignore_errors=True)

    return StreamingResponse(
        event_stream(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )


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
    delay = settings.gemini_delay_between_calls
    parallel = settings.max_parallel_classifications
    n_types = max(1, n_docs // 3)

    classify_time = (n_docs / parallel) * delay
    homologate_time = delay
    consolidate_time = n_types * delay
    reextract_time = n_docs * delay

    return classify_time + homologate_time + consolidate_time + reextract_time


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(app, host="0.0.0.0", port=settings.port)
