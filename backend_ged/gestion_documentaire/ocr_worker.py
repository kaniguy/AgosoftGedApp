"""Processus OCR dédié — isole PaddleOCR hors des workers HTTP Gunicorn.

Plusieurs inférences en parallèle (processus séparés, Paddle n'est pas thread-safe),
file d'attente pour les utilisateurs surnuméraires, priorité CPU basse.
"""

from __future__ import annotations

import io
import json
import logging
import multiprocessing
import os
import sys
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

# Limite le CPU de Paddle/OpenBLAS AVANT tout import numpy/paddle.
_threads = os.environ.get("OCR_WORKER_THREADS", "2")
os.environ.setdefault("OMP_NUM_THREADS", _threads)
os.environ.setdefault("MKL_NUM_THREADS", _threads)
os.environ.setdefault("OPENBLAS_NUM_THREADS", _threads)
os.environ.setdefault("NUMEXPR_NUM_THREADS", _threads)
os.environ.setdefault("FLAGS_use_mkldnn", "0")
os.environ["OCR_IN_WORKER"] = "1"

from gestion_documentaire.services.ocr_service import (  # noqa: E402
    _ensure_image_deps,
    _get_ocr_engine,
    _ocr_lines_local,
    get_ocr_unavailable_reason,
)

logger = logging.getLogger("ocr_worker")

_pool = None
_pool_size = 1
_pool_ready = False
_JOB_TIMEOUT = int(os.environ.get("OCR_QUEUE_TIMEOUT", "170"))


def _init_pool_worker():
    """Process enfant : PaddleOCR n'est chargé qu'au premier scan (pas au démarrage)."""
    logging.basicConfig(
        level=logging.INFO,
        format="[ocr-worker] %(asctime)s %(levelname)s %(message)s",
        stream=sys.stdout,
    )
    os.environ["OCR_IN_WORKER"] = "1"


def _pool_predict(png_bytes: bytes) -> list:
    _fitz, np, Image = _ensure_image_deps()
    with Image.open(io.BytesIO(png_bytes)) as image:
        rgb = image.convert("RGB")
        image_np = np.array(rgb)
    return _ocr_lines_local(image_np)


def _warmup(_arg=None):
    engine = _get_ocr_engine()
    return engine is not None


def _json_bytes(payload: dict, status: int = 200) -> tuple[int, bytes]:
    body = json.dumps(payload, ensure_ascii=False, default=str).encode("utf-8")
    return status, body


class OcrHandler(BaseHTTPRequestHandler):
    protocol_version = "HTTP/1.1"

    def log_message(self, format, *args):  # noqa: A003
        logger.info("%s - %s", self.address_string(), format % args)

    def _send(self, status: int, body: bytes, content_type: str = "application/json"):
        self.send_response(status)
        self.send_header("Content-Type", content_type)
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Connection", "close")
        self.end_headers()
        self.wfile.write(body)

    def do_GET(self):  # noqa: N802
        if self.path.rstrip("/") != "/health":
            self._send(*_json_bytes({"ok": False, "error": "not found"}, 404))
            return
        if not _pool_ready or _pool is None:
            self._send(
                *_json_bytes(
                    {"ok": False, "error": "OCR en cours de démarrage"},
                    503,
                )
            )
            return
        self._send(*_json_bytes({"ok": True, "parallel": _pool_size}))

    def do_POST(self):  # noqa: N802
        if self.path.rstrip("/") != "/predict":
            self._send(*_json_bytes({"ok": False, "error": "not found"}, 404))
            return
        if not _pool_ready or _pool is None:
            self._send(
                *_json_bytes({"ok": False, "error": "OCR en cours de démarrage"}, 503)
            )
            return

        length = int(self.headers.get("Content-Length") or 0)
        if length <= 0 or length > 25 * 1024 * 1024:
            self._send(*_json_bytes({"ok": False, "error": "image invalide"}, 400))
            return

        png_bytes = self.rfile.read(length)
        try:
            lines = _pool.apply_async(_pool_predict, (png_bytes,)).get(
                timeout=_JOB_TIMEOUT
            )
            self._send(*_json_bytes({"ok": True, "lines": lines}))
        except (TimeoutError, multiprocessing.TimeoutError):
            self._send(
                *_json_bytes(
                    {
                        "ok": False,
                        "error": "OCR saturé, réessayez dans un instant.",
                    },
                    503,
                )
            )
        except Exception as exc:
            logger.exception("Échec OCR")
            self._send(*_json_bytes({"ok": False, "error": str(exc)}, 500))


def main():
    global _pool, _pool_size, _pool_ready

    logging.basicConfig(
        level=logging.INFO,
        format="[ocr-worker] %(asctime)s %(levelname)s %(message)s",
        stream=sys.stdout,
    )
    host = os.environ.get("OCR_WORKER_HOST", "127.0.0.1")
    port = int(os.environ.get("OCR_WORKER_PORT", "9100"))
    _pool_size = max(1, int(os.environ.get("OCR_MAX_PARALLEL", "3")))

    logger.info(
        "Pool OCR : %s processus (Paddle %s threads/process)…",
        _pool_size,
        _threads,
    )
    ctx = multiprocessing.get_context("spawn")
    _pool = ctx.Pool(
        processes=_pool_size,
        initializer=_init_pool_worker,
        maxtasksperchild=80,
    )
    _pool_ready = True
    logger.info("OCR en attente (Paddle chargé au premier scan, pas au démarrage)")

    server = ThreadingHTTPServer((host, port), OcrHandler)
    server.daemon_threads = True
    logger.info(
        "Écoute OCR sur http://%s:%s (%s analyses en parallèle, file d'attente ensuite)",
        host,
        port,
        _pool_size,
    )
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass
    finally:
        server.server_close()
        if _pool is not None:
            _pool.terminate()
            _pool.join()


if __name__ == "__main__":
    main()
