from django.contrib import admin
from ..models import TypeDocument

@admin.register(TypeDocument)
class TypeDocumentAdmin(admin.ModelAdmin):
    list_display = ("code", "libelle")
    search_fields = ("code", "libelle")