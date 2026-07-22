from django.contrib import admin
from .models.entreprise import Entreprise
from .models.lien_telechargement import LienTelechargement


@admin.register(Entreprise)
class EntrepriseAdmin(admin.ModelAdmin):
    list_display = ("libelle", "slogan", "date_modification")


@admin.register(LienTelechargement)
class LienTelechargementAdmin(admin.ModelAdmin):
    list_display = ("token", "document_count", "validity_hours", "is_active", "expires_at", "created_by", "created_at")
    list_filter = ("is_active", "validity_hours")
    search_fields = ("token", "created_by__username")
    readonly_fields = ("token", "created_at")
