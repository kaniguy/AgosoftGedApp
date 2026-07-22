from rest_framework.routers import DefaultRouter
from ..views.structure_geographique_view import StructureGeographiqueViewSet

router = DefaultRouter()
router.register(r"structures-geographiques", StructureGeographiqueViewSet)
urlpatterns = router.urls
