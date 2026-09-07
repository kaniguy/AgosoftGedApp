"""Journalise automatiquement les écritures API authentifiées."""

from gestion_acces.services.audit_service import interpreter_requete_api, log_activite

WRITE_METHODS = {"POST", "PUT", "PATCH", "DELETE"}

EXCLUDED_PREFIXES = (
    "/api/auth/login",
    "/api/auth/logout",
    "/admin/",
    "/static/",
    "/media/",
)


def _is_excluded_path(path):
    for prefix in EXCLUDED_PREFIXES:
        if path.startswith(prefix):
            return True
    # Journal : ignorer la consultation, garder l'export Excel
    if path.startswith("/api/gestion-acces/journal-activite"):
        return "/export-excel" not in path
    return False


def _resolve_api_user(request):
    """
    DRF authentifie dans la vue : request.user Django peut rester anonyme.
    On résout le token Authorization si besoin.
    """
    user = getattr(request, "user", None)
    if user is not None and getattr(user, "is_authenticated", False):
        return user

    auth = request.META.get("HTTP_AUTHORIZATION") or ""
    if not auth.startswith("Token "):
        return None
    key = auth[6:].strip()
    if not key:
        return None
    try:
        from rest_framework.authtoken.models import Token

        token = Token.objects.select_related("user").filter(key=key).first()
        if token and token.user_id and token.user.is_active:
            return token.user
    except Exception:
        return None
    return None


class AuditLogMiddleware:
    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        response = self.get_response(request)

        try:
            self._maybe_log(request, response)
        except Exception:
            pass

        return response

    def _maybe_log(self, request, response):
        if getattr(request, "_ged_audit_logged", False):
            return

        method = (request.method or "").upper()
        if method not in WRITE_METHODS:
            return

        path = request.path or ""
        if not path.startswith("/api/"):
            return

        if _is_excluded_path(path):
            return

        user = _resolve_api_user(request)
        if user is None:
            return

        status_code = getattr(response, "status_code", 0) or 0
        if status_code >= 500:
            return

        interpreted = interpreter_requete_api(method, path, status_code)
        if not interpreted:
            return

        log_activite(
            action=interpreted["action"],
            description=interpreted["description"],
            user=user,
            categorie=interpreted["categorie"],
            objet_type=interpreted.get("objet_type", ""),
            objet_id=interpreted.get("objet_id", ""),
            details={"status_code": status_code},
            request=request,
            chemin=path,
            methode_http=method,
        )
