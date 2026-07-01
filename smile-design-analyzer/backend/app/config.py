"""
config.py
=========

Configuracao e carregamento de recursos estaticos (banco de pontos).
"""
from __future__ import annotations

import json
import os
from functools import lru_cache
from pathlib import Path
from typing import Dict

DATA_DIR = Path(__file__).parent / "data"
LANDMARKS_FILE = DATA_DIR / "landmarks.json"

# Origens permitidas para CORS (front local por padrao).
ALLOWED_ORIGINS = os.environ.get(
    "ALLOWED_ORIGINS", "http://localhost:3000,http://127.0.0.1:3000"
).split(",")


@lru_cache(maxsize=1)
def load_landmarks() -> dict:
    """Carrega o banco de pontos (landmarks.json)."""
    with open(LANDMARKS_FILE, "r", encoding="utf-8") as f:
        return json.load(f)


@lru_cache(maxsize=1)
def landmark_index() -> Dict[str, dict]:
    """Indexa os landmarks por id para acesso rapido (cor, numero, etc.)."""
    data = load_landmarks()
    return {lm["id"]: lm for lm in data.get("landmarks", [])}
