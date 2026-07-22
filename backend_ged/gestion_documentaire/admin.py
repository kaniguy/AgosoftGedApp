from django.contrib import admin

from gestion_documentaire.models import DocumentLocalite


@admin.register(DocumentLocalite)
class DocumentLocaliteAdmin(admin.ModelAdmin):
    list_display = ("id", "localite", "type_document", "date_creation", "created_by")
    list_filter = ("type_document", "date_creation")
    search_fields = ("localite__libelle", "type_document__libelle")
