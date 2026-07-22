from django.conf import settings
from django.http import HttpResponseRedirect
from rest_framework import mixins, status, viewsets
from rest_framework.decorators import action, api_view, permission_classes, renderer_classes
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.renderers import JSONRenderer
from rest_framework.response import Response

from gestion_acces.models.lien_telechargement import LienTelechargement
from gestion_acces.serializers.lien_telechargement_serializer import (
    LienTelechargementCreateSerializer,
    LienTelechargementSerializer,
)
from gestion_acces.services.lien_telechargement_service import (
    build_download_response,
    get_downloadable_documents,
    get_link_document_availability,
)

def _frontend_page_url(token):
    base = getattr(settings, "FRONTEND_URL", "http://localhost:3000").rstrip("/")
    return f"{base}/telechargement/{token}"


def _link_public_status(link):
    if not link.is_active:
        return {
            "can_download": False,
            "status": "disabled",
            "message": "Ce lien de téléchargement a été désactivé.",
        }
    if link.is_expired():
        return {
            "can_download": False,
            "status": "expired",
            "message": "Ce lien de téléchargement a expiré.",
        }
    avail = get_link_document_availability(link.document_ids)
    if avail["downloadable"] == 0:
        return {
            "can_download": False,
            "status": "unavailable",
            "message": "Les documents associés à ce lien ne sont plus disponibles.",
        }
    if avail["downloadable"] < avail["total"]:
        return {
            "can_download": True,
            "status": "partial",
            "message": "Lien valide. Seuls les documents encore disponibles seront téléchargés.",
            "document_count": avail["downloadable"],
            "document_count_total": avail["total"],
            "is_archive": avail["downloadable"] > 1,
            "expires_at": link.expires_at.isoformat(),
        }
    return {
        "can_download": True,
        "status": "active",
        "message": "Lien valide. Utilisez le bouton ci-dessous pour télécharger.",
        "document_count": avail["downloadable"],
        "is_archive": avail["downloadable"] > 1,
        "expires_at": link.expires_at.isoformat(),
    }


def _get_link_or_none(token):
    try:
        return LienTelechargement.objects.get(token=token)
    except LienTelechargement.DoesNotExist:
        return None


@api_view(["GET"])
@permission_classes([AllowAny])
def telechargement_public_redirect_view(request, token):
    """Redirige vers la page publique frontend (évite l'interface API brute)."""
    return HttpResponseRedirect(_frontend_page_url(token))


@api_view(["GET"])
@permission_classes([AllowAny])
@renderer_classes([JSONRenderer])
def telechargement_info_view(request, token):
    """Métadonnées publiques du lien (sans téléchargement direct)."""
    link = _get_link_or_none(token)
    if not link:
        return Response(
            {
                "can_download": False,
                "status": "not_found",
                "message": "Ce lien de téléchargement est invalide ou introuvable.",
            },
            status=status.HTTP_404_NOT_FOUND,
        )

    payload = _link_public_status(link)
    http_status = status.HTTP_200_OK
    if payload["status"] in ("disabled", "expired"):
        http_status = status.HTTP_410_GONE
    elif payload["status"] == "unavailable":
        http_status = status.HTTP_404_NOT_FOUND

    return Response(payload, status=http_status)


@api_view(["GET"])
@permission_classes([AllowAny])
def telechargement_fichier_view(request, token):
    """Téléchargement du fichier ou de l'archive (sans authentification)."""
    link = _get_link_or_none(token)
    if not link:
        return Response({"detail": "Lien introuvable."}, status=status.HTTP_404_NOT_FOUND)

    if not link.is_active:
        return Response({"detail": "Lien désactivé."}, status=status.HTTP_410_GONE)

    if link.is_expired():
        return Response({"detail": "Lien expiré."}, status=status.HTTP_410_GONE)

    documents = get_downloadable_documents(link.document_ids)
    if not documents:
        return Response(
            {"detail": "Les documents ne sont plus disponibles."},
            status=status.HTTP_404_NOT_FOUND,
        )

    try:
        return build_download_response(documents)
    except ValueError as exc:
        return Response({"detail": str(exc)}, status=status.HTTP_400_BAD_REQUEST)
    except Exception:
        return Response(
            {"detail": "Impossible de préparer le téléchargement."},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR,
        )


def _can_add_links(user):
    return user.is_superuser or user.has_perm("gestion_acces.add_lientelechargement")


def _can_view_links(user):
    return user.is_superuser or user.has_perm("gestion_acces.view_lientelechargement")


def _can_change_links(user):
    return user.is_superuser or user.has_perm("gestion_acces.change_lientelechargement")


def _can_delete_links(user):
    return user.is_superuser or user.has_perm("gestion_acces.delete_lientelechargement")


class LienTelechargementViewSet(
    mixins.CreateModelMixin,
    mixins.ListModelMixin,
    mixins.RetrieveModelMixin,
    mixins.UpdateModelMixin,
    mixins.DestroyModelMixin,
    viewsets.GenericViewSet,
):
    """Création et gestion des liens de téléchargement temporaires."""

    queryset = LienTelechargement.objects.select_related("created_by").all()
    permission_classes = [IsAuthenticated]

    def get_serializer_class(self):
        if self.action == "create":
            return LienTelechargementCreateSerializer
        return LienTelechargementSerializer

    def list(self, request):
        if not _can_view_links(request.user):
            return Response({"detail": "Permission refusée."}, status=status.HTTP_403_FORBIDDEN)
        qs = self.get_queryset()
        serializer = LienTelechargementSerializer(qs, many=True, context={"request": request})
        return Response({"results": serializer.data})

    def retrieve(self, request, pk=None):
        if not _can_view_links(request.user):
            return Response({"detail": "Permission refusée."}, status=status.HTTP_403_FORBIDDEN)
        return super().retrieve(request, pk)

    def create(self, request):
        if not _can_add_links(request.user):
            return Response({"detail": "Permission refusée."}, status=status.HTTP_403_FORBIDDEN)
        serializer = LienTelechargementCreateSerializer(data=request.data, context={"request": request})
        serializer.is_valid(raise_exception=True)
        try:
            link = serializer.save()
        except Exception as exc:
            return Response(
                {"detail": str(exc) or "Impossible d'envoyer l'e-mail."},
                status=status.HTTP_502_BAD_GATEWAY,
            )
        out = LienTelechargementSerializer(link, context={"request": request})
        payload = dict(out.data)
        sent_to = getattr(link, "_email_sent_to", None)
        if sent_to:
            payload["email_sent_to"] = sent_to
            payload["email_queued"] = bool(getattr(link, "_email_queued", False))
        return Response(payload, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=["post"], url_path="envoyer-email")
    def envoyer_email(self, request, pk=None):
        if not _can_add_links(request.user):
            return Response({"detail": "Permission refusée."}, status=status.HTTP_403_FORBIDDEN)
        raw = (request.data.get("recipient_email") or request.data.get("email") or "").strip()
        if not raw:
            return Response(
                {"detail": "Adresse e-mail du destinataire requise."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        from gestion_acces.services.lien_telechargement_email_service import (
            parse_recipient_emails,
            queue_download_link_email,
        )

        try:
            recipients = parse_recipient_emails(raw)
        except ValueError as exc:
            return Response({"detail": str(exc)}, status=status.HTTP_400_BAD_REQUEST)

        link = self.get_object()
        queue_download_link_email(
            link.pk,
            recipients,
            sender_user_id=getattr(request.user, "pk", None),
        )
        sent_label = "; ".join(recipients)
        return Response(
            {
                "email_sent_to": sent_label,
                "email_queued": True,
                "detail": "Envoi de l'e-mail en cours.",
            }
        )

    def partial_update(self, request, pk=None):
        if not _can_change_links(request.user):
            return Response({"detail": "Permission refusée."}, status=status.HTTP_403_FORBIDDEN)
        link = self.get_object()
        if "is_active" not in request.data:
            return Response({"detail": "Champ is_active requis."}, status=status.HTTP_400_BAD_REQUEST)
        link.is_active = bool(request.data.get("is_active"))
        link.save(update_fields=["is_active"])
        serializer = LienTelechargementSerializer(link, context={"request": request})
        return Response(serializer.data)

    def destroy(self, request, pk=None):
        if not _can_delete_links(request.user):
            return Response({"detail": "Permission refusée."}, status=status.HTTP_403_FORBIDDEN)
        link = self.get_object()
        link.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)