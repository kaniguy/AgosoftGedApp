from django.urls import path
from rest_framework.routers import DefaultRouter
from ..views.type_document_view import TypeDocumentViewSet
from ..views.champs_document_view import ChampsDocumentViewSet
from ..views.etat_parametrage_view import etat_parametrage_view

router = DefaultRouter()
router.register(r"type-documents", TypeDocumentViewSet)
router.register(r"champs-documents", ChampsDocumentViewSet)

urlpatterns = [
    path("etat-parametrage/", etat_parametrage_view, name="etat_parametrage"),
    *router.urls,
]
