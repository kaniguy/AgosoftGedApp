from django.urls import include, path
from rest_framework.routers import DefaultRouter

from gestion_documentaire.views.document_view import DocumentLocaliteViewSet
from gestion_documentaire.views.lot_brouillon_view import LotBrouillonRattachementViewSet

router = DefaultRouter()
router.register(r"documents", DocumentLocaliteViewSet, basename="document-localite")
router.register(r"lots-brouillon", LotBrouillonRattachementViewSet, basename="lot-brouillon-rattachement")

urlpatterns = [
    path("", include(router.urls)),
]
