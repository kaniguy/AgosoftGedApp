#!/bin/sh
set -e

# Instance nommee (host\INSTANCE) : pas de port dans SERVER=
_sql_server() {
  host="${DB_HOST:-db}"
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
    echo "Verifiez : instance demarree, auth SQL (sa), TCP/IP, DESKTOP-VE18TAC\\AGOSOFTGED"
    exit 1
  fi
  sleep 2
done

echo "SQL Server pret."

python - <<PY
import os
import pyodbc

server = """${SERVER}"""
driver = os.environ["DB_DRIVER"]
user = os.environ["DB_USER"]
password = os.environ["DB_PASSWORD"]
db_name = os.environ["DB_NAME"]
trust = os.environ.get("DB_TRUST_SERVER_CERTIFICATE", "yes")

safe = "".join(c for c in db_name if c.isalnum() or c in ("_",))
if safe != db_name:
    raise SystemExit(f"DB_NAME invalide: {db_name!r}")

conn = pyodbc.connect(
    f"DRIVER={{{driver}}};SERVER={server};UID={user};PWD={password};"
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
