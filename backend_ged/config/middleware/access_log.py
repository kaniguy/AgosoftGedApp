import logging
import sys

logger = logging.getLogger("ged.access")

_IS_RUNSERVER = "runserver" in sys.argv


class AccessLogMiddleware:
    """Journalise chaque requête HTTP au format runserver (gunicorn / Docker)."""

    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        response = self.get_response(request)

        if _IS_RUNSERVER:
            return response

        protocol = request.META.get("SERVER_PROTOCOL", "HTTP/1.1")
        size = self._response_size(response)
        message = (
            f'"{request.method} {request.get_full_path()} {protocol}" '
            f"{response.status_code} {size}"
        )
        logger.info(message)
        return response

    @staticmethod
    def _response_size(response):
        if getattr(response, "streaming", False):
            return 0
        try:
            return len(response.content)
        except Exception:
            return 0
