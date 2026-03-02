"""Pydantic models for API request/response and internal data."""

from __future__ import annotations

from pydantic import BaseModel, Field


class FieldWithValue(BaseModel):
    name: str
    type: str
    label: str
    required: bool = False
    description: str = ""
    value: object = None


class ConsolidatedField(BaseModel):
    name: str
    type: str
    label: str
    required: bool = False
    description: str = ""
    frequency: float = 1.0


class DocumentClassification(BaseModel):
    filename: str
    inferred_type: str
    summary: str = ""
    fields: list[FieldWithValue] = Field(default_factory=list)
    confidence: float = 0.0


class TypeGroup(BaseModel):
    type_name: str
    filenames: list[str]
    existing_type_id: int | None = None
    existing_drive_folder_id: str | None = None
    is_new: bool = True


class ConsolidatedSchema(BaseModel):
    type_name: str
    description: str = ""
    fields: list[ConsolidatedField] = Field(default_factory=list)


class CreatedTypeResult(BaseModel):
    id: int
    name: str
    description: str = ""
    field_count: int = 0
    sample_document_count: int = 0
    google_drive_folder_id: str = ""
    folder_path: str = ""
    fields: list[ConsolidatedField] = Field(default_factory=list)


class DocumentResult(BaseModel):
    filename: str
    document_id: int | None = None
    extracted_data: dict | None = None
    error: str | None = None


class BatchProcessRequest(BaseModel):
    user_id: int
    upload_samples: bool = False


class BatchProcessResponse(BaseModel):
    success: bool
    message: str
    created_types: list[CreatedTypeResult] = Field(default_factory=list)
    total_documents_processed: int = 0
    total_types_created: int = 0
    errors: list[str] = Field(default_factory=list)
