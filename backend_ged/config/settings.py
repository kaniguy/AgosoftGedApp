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
if "*" in ALLOWED_HOSTS:
    raise ImproperlyConfigured(
        "ALLOWED_HOSTS ne doit jamais contenir '*'. Listez les hôtes explicitement."
    )

# Durée de vie des jetons API (heures). 0 = pas d'expiration (déconseillé).
TOKEN_TTL_HOURS = int(os.environ.get("TOKEN_TTL_HOURS", "12"))

# URL publique de l'application frontend (liens de téléchargement temporaires)
FRONTEND_URL = require_env("FRONTEND_URL")

# Proxy Next.js / reverse-proxy : Host et schéma du client.
USE_X_FORWARDED_HOST = True
SECURE_PROXY_SSL_HEADER = ("HTTP_X_FORWARDED_PROTO", "https")

# =================================================
# SÉCURITÉ
# =================================================
def _env_flag(key, default=False):
    raw = os.environ.get(key)
    if raw is None:
        return bool(default)
    return str(raw).strip().lower() in ("1", "true", "yes")


# Cookies Secure (CSRF + session) : True seulement en HTTPS.
# En HTTP (ex. http://IP:3001) le navigateur ignore ces cookies → login cassé.
_cookie_secure = _env_flag(
    "COOKIE_SECURE",
    default=FRONTEND_URL.lower().startswith("https://"),
)
SESSION_COOKIE_SECURE = _cookie_secure
CSRF_COOKIE_SECURE = _cookie_secure
SESSION_COOKIE_HTTPONLY = True
CSRF_COOKIE_HTTPONLY = True
SESSION_COOKIE_SAMESITE = "Lax"
CSRF_COOKIE_SAMESITE = "Lax"

SECURE_CONTENT_TYPE_NOSNIFF = True
SECURE_REFERRER_POLICY = "same-origin"
X_FRAME_OPTIONS = "DENY"
SECURE_SSL_REDIRECT = False if DEBUG else _env_flag("SECURE_SSL_REDIRECT", default=False)

if _cookie_secure and not DEBUG:
    SECURE_HSTS_SECONDS = int(os.environ.get("SECURE_HSTS_SECONDS", "31536000"))
    SECURE_HSTS_INCLUDE_SUBDOMAINS = True
    SECURE_HSTS_PRELOAD = True

_csrf = os.environ.get("CSRF_TRUSTED_ORIGINS", "") or FRONTEND_URL
CSRF_TRUSTED_ORIGINS = [o.strip() for o in _csrf.split(",") if o.strip()]


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

AUTHENTICATION_BACKENDS = [
    "gestion_acces.backends.GedModelBackend",
]

REST_FRAMEWORK = {
    "DEFAULT_AUTHENTICATION_CLASSES": [
        "config.authentication.ExpiringTokenAuthentication",
    ],
    # Toute vue sans permission explicite exige une authentification.
    # Les endpoints publics (login, liens téléchargement…) gardent AllowAny.
    "DEFAULT_PERMISSION_CLASSES": [
        "rest_framework.permissions.IsAuthenticated",
    ],
    # Limitation ciblée sur le login uniquement (voir LoginRateThrottle).
    # Pas de throttle global : une SPA GED génère beaucoup d'appels légitimes.
    "DEFAULT_THROTTLE_RATES": {
        "login": require_env("THROTTLE_RATE_LOGIN"),
        "download_link": os.environ.get("THROTTLE_RATE_DOWNLOAD_LINK", "30/hour"),
    },
}

# Limites d'upload (mitige DoS / épuisement mémoire)
DATA_UPLOAD_MAX_MEMORY_SIZE = int(require_env("DATA_UPLOAD_MAX_MEMORY_SIZE"))
FILE_UPLOAD_MAX_MEMORY_SIZE = int(require_env("FILE_UPLOAD_MAX_MEMORY_SIZE"))
DATA_UPLOAD_MAX_NUMBER_FIELDS = int(require_env("DATA_UPLOAD_MAX_NUMBER_FIELDS"))
MAX_IMAGE_UPLOAD_SIZE = int(require_env("MAX_IMAGE_UPLOAD_SIZE"))
MAX_DOCUMENT_UPLOAD_SIZE = int(require_env("MAX_DOCUMENT_UPLOAD_SIZE"))
MAX_VIDEO_UPLOAD_SIZE = int(
    os.environ.get("MAX_VIDEO_UPLOAD_SIZE", str(100 * 1024 * 1024))
)



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
# CORS CONFIG — jamais CORS_ALLOW_ALL_ORIGINS (liste blanche uniquement)
# =================================================
_cors_origins = [o.strip() for o in require_env("CORS_ALLOWED_ORIGINS").split(",") if o.strip()]
if not _cors_origins or "*" in _cors_origins:
    raise ImproperlyConfigured(
        "CORS_ALLOWED_ORIGINS doit lister des origines explicites (pas '*')."
    )

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
    {
        "NAME": "django.contrib.auth.password_validation.MinimumLengthValidator",
        "OPTIONS": {"min_length": 8},
    },
    {"NAME": "django.contrib.auth.password_validation.CommonPasswordValidator"},
    {"NAME": "django.contrib.auth.password_validation.NumericPasswordValidator"},
    {"NAME": "gestion_acces.password_policy.ComplexityPasswordValidator"},
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


# Fichiers logs_backend / logs_frontend : seulement si GED_FILE_LOGS=true dans le .env local
from config.prepend_log import file_logs_enabled

LOG_FILE = BASE_DIR / "logs" / "logs_backend"
_LOG_LEVEL = "INFO" if DEBUG else "WARNING"
_FILE_LOGS = file_logs_enabled()

_handlers = {
    "console": {
        "class": "logging.StreamHandler",
        "formatter": "verbose",
    },
    "console_access": {
        "class": "logging.StreamHandler",
        "formatter": "access",
    },
}
_app_handlers = ["console"]
_access_handlers = ["console_access"]

if _FILE_LOGS:
    if DEBUG:
        _file_handler = {
            "()": "config.prepend_log.PrependFileHandler",
            "filename": str(LOG_FILE),
            "formatter": "verbose",
            "encoding": "utf-8",
        }
        _file_access_handler = {
            "()": "config.prepend_log.PrependFileHandler",
            "filename": str(LOG_FILE),
            "formatter": "access",
            "encoding": "utf-8",
        }
    else:
        _file_handler = {
            "class": "logging.handlers.RotatingFileHandler",
            "filename": str(LOG_FILE),
            "formatter": "verbose",
            "encoding": "utf-8",
            "maxBytes": 5 * 1024 * 1024,
            "backupCount": 5,
        }
        _file_access_handler = {
            "class": "logging.handlers.RotatingFileHandler",
            "filename": str(LOG_FILE),
            "formatter": "access",
            "encoding": "utf-8",
            "maxBytes": 5 * 1024 * 1024,
            "backupCount": 5,
        }
    _handlers["file"] = _file_handler
    _handlers["file_access"] = _file_access_handler
    _app_handlers.append("file")
    _access_handlers.append("file_access")

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
    "handlers": _handlers,
    "root": {
        "handlers": _app_handlers,
        "level": _LOG_LEVEL,
    },
    "loggers": {
        "django": {
            "handlers": _app_handlers,
            "level": _LOG_LEVEL,
            "propagate": False,
        },
        "django.request": {
            "handlers": _app_handlers,
            "level": "WARNING",
            "propagate": False,
        },
        "django.server": {
            "handlers": _access_handlers,
            "level": "INFO",
            "propagate": False,
        },
        "ged.access": {
            "handlers": _access_handlers,
            "level": "INFO",
            "propagate": False,
        },
    },
}