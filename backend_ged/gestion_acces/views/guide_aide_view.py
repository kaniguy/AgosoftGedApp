from rest_framework import viewsets
from rest_framework.permissions import IsAuthenticated

from gestion_acces.models.guide_aide import GuideAide, guide_aide_module_choices
from gestion_acces.permissions import GUIDE_AIDE_CHANGE, GuideAidePermission
from gestion_acces.serializers.guide_aide_serializer import GuideAideSerializer


class GuideAideViewSet(viewsets.ModelViewSet):
    """
    Lecture : utilisateur du module Aide Vidéo.
    Écriture : permissions add / change / delete du guide d'aide.
    """

    serializer_class = GuideAideSerializer
    permission_classes = [IsAuthenticated, GuideAidePermission]
    pagination_class = None
    http_method_names = ["get", "post", "put", "patch", "delete", "head", "options"]

    def get_queryset(self):
        qs = GuideAide.objects.prefetch_related("documents").all()
        user = self.request.user
        can_manage = user.is_superuser or user.has_perm(GUIDE_AIDE_CHANGE)
        if not can_manage:
            qs = qs.filter(actif=True)
        module_code = (self.request.query_params.get("module") or "").strip()
        if module_code:
            qs = qs.filter(module_code=module_code)
        return qs

    def list(self, request, *args, **kwargs):
        response = super().list(request, *args, **kwargs)
        if isinstance(response.data, list):
            response.data = {
                "results": response.data,
                "modules": [
                    {"code": code, "label": label}
                    for code, label in guide_aide_module_choices()
                ],
            }
        return response

    def destroy(self, request, *args, **kwargs):
        instance = self.get_object()
        for doc in instance.documents.all():
            if doc.fichier:
                doc.fichier.delete(save=False)
        return super().destroy(request, *args, **kwargs)
