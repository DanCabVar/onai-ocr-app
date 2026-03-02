"""Google Drive service for folder and file operations.

Reuses the OAuth tokens stored by the NestJS backend in the database.
"""

from __future__ import annotations

import logging
from io import BytesIO
from pathlib import Path

from google.oauth2.credentials import Credentials
from googleapiclient.discovery import build
from googleapiclient.http import MediaIoBaseUpload
from sqlalchemy import text

from app.config import settings
from app.services.db_service import get_session

logger = logging.getLogger(__name__)


async def _get_credentials() -> Credentials:
    """Load OAuth credentials from the google_tokens table (shared with NestJS)."""
    async with get_session() as session:
        result = await session.execute(
            text("SELECT access_token, refresh_token, expiry FROM google_tokens LIMIT 1")
        )
        row = result.mappings().first()
        if not row:
            raise RuntimeError(
                "No Google OAuth tokens found. Authenticate via the NestJS backend first."
            )

    return Credentials(
        token=row["access_token"],
        refresh_token=row["refresh_token"],
        token_uri="https://oauth2.googleapis.com/token",
        client_id=settings.google_client_id,
        client_secret=settings.google_client_secret,
    )


def _get_service(credentials: Credentials):
    return build("drive", "v3", credentials=credentials)


async def create_folder(name: str) -> dict:
    """Create a folder in Google Drive under the root folder."""
    creds = await _get_credentials()
    service = _get_service(creds)

    metadata = {
        "name": name,
        "mimeType": "application/vnd.google-apps.folder",
    }
    if settings.google_drive_root_folder_id:
        metadata["parents"] = [settings.google_drive_root_folder_id]

    folder = service.files().create(body=metadata, fields="id,name,webViewLink").execute()
    logger.info(f"Created Drive folder: {folder['name']} ({folder['id']})")
    return folder


async def upload_file(
    file_path: str, filename: str, mime_type: str, folder_id: str
) -> dict:
    """Upload a file to a specific Google Drive folder."""
    creds = await _get_credentials()
    service = _get_service(creds)

    file_bytes = Path(file_path).read_bytes()
    media = MediaIoBaseUpload(BytesIO(file_bytes), mimetype=mime_type, resumable=True)

    metadata = {"name": filename, "parents": [folder_id]}
    result = (
        service.files()
        .create(body=metadata, media_body=media, fields="id,name,webViewLink")
        .execute()
    )
    logger.info(f"Uploaded to Drive: {result['name']} ({result['id']})")
    return result


async def get_public_url(file_id: str) -> str:
    """Make a file publicly readable and return its URL."""
    creds = await _get_credentials()
    service = _get_service(creds)

    # Set public permission
    service.permissions().create(
        fileId=file_id,
        body={"type": "anyone", "role": "reader"},
    ).execute()

    file = service.files().get(fileId=file_id, fields="webViewLink,webContentLink").execute()
    return file.get("webViewLink", f"https://drive.google.com/file/d/{file_id}/view")
