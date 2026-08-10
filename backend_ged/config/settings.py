from pathlib import Path
import os
from django.core.exceptions import ImproperlyConfigured

BASE_DIR = Path(__file__).resolve().parent.parent


def _load_env_manual(env_path):
    """Lecture simple du .env si python-dotenv n'est pas installé."""
    if not env_path.exists():
        return False
    for raw_line in env_path.read_text(encoding="utf-8-sig").splitlines():
        line = raw_line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, _, value = line.partition("=")
        key = key.strip()
        value = value.strip().strip('"').strip("'")
        value = value.replace("\\\\", "\\")
        if key and key not in os.environ:
            os.environ[key] = value
    return True


def _load_env():
    env_path = BASE_DIR / "config" / ".env"
    if not env_path.exists():
        return

    try:
        from dotenv import load_dotenv

        # override=False : les variables Docker / OS ont la priorité sur le fichier .env
        load_dotenv(dotenv_path=env_path, override=False)
        return
    except ImportError:
        _load_env_manual(env_path)


_load_env()


def require_env(key):
    """Lit une variable obligatoire depuis config/.env (aucune valeur par défaut dans le code)."""
    if key not in os.environ:
        raise ImproperlyConfigured(
            f"La variable d'environnement {key} est obligatoire. "
            f"Définissez-la dans config/.env."
        )
    return os.environ[key]


SECRET_KEY = require_env("SECRET_KEY")

# Clé AES-256 (32 octets en base64) pour chiffrer les documents au repos
DOCUMENT_ENCRYPTION_KEY = require_env("DOCUMENT_ENCRYPTION_KEY")

DEBUG = str(require_env("DEBUG")).lower() == "true"

ALLOWED_HOSTS = [h.strip() for h in require_env("ALLOWED_HOSTS").split(",") if h.strip()]

# Le proxy Next.js envoie X-Forwarded-Host (IP LAN :3000) pour que
# build_absolute_uri() ne génère pas http://127.0.0.1:9000/media/...
USE_X_FORWARDED_HOST = True
SECURE_PROXY_SSL_HEADER = ("HTTP_X_FORWARDED_PROTO", "https")


# =================================================
# APPLICATIONS
# =================================================
INSTALLED_APPS = [
    "corsheaders",  # doit être en haut pour CORS
    "rest_framework",
    "rest_framework.authtoken",  # 🔥 Ajout pour la gestion des Tokens
    "parametrage",
    "gestion_acces",  # 🔥 Gestion d'accès et profils
    "gestion_documentaire",

    "django.contrib.admin",
    "django.contrib.auth",
    "django.contrib.contenttypes",
    "django.contrib.sessions",
    "django.contrib.messages",
    "django.contrib.staticfiles",
]

REST_FRAMEWORK = {
    "DEFAULT_AUTHENTICATION_CLASSES": [
        "rest_framework.authentication.TokenAuthentication",
    ],
    # Limitation ciblée sur le login uniquement (voir LoginRateThrottle).
    # Pas de throttle global : une SPA GED génère beaucoup d'appels légitimes.
    "DEFAULT_THROTTLE_RATES": {
        "login": require_env("THROTTLE_RATE_LOGIN"),
    },
}

# Limites d'upload (mitige DoS / épuisement mémoire)
DATA_UPLOAD_MAX_MEMORY_SIZE = int(require_env("DATA_UPLOAD_MAX_MEMORY_SIZE"))
FILE_UPLOAD_MAX_MEMORY_SIZE = int(require_env("FILE_UPLOAD_MAX_MEMORY_SIZE"))
DATA_UPLOAD_MAX_NUMBER_FIELDS = int(require_env("DATA_UPLOAD_MAX_NUMBER_FIELDS"))
MAX_IMAGE_UPLOAD_SIZE = int(require_env("MAX_IMAGE_UPLOAD_SIZE"))
MAX_DOCUMENT_UPLOAD_SIZE = int(require_env("MAX_DOCUMENT_UPLOAD_SIZE"))



# =================================================
# MIDDLEWARE (ORDRE TRÈS IMPORTANT)
# =================================================
MIDDLEWARE = [
    "corsheaders.middleware.CorsMiddleware",  # MUST BE FIRST

    "django.middleware.security.SecurityMiddleware",
    "django.contrib.sessions.middleware.SessionMiddleware",
    "django.middleware.common.CommonMiddleware",

    "django.middleware.csrf.CsrfViewMiddleware",
    "django.contrib.auth.middleware.AuthenticationMiddleware",
    "django.contrib.messages.middleware.MessageMiddleware",
    "django.middleware.clickjacking.XFrameOptionsMiddleware",
    "gestion_acces.middleware.AuditLogMiddleware",
    "config.middleware.AccessLogMiddleware",
]


# =================================================
# CORS CONFIG
# =================================================

# DEBUG=True : toutes les origines. DEBUG=False : liste blanche depuis .env.
_cors_origins = [o.strip() for o in require_env("CORS_ALLOWED_ORIGINS").split(",") if o.strip()]

if DEBUG:
    CORS_ALLOW_ALL_ORIGINS = True
else:
    CORS_ALLOW_ALL_ORIGINS = False
    CORS_ALLOWED_ORIGINS = _cors_origins

# Autorise les requêtes cross-origin avec cookies/headers si besoin
CORS_ALLOW_HEADERS = [
    "accept",
    "accept-encoding",
    "authorization",
    "content-type",
    "dnt",
    "origin",
    "user-agent",
    "x-csrftoken",
    "x-requested-with",
]

# Nécessaire pour lire le nom de fichier (.rar / .zip) côté frontend (fetch)
CORS_EXPOSE_HEADERS = [
    "Content-Disposition",
    "Content-Type",
]

# URL publique de l'application frontend (liens de téléchargement temporaires)
FRONTEND_URL = require_env("FRONTEND_URL")

# =================================================
# E-MAIL (liens de téléchargement temporaires)
# =================================================
EMAIL_BACKEND = require_env("EMAIL_BACKEND")
EMAIL_HOST = require_env("EMAIL_HOST")
EMAIL_PORT = int(require_env("EMAIL_PORT"))
EMAIL_USE_TLS = str(require_env("EMAIL_USE_TLS")).lower() == "true"
EMAIL_USE_SSL = str(require_env("EMAIL_USE_SSL")).lower() == "true"
EMAIL_HOST_USER = require_env("EMAIL_HOST_USER")
EMAIL_HOST_PASSWORD = require_env("EMAIL_HOST_PASSWORD")
DEFAULT_FROM_EMAIL = require_env("DEFAULT_FROM_EMAIL")
# Note : la configuration SMTP active est gérée dans Gestion des accès
# (modèle ConfigurationEmail). Les variables ci-dessus servent de secours.


# =================================================
# URL ROOT
# =================================================
ROOT_URLCONF = "config.urls"


# =================================================
# TEMPLATES
# =================================================
TEMPLATES = [
    {
        "BACKEND": "django.template.backends.django.DjangoTemplates",
        "DIRS": [],
        "APP_DIRS": True,
        "OPTIONS": {
            "context_processors": [
                "django.template.context_processors.request",
                "django.contrib.auth.context_processors.auth",
                "django.contrib.messages.context_processors.messages",
            ],
        },
    },
]


WSGI_APPLICATION = "config.wsgi.application"


# =================================================
# DATABASE (SQL SERVER) — configuration depuis .env
# =================================================
_db_trusted = str(require_env("DB_TRUSTED_CONNECTION")).strip().lower() in (
    "yes",
    "true",
    "1",
)
_db_trust_cert = str(require_env("DB_TRUST_SERVER_CERTIFICATE")).strip().lower() in (
    "yes",
    "true",
    "1",
)
# Driver 18 : TrustServerCertificate via extra_params (certificat auto-signe)
_extra = []
if _db_trust_cert:
    _extra.append("TrustServerCertificate=yes")
_db_options = {
    "driver": require_env("DB_DRIVER"),
    "Trusted_Connection": "yes" if _db_trusted else "no",
    "connection_timeout": 10,
}
if _extra:
    _db_options["extra_params"] = ";".join(_extra)

_db_host = require_env("DB_HOST")
_db_port = require_env("DB_PORT").strip()

DATABASES = {
    "default": {
        "ENGINE": "mssql",
        "NAME": require_env("DB_NAME"),
        "HOST": _db_host,
        "OPTIONS": _db_options,
    }
}
# Instance nommee (DESKTOP\AGOSOFTGED) : laisser DB_PORT vide
if _db_port and "\\" not in _db_host:
    DATABASES["default"]["PORT"] = _db_port

# Auth SQL (Docker Linux → SQL Server Windows local)
if not _db_trusted:
    DATABASES["default"]["USER"] = require_env("DB_USER")
    DATABASES["default"]["PASSWORD"] = require_env("DB_PASSWORD")


# =================================================
# PASSWORD VALIDATION
# =================================================
AUTH_PASSWORD_VALIDATORS = [
    {"NAME": "django.contrib.auth.password_validation.UserAttributeSimilarityValidator"},
    {"NAME": "django.contrib.auth.password_validation.MinimumLengthValidator"},
    {"NAME": "django.contrib.auth.password_validation.CommonPasswordValidator"},
    {"NAME": "django.contrib.auth.password_validation.NumericPasswordValidator"},
]


# =================================================
# INTERNATIONALIZATION
# =================================================
LANGUAGE_CODE = "fr-fr"
TIME_ZONE = "Africa/Abidjan"
USE_I18N = True
USE_TZ = True


# =================================================
# STATIC FILES
# =================================================
STATIC_URL = "static/"


# =================================================
# DEFAULT AUTO FIELD
# =================================================
DEFAULT_AUTO_FIELD = "django.db.models.BigAutoField"

# =================================================
# MEDIA FILES
# =================================================
MEDIA_URL = "/media/"
MEDIA_ROOT = BASE_DIR / "media"


# =================================================
# LOGS (dossier backend_ged/logs/ — monté par Docker)
# =================================================
LOG_FILE = BASE_DIR / "logs" / "logs_backend"

LOGGING = {
    "version": 1,
    "disable_existing_loggers": False,
    "formatters": {
        "access": {
            "()": "django.utils.log.ServerFormatter",
            "format": "[{server_time}] {message}",
            "style": "{",
        },
        "verbose": {
            "format": "[{asctime}] [{levelname}] [{name}] {message}",
            "style": "{",
            "datefmt": "%Y-%m-%d %H:%M:%S",
        },
    },
    "handlers": {
        "console": {
            "class": "logging.StreamHandler",
            "formatter": "verbose",
        },
        "console_access": {
            "class": "logging.StreamHandler",
            "formatter": "access",
        },
        "file": {
            "()": "config.prepend_log.PrependFileHandler",
            "filename": LOG_FILE,
            "formatter": "verbose",
            "encoding": "utf-8",
        },
        "file_access": {
            "()": "config.prepend_log.PrependFileHandler",
            "filename": LOG_FILE,
            "formatter": "access",
            "encoding": "utf-8",
        },
    },
    "root": {
        "handlers": ["console", "file"],
        "level": "INFO",
    },
    "loggers": {
        "django": {
            "handlers": ["console", "file"],
            "level": "INFO",
            "propagate": False,
        },
        "django.request": {
            "handlers": ["console", "file"],
            "level": "WARNING",
            "propagate": False,
        },
        "django.server": {
            "handlers": ["console_access", "file_access"],
            "level": "INFO",
            "propagate": False,
        },
        "ged.access": {
            "handlers": ["console_access", "file_access"],
            "level": "INFO",
            "propagate": False,
        },
    },
}