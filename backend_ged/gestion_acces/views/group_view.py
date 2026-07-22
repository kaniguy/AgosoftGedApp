from rest_framework import viewsets
from rest_framework.permissions import IsAuthenticated, IsAdminUser
from rest_framework.decorators import api_view, permission_classes
from rest_framework.response import Response
from django.contrib.auth.models import Group
from django.db.models import Count
from ..serializers.group_serializer import GroupSerializer
from ..constants import APP_MODULES
from gestion_acces.services.localites_dernier_niveau_service import (
    build_localites_dernier_niveau_payload,
)
from gestion_documentaire.models import DocumentLocalite
from gestion_documentaire.services.controle_qualite_access import (
    user_can_access_controle_qualite,
    user_can_view_statut_qualite,
    user_visible_statuts_qualite,
)


class IsStaffOrSuperuser(IsAdminUser):
    """Autorise uniquement les utilisateurs is_staff ou is_superuser."""
    message = "Seuls les administrateurs peuvent gérer les groupes."


class GroupViewSet(viewsets.ModelViewSet):
  """CRUD des groupes Django avec modules et localités du dernier niveau."""

  serializer_class = GroupSerializer

  def get_permissions(self):
    return [IsAuthenticated(), IsStaffOrSuperuser()]

  def get_queryset(self):
    """Précharge permissions, profil d'accès et utilisateurs pour limiter les requêtes N+1."""
    return (
      Group.objects.prefetch_related(
        "permissions",
        "ged_profile__localites__niveau",
        "ged_profile__types_documents",
        "user_set",
      )
      .annotate(users_count_ann=Count("user"))
      .all()
    )


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def modules_list_view(request):
  """Liste des modules applicatifs assignables à un groupe."""
  return Response(APP_MODULES)


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def localites_dernier_niveau_view(request):
  """
  Liste les localités du dernier niveau (feuilles du plan géographique).
  Paramètres :
    ?q= recherche
    ?filtrer_acces=1 localités assignées à l'utilisateur
    ?statut_qualite= filtre compteur / liste par statut QC
    ?avec_documents=1 exclut les sites sans document (avec statut_qualite)
    ?totaux_seulement=1 retourne uniquement totaux_par_statut (sidebar)
  """
  query = request.query_params.get("q", "").strip()
  filtrer_acces = request.query_params.get("filtrer_acces") == "1"
  totaux_seulement = request.query_params.get("totaux_seulement") == "1"
  statut_qualite = request.query_params.get("statut_qualite", "").strip()
  avec_documents = request.query_params.get("avec_documents") == "1"

  if statut_qualite or totaux_seulement:
    if not user_can_access_controle_qualite(request.user):
      return Response(
        {"detail": "Vous n'avez pas accès au module contrôle qualité."},
        status=403,
      )
  if statut_qualite and not user_can_view_statut_qualite(request.user, statut_qualite):
    return Response(
      {"detail": "Vous n'avez pas accès à cette file de contrôle qualité."},
      status=403,
    )

  statuts_qc = (
    user_visible_statuts_qualite(request.user)
    if (statut_qualite or totaux_seulement)
    else [
      DocumentLocalite.STATUT_BROUILLON,
      DocumentLocalite.STATUT_EN_ATTENTE,
      DocumentLocalite.STATUT_REJETE,
      DocumentLocalite.STATUT_VALIDE,
    ]
  )

  payload = build_localites_dernier_niveau_payload(
    request.user,
    query=query,
    filtrer_acces=filtrer_acces,
    statut_qualite=statut_qualite,
    avec_documents=avec_documents,
    totaux_seulement=totaux_seulement,
    statuts_qc=statuts_qc,
    document_query_params=request.query_params,
  )
  return Response(payload)
