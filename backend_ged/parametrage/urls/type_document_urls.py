from rest_framework.routers import DefaultRouter
from ..views.type_document_view import TypeDocumentViewSet
from ..views.champs_document_view import ChampsDocumentViewSet

router = DefaultRouter()
router.register(r"type-documents", TypeDocumentViewSet)
router.register(r"champs-documents", ChampsDocumentViewSet)

urlpatterns = router.urls