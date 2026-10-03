from io import BytesIO
from pathlib import Path
from PIL import Image, ImageOps, UnidentifiedImageError
from fastapi import HTTPException
from .models import uid

MAX_UPLOAD = 8 * 1024 * 1024
Image.MAX_IMAGE_PIXELS = 24_000_000


def clean_image(content: bytes):
    if not content or len(content) > MAX_UPLOAD:
        raise HTTPException(422, "Photos must be no larger than 8 MB")
    try:
        with Image.open(BytesIO(content)) as original:
            if original.format not in ("JPEG", "PNG", "WEBP"):
                raise HTTPException(422, "Choose a JPEG, PNG, or WebP photo")
            if original.width * original.height > 24_000_000:
                raise HTTPException(422, "Photo exceeds 24 megapixels")
            image = ImageOps.exif_transpose(original).convert("RGB")
            image.thumbnail((1600, 1600))
            output = BytesIO()
            image.save(output, format="WEBP", quality=88)
            return output.getvalue(), image
    except (UnidentifiedImageError, OSError, ValueError, Image.DecompressionBombError, Image.DecompressionBombWarning):
        raise HTTPException(422, "This photo could not be read safely")


def save_image(content, folder: Path):
    cleaned, image = clean_image(content)
    folder.mkdir(parents=True, exist_ok=True)
    name = uid() + ".webp"
    (folder / name).write_bytes(cleaned)
    thumb = image.copy()
    thumb.thumbnail((480, 480))
    thumb.save(folder / ("thumb-" + name), format="WEBP", quality=82)
    return name

