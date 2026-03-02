"""Node: Homologate type names and group documents by type.

After all documents are classified, this node:
1. Checks which inferred types already exist in the DB
2. Homologates similar new type names (via Gemini)
3. Groups documents by their final type name
"""

from __future__ import annotations

import logging

from app.models.schemas import DocumentClassification
from app.models.state import BatchState, FileInfo, TypeGroup
from app.services import db_service, gemini_service

logger = logging.getLogger(__name__)


async def homologate_and_group(state: BatchState) -> dict:
    """Merge similar type names and create TypeGroups."""
    classifications = state["classifications"]
    files = state["files"]

    # Build filename -> FileInfo lookup
    file_map: dict[str, FileInfo] = {f["filename"]: f for f in files}

    # Fetch existing types from DB
    existing_types = await db_service.get_existing_document_types()
    existing_names = {t["name"].lower().strip(): t for t in existing_types}

    # Group classifications by inferred type
    type_to_docs: dict[str, list[DocumentClassification]] = {}
    for cls in classifications:
        key = cls.inferred_type
        type_to_docs.setdefault(key, []).append(cls)

    # Separate new vs existing types
    new_type_names = []
    existing_groups: list[TypeGroup] = []

    for type_name, docs in type_to_docs.items():
        lower_name = type_name.lower().strip()
        if lower_name in existing_names:
            db_type = existing_names[lower_name]
            existing_groups.append(
                TypeGroup(
                    type_name=type_name,
                    filenames=[d.filename for d in docs],
                    existing_type_id=db_type["id"],
                    existing_drive_folder_id=db_type.get("google_drive_folder_id"),
                    is_new=False,
                )
            )
            logger.info(f"Type '{type_name}' already exists (ID: {db_type['id']})")
        else:
            new_type_names.append(type_name)

    # Homologate new type names (merge similar ones)
    if len(new_type_names) >= 2:
        logger.info(f"Homologating {len(new_type_names)} new type names...")
        name_mapping = await gemini_service.homologate_type_names(new_type_names)
    else:
        name_mapping = {n: n for n in new_type_names}

    # Regroup new types with homologated names
    homologated_groups: dict[str, list[str]] = {}
    for original_name in new_type_names:
        canonical = name_mapping.get(original_name, original_name)
        filenames = [d.filename for d in type_to_docs[original_name]]
        homologated_groups.setdefault(canonical, []).extend(filenames)

    new_groups = [
        TypeGroup(
            type_name=canonical,
            filenames=filenames,
            is_new=True,
        )
        for canonical, filenames in homologated_groups.items()
    ]

    all_groups = existing_groups + new_groups

    logger.info(
        f"Grouping complete: {len(existing_groups)} existing, "
        f"{len(new_groups)} new ({len(classifications)} docs total)"
    )

    return {
        "type_groups": all_groups,
        "current_step": "homologated",
        "progress_pct": 25,
    }
