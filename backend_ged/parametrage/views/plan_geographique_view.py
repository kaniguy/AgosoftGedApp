from django.shortcuts import get_object_or_404
from django.db.models import Count, Q
from rest_framework.viewsets import ModelViewSet
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from rest_framework.exceptions import ValidationError, PermissionDenied
from gestion_acces.permissions import GedDjangoModelPermissions
from ..models import PlanGeographique, StructureGeographique
from ..serializers import PlanGeographiqueSerializer
from gestion_acces.services.access_service import filter_plan_queryset, get_allowed_plan_ids, get_user_type_document_ids
from gestion_documentaire.models import DocumentLocalite

PLAN_FIELDS = ("libelle", "code", "description", "longitude", "latitude")
PAGE_SIZE = 15


def _paginate_queryset(queryset, request, serializer_class):
    total = queryset.count()
    try:
        offset = max(int(request.query_params.get("offset", 0)), 0)
        limit = min(max(int(request.query_params.get("limit", PAGE_SIZE)), 1), 100)
    except (TypeError, ValueError):
        offset = 0
        limit = PAGE_SIZE

    page = queryset[offset : offset + limit]
    serializer = serializer_class(page, many=True)
    return Response(
        {
            "results": serializer.data,
            "total": total,
            "offset": offset,
            "limit": limit,
            "has_more": offset + limit < total,
        }
    )


def _normalize_plan_fields(data):
    payload = {field: data.get(field) for field in PLAN_FIELDS}

    payload["libelle"] = (payload.get("libelle") or "").strip()
    payload["code"] = (payload.get("code") or "").strip() or None
    payload["description"] = (payload.get("description") or "").strip()

    for coord in ("longitude", "latitude"):
        value = payload.get(coord)
        if value in ("", None):
            payload[coord] = None

    return payload


def _build_nb_documents_annotation(request):
    """Compte les documents d'une localité (tous statuts ou archives validées uniquement)."""
    if request.query_params.get("documents_valides") != "1":
        return Count("documents", distinct=True)

    doc_filter = Q(documents__statut_qualite=DocumentLocalite.STATUT_VALIDE)
    user = request.user
    if user.is_authenticated and not user.is_superuser:
        type_ids = get_user_type_document_ids(user)
        if type_ids is not None:
            doc_filter &= Q(documents__type_document_id__in=type_ids)
    return Count("documents", filter=doc_filter, distinct=True)


class PlanGeographiqueViewSet(ModelViewSet):
    queryset = PlanGeographique.objects.all()
    serializer_class = PlanGeographiqueSerializer
    permission_classes = [IsAuthenticated, GedDjangoModelPermissions]

    def _apply_access_filter(self, qs):
        """Restreint le queryset aux branches autorisées pour l'utilisateur."""
        return filter_plan_queryset(qs, self.request.user)

    def _annotated_queryset(self):
        nb_docs = _build_nb_documents_annotation(self.request)
        return PlanGeographique.objects.select_related("niveau").annotate(
            nb_enfants=Count("enfants", distinct=True),
            nb_documents=nb_docs,
        )

    def get_queryset(self):
        qs = self._annotated_queryset()

        if self.action == "list":
            qs = qs.filter(parent__isnull=True).order_by("libelle")
            return self._apply_access_filter(qs)

        return self._apply_access_filter(qs.order_by("libelle"))

    def get_object(self):
        queryset = self._apply_access_filter(self._annotated_queryset())
        lookup_url_kwarg = self.lookup_url_kwarg or self.lookup_field
        filter_kwargs = {self.lookup_field: self.kwargs[lookup_url_kwarg]}
        obj = get_object_or_404(queryset, **filter_kwargs)
        self.check_object_permissions(self.request, obj)
        return obj

    def list(self, request, *args, **kwargs):
        return _paginate_queryset(self.get_queryset(), request, self.get_serializer_class())

    @action(detail=False, methods=["get"], url_path="compteur")
    def compteur(self, request):
        """Nombre total de localités dans le plan (tous niveaux) et nombre de racines."""
        qs = self._apply_access_filter(self._annotated_queryset())
        return Response(
            {
                "total": qs.count(),
                "total_racines": qs.filter(parent__isnull=True).count(),
            }
        )

    def perform_create(self, serializer):
        premier_niveau = StructureGeographique.objects.order_by("ordre").first()
        if not premier_niveau:
            raise ValidationError(
                "Aucune structure géographique configurée. Veuillez d'abord créer les niveaux."
            )

        serializer.save(
            parent=None,
            niveau=premier_niveau,
            created_by=self.request.user,
        )

    def perform_update(self, serializer):
        serializer.save(updated_by=self.request.user)

    @action(detail=False, methods=["get"], url_path="rechercher")
    def rechercher(self, request):
        """Recherche sur tous les niveaux du plan géographique."""
        query = request.query_params.get("q", "").strip()
        localite_id = request.query_params.get("id", "").strip()

        if localite_id:
            try:
                localite = PlanGeographique.objects.select_related("niveau", "parent").get(
                    id=localite_id
                )
                localites = [localite]
            except PlanGeographique.DoesNotExist:
                return Response({"results": []})

            allowed = get_allowed_plan_ids(request.user)
            if allowed is not None and localite.id not in allowed:
                return Response({"results": []})
        elif len(query) < 2:
            return Response({"results": []})
        else:
            localites = (
                PlanGeographique.objects.filter(
                    Q(libelle__icontains=query) | Q(code__icontains=query)
                )
                .select_related("niveau", "parent")
                .order_by("libelle")[:20]
            )

        allowed = get_allowed_plan_ids(request.user)
        if allowed is not None:
            localites = [loc for loc in localites if loc.id in allowed]

        results = []
        for localite in localites:
            ancetres = localite.get_ancetres()
            chemin = [
                {
                    "id": ancetre.id,
                    "libelle": ancetre.libelle,
                    "code": ancetre.code,
                    "niveau": ancetre.niveau.libelle if ancetre.niveau else "",
                }
                for ancetre in ancetres
            ]
            chemin.append(
                {
                    "id": localite.id,
                    "libelle": localite.libelle,
                    "code": localite.code,
                    "niveau": localite.niveau.libelle,
                }
            )

            chemin_str = " > ".join(
                f"{item['libelle']} ({item['niveau']})" if item.get("niveau") else item["libelle"]
                for item in chemin
            )

            results.append(
                {
                    "id": localite.id,
                    "libelle": localite.libelle,
                    "code": localite.code,
                    "niveau": localite.niveau.libelle,
                    "niveau_ordre": localite.niveau.ordre,
                    "chemin": chemin,
                    "chemin_str": chemin_str,
                }
            )

        return Response({"results": results})

    @action(detail=True, methods=["get"])
    def enfants(self, request, pk=None):
        parent = self.get_object()
        nb_docs = _build_nb_documents_annotation(request)
        children_qs = (
            parent.enfants.select_related("niveau")
            .annotate(
                nb_enfants=Count("enfants", distinct=True),
                nb_documents=nb_docs,
            )
            .order_by("libelle")
        )
        children_qs = self._apply_access_filter(children_qs)
        return _paginate_queryset(children_qs, request, self.get_serializer_class())

    @action(detail=True, methods=["post"])
    def add_child(self, request, pk=None):
        parent = self.get_object()
        payload = _normalize_plan_fields(request.data)

        if not payload["libelle"]:
            return Response(
                {"libelle": ["Le libellé est requis."]},
                status=status.HTTP_400_BAD_REQUEST,
            )

        try:
            enfant = parent.add_child(user=request.user, **payload)
        except Exception as exc:
            return Response({"detail": str(exc)}, status=status.HTTP_400_BAD_REQUEST)

        enfant = self._annotated_queryset().get(pk=enfant.pk)
        return Response(self.get_serializer(enfant).data)
