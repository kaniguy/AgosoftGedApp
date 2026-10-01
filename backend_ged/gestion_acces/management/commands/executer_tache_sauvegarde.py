"""Exécute une tâche de sauvegarde (export, restauration, réinitialisation).

Lancée automatiquement par l'API dans un processus séparé de Gunicorn :
    python manage.py executer_tache_sauvegarde <job_id>
"""

from django.core.management.base import BaseCommand

from gestion_acces.services.sauvegarde_jobs import run_in_current_process
from gestion_acces.services.sauvegarde_runner import run_job


class Command(BaseCommand):
    help = "Exécute une tâche de sauvegarde créée par l'API."

    def add_arguments(self, parser):
        parser.add_argument("job_id")

    def handle(self, *args, **options):
        run_in_current_process(options["job_id"], run_job)
