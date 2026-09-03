import hashlib
import uuid
from pathlib import Path
from typing import Union

def generate_id(prefix: str = "") -> str:
    """Generate a unique hex ID with optional prefix."""
    random_hex = uuid.uuid4().hex[:8]
    return f"{prefix}_{random_hex}" if prefix else random_hex

def compute_sha256(content: Union[str, bytes]) -> str:
    """Compute SHA-256 hash of string or bytes."""
    if isinstance(content, str):
        content = content.encode("utf-8")
    return hashlib.sha256(content).hexdigest()

def sanitize_filename(filename: str) -> str:
    """Sanitize filename to prevent directory traversal."""
    path = Path(filename)
    # Get only the name without directory parts
    clean_name = path.name
    # Replace dangerous characters
    clean_name = "".join(c for c in clean_name if c.isalnum() or c in "._- ")
    return clean_name or "file.bin"
