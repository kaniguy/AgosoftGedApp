from rest_framework.routers import DefaultRouter
from ..views import PlanGeographiqueViewSet

router = DefaultRouter()
router.register(r"plans-geographiques", PlanGeographiqueViewSet)

urlpatterns = router.urls