#!/bin/sh
set -e

echo "Attente de SQL Server (${DB_HOST}:${DB_PORT:-1433})..."
i=0
until python - <<'PY'
import os, sys
import pyodbc

host = os.environ.get("DB_HOST", "db")
port = os.environ.get("DB_PORT") or "1433"
driver = os.environ.get("DB_DRIVER", "ODBC Driver 18 for SQL Server")
user = os.environ.get("DB_USER", "sa")
password = os.environ.get("DB_PASSWORD", "")
trust = os.environ.get("DB_TRUST_SERVER_CERTIFICATE", "yes")

conn_str = (
    f"DRIVER={{{driver}}};"
    f"SERVER={host},{port};"
    f"UID={user};"
    f"PWD={password};"
    f"TrustServerCertificate={trust};"
    "Connection Timeout=3;"
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
  if [ "$i" -ge 60 ]; then
    echo "SQL Server inaccessible apres 2 minutes."
    exit 1
  fi
  sleep 2
done

echo "SQL Server pret."

python - <<'PY'
import os
import pyodbc

host = os.environ["DB_HOST"]
port = os.environ.get("DB_PORT") or "1433"
driver = os.environ["DB_DRIVER"]
user = os.environ["DB_USER"]
password = os.environ["DB_PASSWORD"]
db_name = os.environ["DB_NAME"]
trust = os.environ.get("DB_TRUST_SERVER_CERTIFICATE", "yes")

safe = "".join(c for c in db_name if c.isalnum() or c in ("_",))
if safe != db_name:
    raise SystemExit(f"DB_NAME invalide: {db_name!r}")

conn = pyodbc.connect(
    f"DRIVER={{{driver}}};SERVER={host},{port};UID={user};PWD={password};"
    f"TrustServerCertificate={trust};",
    autocommit=True,
)
cur = conn.cursor()
cur.execute(f"IF DB_ID(N'{safe}') IS NULL CREATE DATABASE [{safe}]")
conn.close()
print(f"Base '{safe}' disponible.")
PY

echo "Migrations Django..."
python manage.py migrate --noinput

echo "Demarrage : $*"
exec "$@"
