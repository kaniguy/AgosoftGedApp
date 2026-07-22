"""Commande planifiée : envoi du résumé périodique des documents en attente.

À planifier (Planificateur de tâches Windows / cron), par exemple chaque heure :
    python manage.py envoyer_resume_periodique

La commande vérifie elle-même la configuration (activation, fréquence, jour,
dernier envoi du jour). Utiliser --force pour ignorer ces contrôles.
"""

from django.core.management.base import BaseCommand

from gestion_acces.services.notifications.notification_resume_periodique import (
    envoyer_resume_periodique,
)


class Command(BaseCommand):
    help = "Envoie le résumé périodique des documents en attente aux contrôleurs."

    def add_arguments(self, parser):
        parser.add_argument(
            "--force",
            action="store_true",
            help="Envoyer même si la configuration ne le prévoit pas maintenant.",
        )

    def handle(self, *args, **options):
        result = envoyer_resume_periodique(force=options["force"], async_send=False)
        self.stdout.write(
            self.style.SUCCESS(
                f"Résumé périodique : {result['envoyes']} envoyé(s), "
                f"{result['ignores']} ignoré(s). {result['detail']}"
            )
        )
