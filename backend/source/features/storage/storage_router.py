import base64
import binascii
import mimetypes
import os
import re
from pathlib import Path

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from backend.source.features.auth.jwt_identity_extraction import get_current_user


storage_bp = APIRouter(prefix="/storage", tags=["Storage"])


class AvatarUpload(BaseModel):
    data_url: str


@storage_bp.post("/avatar")
def upload_avatar(payload: AvatarUpload, current_user=Depends(get_current_user)):
    match = re.fullmatch(r"data:(image/[a-zA-Z0-9.+-]+);base64,(.+)", payload.data_url)
    if not match:
        raise HTTPException(status_code=400, detail="Avatar deve ser uma imagem em base64")

    content_type, encoded = match.groups()
    try:
        content = base64.b64decode(encoded, validate=True)
    except (ValueError, binascii.Error) as exc:
        raise HTTPException(status_code=400, detail="Avatar inválido") from exc

    if len(content) > 5 * 1024 * 1024:
        raise HTTPException(status_code=413, detail="Avatar excede o limite de 5 MB")

    extension = mimetypes.guess_extension(content_type) or ".bin"
    root = Path(os.getenv("LOCAL_STORAGE_PATH", "./data/uploads")) / "avatars"
    root.mkdir(parents=True, exist_ok=True)
    file_path = root / f"{current_user}{extension}"
    file_path.write_bytes(content)

    return {"public_url": f"/uploads/avatars/{current_user}{extension}"}
