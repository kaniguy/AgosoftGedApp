#!/bin/sh
set -e

# Workers / OCR : "auto" = adapté au CPU et à la RAM du PC ou du serveur
eval "$(python /app/scripts/detect_capacity.py)"

WORKERS="${GUNICORN_WORKERS:-4}"
THREADS="${GUNICORN_THREADS:-4}"
TIMEOUT="${GUNICORN_TIMEOUT:-180}"

export OCR_WORKER_URL="${OCR_WORKER_URL:-http://127.0.0.1:9100}"
export OCR_WORKER_THREADS="${OCR_WORKER_THREADS:-2}"
export OCR_MAX_PARALLEL="${OCR_MAX_PARALLEL:-3}"
export OCR_WORKER_TIMEOUT="${OCR_WORKER_TIMEOUT:-180}"
export OCR_QUEUE_TIMEOUT="${OCR_QUEUE_TIMEOUT:-170}"
export GED_SKIP_OCR_WARMUP=1

echo "Capacité : ${WORKERS} workers × ${THREADS} threads, ${OCR_MAX_PARALLEL} OCR parallèle(s)"
echo "Démarrage OCR dédié (${OCR_WORKER_URL})…"
OCR_IN_WORKER=1 python -u -m gestion_documentaire.ocr_worker &
OCR_PID=$!
renice +10 "$OCR_PID" >/dev/null 2>&1 || true
echo "OCR worker PID ${OCR_PID} (priorité CPU basse)"

echo "Gunicorn : ${WORKERS} workers × ${THREADS} threads (timeout ${TIMEOUT}s)"

exec gunicorn config.wsgi:application \
  --bind 0.0.0.0:9000 \
  --worker-class gthread \
  --workers "${WORKERS}" \
  --threads "${THREADS}" \
  --timeout "${TIMEOUT}" \
  --keep-alive 5 \
  --max-requests 500 \
  --max-requests-jitter 50 \
  --graceful-timeout 30
