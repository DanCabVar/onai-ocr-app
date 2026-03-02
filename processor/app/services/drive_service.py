"""Google Drive service for folder and file operations.

Reuses the OAuth tokens stored by the NestJS backend in the google_tokens table.
The NestJS backend handles OAuth flow; this service only reads existing tokens.
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
    """Load OAuth credentials from the google_tokens table (shared with NestJS).

    The google_tokens table schema (from NestJS GoogleToken entity):
      id, access_token, refresh_token, expires_at (bigint ms), scope, token_type,
      created_at, updated_at
    """
    async with get_session() as session:
        result = await session.execute(
            text(
                "SELECT access_token, refresh_token, expires_at, scope, token_type "
                "FROM google_tokens ORDER BY id DESC LIMIT 1"
            )
        )
        row = result.mappings().first()
        if not row:
            raise RuntimeError(
                "No Google OAuth tokens found in DB. "
                "Authenticate via the NestJS backend first (GET /api/google/auth)."
            )

    logger.debug(f"Loaded Google token (expires_at: {row['expires_at']})")

    return Credentials(
        token=row["access_token"],
        refresh_token=row["refresh_token"],
        token_uri="https://oauth2.googleapis.com/token",
        client_id=settings.google_client_id,
        client_secret=settings.google_client_secret,
    )


def _get_service(credentials: Credentials):
    return build("drive", "v3", credentials=credentials, cache_discovery=False)


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

    service.permissions().create(
        fileId=file_id,
        body={"type": "anyone", "role": "reader"},
    ).execute()

    file = service.files().get(fileId=file_id, fields="webViewLink,webContentLink").execute()
    return file.get("webViewLink", f"https://drive.google.com/file/d/{file_id}/view")
