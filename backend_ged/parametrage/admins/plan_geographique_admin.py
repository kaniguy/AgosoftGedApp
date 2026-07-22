from django.contrib import admin
from ..models import StructureGeographique, PlanGeographique

@admin.register(StructureGeographique)
class StructureGeographiqueAdmin(admin.ModelAdmin):
    list_display = ("ordre", "code", "libelle")
    ordering = ("ordre",)


@admin.register(PlanGeographique)
class PlanGeographiqueAdmin(admin.ModelAdmin):
    list_display = ("libelle", "niveau", "parent", "created_by")
    search_fields = ("libelle",)
    list_filter = ("niveau",)