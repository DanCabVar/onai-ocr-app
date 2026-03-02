"""Database service for PostgreSQL operations.

Uses SQLAlchemy async to interact with the same DB as the NestJS backend.
All write operations use transactions for atomicity.
"""

from __future__ import annotations

import logging
from contextlib import asynccontextmanager

from sqlalchemy import Column, DateTime, Integer, Numeric, String, Text, func, text
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine
from sqlalchemy.orm import DeclarativeBase, sessionmaker

from app.config import settings
from app.models.schemas import ConsolidatedField

logger = logging.getLogger(__name__)

engine = create_async_engine(settings.database_url, echo=False, pool_size=5)
async_session = sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)


class Base(DeclarativeBase):
    pass


class DocumentTypeRow(Base):
    __tablename__ = "document_types"

    id = Column(Integer, primary_key=True, autoincrement=True)
    user_id = Column("user_id", Integer, nullable=False)
    name = Column(String, nullable=False)
    description = Column(Text, nullable=True)
    field_schema = Column("field_schema", JSONB, nullable=False)
    folder_path = Column("folder_path", String, nullable=True)
    google_drive_folder_id = Column("google_drive_folder_id", String, nullable=True)
    created_at = Column("created_at", DateTime, server_default=func.now())
    updated_at = Column("updated_at", DateTime, server_default=func.now(), onupdate=func.now())


class DocumentRow(Base):
    __tablename__ = "documents"

    id = Column(Integer, primary_key=True, autoincrement=True)
    user_id = Column("user_id", Integer, nullable=False)
    document_type_id = Column("document_type_id", Integer, nullable=True)
    filename = Column(String, nullable=False)
    google_drive_link = Column("google_drive_link", Text, nullable=True)
    google_drive_file_id = Column("google_drive_file_id", String, nullable=True)
    extracted_data = Column("extracted_data", JSONB, nullable=True)
    inferred_data = Column("inferred_data", JSONB, nullable=True)
    ocr_raw_text = Column("ocr_raw_text", Text, nullable=True)
    confidence_score = Column("confidence_score", Numeric(5, 2), nullable=True)
    status = Column(String, default="processing")
    created_at = Column("created_at", DateTime, server_default=func.now())
    updated_at = Column("updated_at", DateTime, server_default=func.now(), onupdate=func.now())


@asynccontextmanager
async def get_session():
    async with async_session() as session:
        try:
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise


async def get_existing_document_types() -> list[dict]:
    """Fetch all document types from the database."""
    async with get_session() as session:
        result = await session.execute(text("SELECT * FROM document_types ORDER BY id"))
        rows = result.mappings().all()
        return [dict(r) for r in rows]


async def find_document_type_by_name(name: str) -> dict | None:
    """Find a document type by exact name (case-insensitive)."""
    async with get_session() as session:
        result = await session.execute(
            text("SELECT * FROM document_types WHERE LOWER(TRIM(name)) = LOWER(TRIM(:name))"),
            {"name": name},
        )
        row = result.mappings().first()
        return dict(row) if row else None


async def create_document_type(
    user_id: int,
    name: str,
    description: str,
    fields: list[ConsolidatedField],
    google_drive_folder_id: str,
    folder_path: str,
) -> dict:
    """Create a new document type in the database within a transaction."""
    field_schema = {
        "fields": [
            {
                "name": f.name,
                "type": f.type,
                "label": f.label,
                "required": f.required,
                "description": f.description,
            }
            for f in fields
        ]
    }

    async with get_session() as session:
        result = await session.execute(
            text("""
                INSERT INTO document_types (user_id, name, description, field_schema,
                                            google_drive_folder_id, folder_path)
                VALUES (:user_id, :name, :description, :field_schema::jsonb,
                        :drive_id, :folder_path)
                RETURNING id, name, description, field_schema, google_drive_folder_id, folder_path
            """),
            {
                "user_id": user_id,
                "name": name,
                "description": description,
                "field_schema": __import__("json").dumps(field_schema),
                "drive_id": google_drive_folder_id,
                "folder_path": folder_path,
            },
        )
        row = result.mappings().first()
        return dict(row)


async def create_document(
    user_id: int,
    document_type_id: int,
    filename: str,
    google_drive_link: str,
    google_drive_file_id: str,
    extracted_data: dict | None,
    confidence_score: float = 0.95,
) -> dict:
    """Create a document record in the database within a transaction."""
    import json

    async with get_session() as session:
        result = await session.execute(
            text("""
                INSERT INTO documents (user_id, document_type_id, filename,
                                       google_drive_link, google_drive_file_id,
                                       extracted_data, confidence_score, status)
                VALUES (:user_id, :doc_type_id, :filename,
                        :drive_link, :drive_file_id,
                        :extracted_data::jsonb, :confidence, 'completed')
                RETURNING id, filename, document_type_id, google_drive_file_id
            """),
            {
                "user_id": user_id,
                "doc_type_id": document_type_id,
                "filename": filename,
                "drive_link": google_drive_link,
                "drive_file_id": google_drive_file_id,
                "extracted_data": json.dumps(extracted_data) if extracted_data else None,
                "confidence": confidence_score,
            },
        )
        row = result.mappings().first()
        return dict(row)
