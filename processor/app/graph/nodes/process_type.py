"""Node: Process a single type group (new or existing).

Called via Send() for each TypeGroup — enables parallel processing per type.

For EXISTING types:
  - Extract data using existing schema
  - Upload to Drive + save to DB

For NEW types:
  - Consolidate fields from classification results (reuse, no duplicate LLM call)
  - Re-extract data with unified schema
  - Create Drive folder + DB type + upload docs
"""

from __future__ import annotations

import logging

from app.models.schemas import (
    ConsolidatedField,
    CreatedTypeResult,
    DocumentClassification,
)
from app.models.state import FileInfo, ProcessTypeState
from app.services import db_service, drive_service, gemini_service

logger = logging.getLogger(__name__)


async def process_type_group(state: ProcessTypeState) -> dict:
    """Process one type group — either existing or new."""
    group = state["type_group"]
    files = state["files"]
    classifications = state["classifications"]
    user_id = state["user_id"]
    upload_samples = state["upload_samples"]

    file_map: dict[str, FileInfo] = {f["filename"]: f for f in files}
    cls_map: dict[str, DocumentClassification] = {c.filename: c for c in classifications}

    try:
        if group.is_new:
            result = await _process_new_type(
                group, file_map, cls_map, user_id, upload_samples
            )
        else:
            result = await _process_existing_type(
                group, file_map, user_id, upload_samples
            )
        return {"results": [result]}
    except Exception as e:
        logger.error(f"Failed processing type '{group.type_name}': {e}")
        return {"errors": [f"Error en tipo '{group.type_name}': {e}"]}


async def _process_new_type(
    group,
    file_map: dict[str, FileInfo],
    cls_map: dict[str, DocumentClassification],
    user_id: int,
    upload_samples: bool,
) -> CreatedTypeResult:
    """Full pipeline for a new document type."""
    type_name = group.type_name
    logger.info(f"Processing NEW type: '{type_name}' ({len(group.filenames)} docs)")

    # ---- Step 1: Consolidate fields ----
    # OPTIMIZATION: Reuse classification results instead of calling Gemini again.
    # The original code called inferFieldsForUnclassifiedWithVision a second time
    # here, but we already have the fields from the classification step.
    doc_classifications = [
        cls_map[fn] for fn in group.filenames if fn in cls_map
    ]

    if not doc_classifications:
        raise ValueError(f"No classification data for type '{type_name}'")

    logger.info(f"  Consolidating fields from {len(doc_classifications)} docs...")
    schema = await gemini_service.consolidate_fields(type_name, doc_classifications)
    logger.info(f"  Consolidated schema: {len(schema.fields)} fields")

    # ---- Step 2: Create Drive folder ----
    logger.info(f"  Creating Drive folder: '{type_name}'...")
    drive_folder = await drive_service.create_folder(type_name)

    # ---- Step 3: Save type to DB (within transaction) ----
    logger.info(f"  Saving type to database...")
    db_type = await db_service.create_document_type(
        user_id=user_id,
        name=type_name,
        description=schema.description,
        fields=schema.fields,
        google_drive_folder_id=drive_folder["id"],
        folder_path=drive_folder.get("webViewLink", ""),
    )
    logger.info(f"  Type '{type_name}' created (ID: {db_type['id']})")

    # ---- Step 4: Re-extract + upload documents (optional) ----
    docs_saved = 0
    if upload_samples:
        for fn in group.filenames:
            fi = file_map.get(fn)
            if not fi:
                continue
            try:
                # Re-extract with consolidated schema
                logger.info(f"  Re-extracting: {fn}")
                extracted = await gemini_service.extract_with_schema(
                    file_path=fi["tmp_path"],
                    mime_type=fi["mime_type"],
                    type_name=type_name,
                    schema_fields=schema.fields,
                )

                # Upload to Drive
                drive_file = await drive_service.upload_file(
                    file_path=fi["tmp_path"],
                    filename=fn,
                    mime_type=fi["mime_type"],
                    folder_id=drive_folder["id"],
                )
                public_url = await drive_service.get_public_url(drive_file["id"])

                # Save to DB
                await db_service.create_document(
                    user_id=user_id,
                    document_type_id=db_type["id"],
                    filename=fn,
                    google_drive_link=public_url,
                    google_drive_file_id=drive_file["id"],
                    extracted_data=extracted,
                )
                docs_saved += 1
                logger.info(f"  Saved: {fn}")
            except Exception as e:
                logger.error(f"  Error processing '{fn}': {e}")

    return CreatedTypeResult(
        id=db_type["id"],
        name=type_name,
        description=schema.description,
        field_count=len(schema.fields),
        sample_document_count=docs_saved,
        google_drive_folder_id=drive_folder["id"],
        folder_path=drive_folder.get("webViewLink", ""),
        fields=schema.fields,
    )


async def _process_existing_type(
    group,
    file_map: dict[str, FileInfo],
    user_id: int,
    upload_samples: bool,
) -> CreatedTypeResult:
    """Process documents for an existing type — extract with existing schema."""
    type_name = group.type_name
    logger.info(f"Processing EXISTING type: '{type_name}' (ID: {group.existing_type_id})")

    if not upload_samples:
        logger.info(f"  Skipping upload (uploadSamples=false)")
        return CreatedTypeResult(
            id=group.existing_type_id,
            name=type_name,
            description=f"Tipo existente (sin documentos subidos)",
            field_count=0,
            sample_document_count=0,
            google_drive_folder_id=group.existing_drive_folder_id or "",
        )

    # Fetch existing schema from DB
    db_type = await db_service.find_document_type_by_name(type_name)
    if not db_type:
        raise ValueError(f"Type '{type_name}' not found in DB")

    existing_fields = [
        ConsolidatedField(
            name=f["name"],
            type=f["type"],
            label=f.get("label", f["name"]),
            required=f.get("required", False),
            description=f.get("description", ""),
        )
        for f in db_type.get("field_schema", {}).get("fields", [])
    ]

    docs_saved = 0
    for fn in group.filenames:
        fi = file_map.get(fn)
        if not fi:
            continue
        try:
            extracted = await gemini_service.extract_with_schema(
                file_path=fi["tmp_path"],
                mime_type=fi["mime_type"],
                type_name=type_name,
                schema_fields=existing_fields,
            )

            drive_file = await drive_service.upload_file(
                file_path=fi["tmp_path"],
                filename=fn,
                mime_type=fi["mime_type"],
                folder_id=group.existing_drive_folder_id or db_type["google_drive_folder_id"],
            )
            public_url = await drive_service.get_public_url(drive_file["id"])

            await db_service.create_document(
                user_id=user_id,
                document_type_id=group.existing_type_id,
                filename=fn,
                google_drive_link=public_url,
                google_drive_file_id=drive_file["id"],
                extracted_data=extracted,
            )
            docs_saved += 1
            logger.info(f"  Saved: {fn}")
        except Exception as e:
            logger.error(f"  Error processing '{fn}': {e}")

    return CreatedTypeResult(
        id=group.existing_type_id,
        name=type_name,
        description=f"{db_type.get('description', '')} ({docs_saved} documentos agregados)",
        field_count=len(existing_fields),
        sample_document_count=docs_saved,
        google_drive_folder_id=group.existing_drive_folder_id or "",
        fields=existing_fields,
    )
