import logging
import os
import threading

from django.apps import AppConfig

logger = logging.getLogger(__name__)


class GestionDocumentaireConfig(AppConfig):
    default_auto_field = "django.db.models.BigAutoField"
    name = "gestion_documentaire"
    verbose_name = "Gestion documentaire"

    def ready(self):
        import gestion_documentaire.signals  # noqa: F401

        if os.environ.get("GED_SKIP_OCR_WARMUP") == "1":
            return
        import sys

        # Précharger l'OCR uniquement pour le serveur web (pas migrate, createsuperuser, etc.)
        if "runserver" not in sys.argv:
            return
        if os.environ.get("RUN_MAIN") != "true":
            return

        threading.Thread(target=self._warmup_ocr, daemon=True).start()

    @staticmethod
    def _warmup_ocr():
        try:
            from gestion_documentaire.services.ocr_service import is_ocr_available

            logger.info("Préchargement OCR en cours (PaddleOCR)…")
            if is_ocr_available():
                logger.info("Préchargement OCR terminé — prêt pour les imports de documents")
            else:
                from gestion_documentaire.services.ocr_service import get_ocr_unavailable_reason

                logger.warning(
                    "Préchargement OCR échoué : %s",
                    get_ocr_unavailable_reason() or "raison inconnue",
                )
        except Exception:
            logger.warning("Préchargement OCR ignoré (moteur indisponible)", exc_info=True)
