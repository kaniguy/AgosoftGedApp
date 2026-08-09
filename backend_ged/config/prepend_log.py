"""Écriture des logs en tête de fichier (plus récent en haut)."""

from __future__ import annotations

import logging
import threading
from pathlib import Path

_lock = threading.Lock()


def prepend_to_file(path: Path | str, message: str) -> None:
    target = Path(path)
    line = message if message.endswith("\n") else f"{message}\n"
    with _lock:
        target.parent.mkdir(parents=True, exist_ok=True)
        existing = (
            target.read_text(encoding="utf-8", errors="replace")
            if target.exists()
            else ""
        )
        target.write_text(line + existing, encoding="utf-8")


class PrependFileHandler(logging.Handler):
    """Handler fichier : chaque ligne est ajoutée en haut du fichier."""

    def __init__(self, filename, encoding: str = "utf-8"):
        super().__init__()
        self.filename = Path(filename)
        self.encoding = encoding

    def emit(self, record: logging.LogRecord) -> None:
        try:
            prepend_to_file(self.filename, self.format(record).rstrip("\n"))
        except Exception:
            self.handleError(record)
