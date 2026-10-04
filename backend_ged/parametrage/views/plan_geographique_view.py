from django.db.models import Count, Q
from rest_framework.viewsets import ModelViewSet
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from rest_framework.exceptions import ValidationError, PermissionDenied, NotFound
from gestion_acces.permissions import CanReadPlanGeographique
from ..models import PlanGeographique, StructureGeographique
from ..serializers import PlanGeographiqueSerializer
from gestion_acces.services.access_service import filter_plan_queryset, get_allowed_plan_ids, get_user_type_document_ids
from gestion_documentaire.models import DocumentLocalite, ItemLotBrouillonRattachement

PLAN_FIELDS = ("libelle", "code", "description", "longitude", "latitude")
PAGE_SIZE = 15


def _paginate_queryset(queryset, request, serializer_class, annotate=None, attach=None):
    """Pagine d'abord, n'annote que la page — évite un COUNT bloquant SQL Server."""
    total = queryset.count()
    try:
        offset = max(int(request.query_params.get("offset", 0)), 0)
        limit = min(max(int(request.query_params.get("limit", PAGE_SIZE)), 1), 100)
    except (TypeError, ValueError):
        offset = 0
        limit = PAGE_SIZE

    ids = list(queryset.values_list("id", flat=True)[offset : offset + limit])
    if not ids:
        page = []
    elif annotate:
        annotated = annotate(
            PlanGeographique.objects.filter(id__in=ids).select_related("niveau")
        )
        by_id = {obj.pk: obj for obj in annotated}
        page = [by_id[pk] for pk in ids if pk in by_id]
    else:
        page = list(queryset[offset : offset + limit])

    if attach:
        attach(page)

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


class PlanGeographiqueViewSet(ModelViewSet):
    queryset = PlanGeographique.objects.all()
    serializer_class = PlanGeographiqueSerializer
    permission_classes = [IsAuthenticated, CanReadPlanGeographique]

    def _apply_access_filter(self, qs):
        """Restreint le queryset aux branches autorisées pour l'utilisateur."""
        return filter_plan_queryset(qs, self.request.user)

    def _base_queryset(self):
        return PlanGeographique.objects.select_related("niveau")

    def _annotate_counts(self, qs):
        # Un seul COUNT (enfants) : joindre documents ici fige SQL Server sur un gros plan.
        return qs.annotate(nb_enfants=Count("enfants"))

    def _attach_nb_documents(self, objects):
        """Compteur documents en 2e requête GROUP BY, uniquement pour la page affichée."""
        if not objects:
            return
        ids = [obj.id for obj in objects]
        docs = DocumentLocalite.objects.filter(localite_id__in=ids)
        if self.request.query_params.get("documents_valides") == "1":
            docs = docs.filter(statut_qualite=DocumentLocalite.STATUT_VALIDE)
            user = self.request.user
            if user.is_authenticated and not user.is_superuser:
                type_ids = get_user_type_document_ids(user)
                if type_ids is not None:
                    docs = docs.filter(type_document_id__in=type_ids)
        counts = dict(
            docs.order_by()
            .values("localite_id")
            .annotate(c=Count("id"))
            .values_list("localite_id", "c")
        )
        for obj in objects:
            obj.nb_documents = counts.get(obj.id, 0)

    def _annotated_queryset(self):
        return self._annotate_counts(self._base_queryset())

    def get_queryset(self):
        qs = self._base_queryset()

        if self.action == "list":
            qs = qs.filter(parent__isnull=True).order_by("libelle")
            return self._apply_access_filter(qs)

        return self._apply_access_filter(qs.order_by("libelle"))

    def get_object(self):
        queryset = self._apply_access_filter(self._base_queryset())
        lookup_url_kwarg = self.lookup_url_kwarg or self.lookup_field
        filter_kwargs = {self.lookup_field: self.kwargs[lookup_url_kwarg]}
        obj = queryset.filter(**filter_kwargs).first()
        if not obj:
            raise NotFound("Cette localité n'existe pas ou vous n'y avez pas accès.")
        self.check_object_permissions(self.request, obj)
        return obj

    def list(self, request, *args, **kwargs):
        return _paginate_queryset(
            self.get_queryset(),
            request,
            self.get_serializer_class(),
            annotate=self._annotate_counts,
            attach=self._attach_nb_documents,
        )

    @action(detail=False, methods=["get"], url_path="compteur")
    def compteur(self, request):
        """Nombre total de localités dans le plan (tous niveaux) et nombre de racines."""
        qs = self._apply_access_filter(self._base_queryset())
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
                "Aucun niveau de classement configuré. Veuillez d'abord créer les niveaux."
            )

        serializer.save(
            parent=None,
            niveau=premier_niveau,
            created_by=self.request.user,
        )

    def perform_update(self, serializer):
        serializer.save(updated_by=self.request.user)

    def destroy(self, request, *args, **kwargs):
        """Suppression ascendante : localité sans sous-localité, sans document ni brouillon."""
        localite = self.get_object()

        nb_enfants = PlanGeographique.objects.filter(parent=localite).count()
        if nb_enfants:
            return Response(
                {
                    "detail": f"Impossible de supprimer « {localite.libelle} » : elle contient "
                    f"{nb_enfants} sous-localité(s). Supprimez d'abord les localités des niveaux "
                    "inférieurs, en commençant par le dernier niveau."
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        nb_documents = DocumentLocalite.objects.filter(localite=localite).count()
        if nb_documents:
            return Response(
                {
                    "detail": f"Impossible de supprimer « {localite.libelle} » : elle contient "
                    f"{nb_documents} document(s). Supprimez d'abord ces documents depuis la "
                    "Gestion documentaire."
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        nb_brouillons = ItemLotBrouillonRattachement.objects.filter(lot__localite=localite).count()
        if nb_brouillons:
            return Response(
                {
                    "detail": f"Impossible de supprimer « {localite.libelle} » : elle contient "
                    f"{nb_brouillons} document(s) en brouillon de rattachement. Supprimez d'abord "
                    "ce brouillon depuis la Gestion documentaire."
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        localite.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)

    @action(detail=False, methods=["get"], url_path="rechercher")
    def rechercher(self, request):
        """Recherche sur tous les niveaux du plan de classement."""
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
        children_qs = parent.enfants.select_related("niveau").order_by("libelle")
        children_qs = self._apply_access_filter(children_qs)
        return _paginate_queryset(
            children_qs,
            request,
            self.get_serializer_class(),
            annotate=self._annotate_counts,
            attach=self._attach_nb_documents,
        )

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
        self._attach_nb_documents([enfant])
        return Response(self.get_serializer(enfant).data)
