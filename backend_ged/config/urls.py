from django.contrib import admin
from django.urls import path, include
from django.conf import settings
from django.conf.urls.static import static

urlpatterns = [
    path("admin/", admin.site.urls),
    path("api/parametrage/", include("parametrage.urls.type_document_urls")),
    path("api/auth/", include("parametrage.urls.auth_urls")),
    path("api/gestion-acces/", include("gestion_acces.urls")),
    path("api/parametrage/structures-geographiques/", include("parametrage.urls.structure_geographique_urls")),
    path("api/parametrage/plans-geographiques/", include("parametrage.urls.plan_geographique_urls")),
    path("api/gestion-documentaire/", include("gestion_documentaire.urls")),
]

if settings.DEBUG:
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)