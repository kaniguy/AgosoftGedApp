"""Service des fichiers média protégés (prod : pas de static() Django)."""

from pathlib import Path

from django.conf import settings
from django.http import FileResponse, Http404
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework import status

# Préfixes accessibles sans auth (logo entreprise sur page login)
_PUBLIC_MEDIA_PREFIXES = ("entreprise/",)


@api_view(["GET", "HEAD"])
@permission_classes([AllowAny])
def serve_protected_media(request, path: str):
    """Sert un fichier sous MEDIA_ROOT. Auth requise sauf préfixes publics."""
    is_public = any(path.startswith(prefix) for prefix in _PUBLIC_MEDIA_PREFIXES)
    if not is_public and not request.user.is_authenticated:
        return Response(
            {"detail": "Authentification requise."},
            status=status.HTTP_401_UNAUTHORIZED,
        )

    media_root = Path(settings.MEDIA_ROOT).resolve()
    target = (media_root / path).resolve()

    if not str(target).startswith(str(media_root)):
        raise Http404()
    if not target.is_file():
        raise Http404()

    response = FileResponse(target.open("rb"), as_attachment=False)
    response["X-Content-Type-Options"] = "nosniff"
    return response
