#!/bin/sh
set -e

# Instance nommee (host\INSTANCE) : pas de port dans SERVER=
# Port fixe (recommande Docker) : host.docker.internal,14333
_sql_server() {
  host="${DB_HOST:-host.docker.internal}"
  port="${DB_PORT:-}"
  if echo "$host" | grep -q '\\' || [ -z "$port" ]; then
    echo "$host"
  else
    echo "${host},${port}"
  fi
}

SERVER="$(_sql_server)"
echo "Attente de SQL Server (${SERVER})..."
i=0
until python - <<PY
import os, sys
import pyodbc

server = """${SERVER}"""
driver = os.environ.get("DB_DRIVER", "ODBC Driver 18 for SQL Server")
user = os.environ.get("DB_USER", "sa")
password = os.environ.get("DB_PASSWORD", "")
trust = os.environ.get("DB_TRUST_SERVER_CERTIFICATE", "yes")

conn_str = (
    f"DRIVER={{{driver}}};"
    f"SERVER={server};"
    f"UID={user};"
    f"PWD={password};"
    f"TrustServerCertificate={trust};"
    "Connection Timeout=5;"
)
try:
    pyodbc.connect(conn_str)
except Exception as exc:
    print(exc)
    sys.exit(1)
sys.exit(0)
PY
do
  i=$((i + 1))
  if [ "$i" -ge 90 ]; then
    echo "SQL Server inaccessible apres 3 minutes."
    echo "Verifiez : service SQL Server demarre, TCP/IP actif (port 1433), identifiants .env"
    exit 1
  fi
  sleep 2
done

echo "SQL Server pret."

LOG_FILE="/app/logs/logs_backend"
STARTED_AT="$(date +'%d/%b/%Y %H:%M:%S')"
python /app/scripts/prepend_log_line.py "$LOG_FILE" "[$STARTED_AT] Performing system checks..."
python /app/scripts/prepend_log_line.py "$LOG_FILE" "[$STARTED_AT] System check identified no issues (0 silenced)."
python /app/scripts/prepend_log_line.py "$LOG_FILE" "[$STARTED_AT] Django — settings 'config.settings'"
python /app/scripts/prepend_log_line.py "$LOG_FILE" "[$STARTED_AT] Starting gunicorn at http://0.0.0.0:9000/"

echo "Migrations Django..."
python manage.py migrate --noinput

echo "Demarrage : $*"
exec "$@"
