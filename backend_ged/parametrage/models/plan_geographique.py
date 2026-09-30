from django.db import models
from django.conf import settings
from django.utils import timezone
from .structure_geographique import StructureGeographique


class PlanGeographique(models.Model):
    niveau = models.ForeignKey(StructureGeographique, on_delete=models.CASCADE)

    parent = models.ForeignKey(
        "self",
        null=True,
        blank=True,
        on_delete=models.CASCADE,
        related_name="enfants"
    )

    libelle = models.CharField(max_length=255)
    code = models.CharField(max_length=50, blank=True, null=True)
    description = models.TextField(blank=True)
    longitude = models.DecimalField(max_digits=9, decimal_places=6, null=True, blank=True)
    latitude = models.DecimalField(max_digits=9, decimal_places=6, null=True, blank=True)

    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        related_name="plans_geographiques_creees"
    )

    updated_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="plans_geographiques_modifiees"
    )

    date_creation = models.DateTimeField(default=timezone.now)
    date_modification = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["id"]
        verbose_name = "plan de classement"
        verbose_name_plural = "plans de classement"

    def __str__(self):
        return self.libelle

    # 🔥 niveau suivant
    @staticmethod
    def structure_niveaux_ordered():
        # Pas de cache au niveau du processus : les niveaux changent au paramétrage
        # et chaque worker Gunicorn garderait sinon une structure périmée.
        return list(StructureGeographique.objects.all().order_by("ordre"))

    def get_niveau_enfant(self, niveaux=None):
        """`niveaux` : liste ordonnée déjà chargée, pour éviter une requête par localité."""
        if niveaux is None:
            niveaux = PlanGeographique.structure_niveaux_ordered()
        try:
            current_index = niveaux.index(self.niveau)
            if current_index + 1 < len(niveaux):
                return niveaux[current_index + 1]
        except ValueError:
            return None
        return None

    def get_ancetres(self):
        """Retourne la liste des parents de manière ascendante."""
        ancetres = []
        parent = self.parent
        while parent:
            ancetres.insert(0, parent)
            parent = parent.parent
        return ancetres

    # 🌿 création enfant automatique
    def add_child(self, user, **fields):
        next_level = self.get_niveau_enfant()

        if not next_level:
            raise Exception("Dernier niveau atteint")

        return PlanGeographique.objects.create(
            parent=self,
            niveau=next_level,
            created_by=user,
            **fields,
        )

    # 🌳 ROOT creation helper
    @staticmethod
    def create_root(libelle, niveau, user):
        return PlanGeographique.objects.create(
            libelle=libelle,
            niveau=niveau,
            parent=None,
            created_by=user
        )