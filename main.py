"""Vercel / uvicorn entry point. Loads a local .env (if present) before the app reads configuration."""

from ripple.env import load_env

load_env()

from ripple.app import app  # noqa: E402,F401
