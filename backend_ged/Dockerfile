FROM python:3.11-slim-bookworm

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1 \
    ACCEPT_EULA=Y

WORKDIR /app

# Deps systeme + pilote ODBC SQL Server 18 (methode officielle Microsoft)
RUN apt-get update && apt-get install -y --no-install-recommends \
    curl \
    gnupg2 \
    apt-transport-https \
    ca-certificates \
    unixodbc \
    unixodbc-dev \
    libzbar0 \
    libgl1 \
    libglib2.0-0 \
    libgomp1 \
    libgfortran5 \
    build-essential \
    && curl -sSL -O https://packages.microsoft.com/config/debian/12/packages-microsoft-prod.deb \
    && dpkg -i packages-microsoft-prod.deb \
    && rm -f packages-microsoft-prod.deb \
    && apt-get update \
    && mkdir -p /opt/microsoft/msodbcsql18 \
    && echo "Y" > /opt/microsoft/msodbcsql18/ACCEPT_EULA \
    && ACCEPT_EULA=Y apt-get install -y --no-install-recommends msodbcsql18 \
    && apt-get clean \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --upgrade pip \
    && pip install -r requirements.txt \
    && pip install gunicorn

COPY . .

# Corrige les fins de ligne Windows (CRLF) qui provoquent :
# "exec /app/scripts/docker-entrypoint.sh: no such file or directory"
RUN sed -i 's/\r$//' /app/scripts/docker-entrypoint.sh /app/scripts/start-gunicorn.sh \
    && chmod +x /app/scripts/docker-entrypoint.sh /app/scripts/start-gunicorn.sh \
    && mkdir -p /app/media /app/logs

# Note : USER non-root volontairement omis sous Docker Desktop Windows
# (volumes media/logs montés). Sur Linux VPS : ajouter user appuser + chown.

EXPOSE 9000

ENTRYPOINT ["/app/scripts/docker-entrypoint.sh"]
CMD ["/app/scripts/start-gunicorn.sh"]
