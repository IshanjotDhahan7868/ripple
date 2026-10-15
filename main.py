"""Vercel / uvicorn entry point. Loads a local .env (if present) before the app reads configuration."""

import os
from pathlib import Path

_env = Path(__file__).with_name(".env")
if _env.exists():
    for line in _env.read_text().splitlines():
        key, sep, value = line.partition("=")
        if sep and key.strip() and not key.lstrip().startswith("#"):
            os.environ.setdefault(key.strip(), value.strip().strip('"').strip("'"))

from ripple.app import app  # noqa: E402,F401
