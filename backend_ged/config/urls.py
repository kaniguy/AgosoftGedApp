from django.http import JsonResponse
from django.urls import path, include, re_path
from django.conf import settings
from django.conf.urls.static import static
from django.contrib import admin


def api_root(_request):
    """Page d'accueil du backend (localhost:9000 / IP:9000)."""
    return JsonResponse(
        {
            "service": "AgosoftGed API",
            "status": "ok",
            "admin": "/admin/",
            "endpoints": {
                "auth": "/api/auth/",
                "parametrage": "/api/parametrage/",
                "gestion_acces": "/api/gestion-acces/",
                "gestion_documentaire": "/api/gestion-documentaire/",
            },
        }
    )


urlpatterns = [
    path("", api_root, name="api_root"),
    path("api/", api_root, name="api_index"),
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
else:
    from config.media_view import serve_protected_media

    urlpatterns += [
        re_path(r"^media/(?P<path>.*)$", serve_protected_media, name="protected_media"),
    ]
