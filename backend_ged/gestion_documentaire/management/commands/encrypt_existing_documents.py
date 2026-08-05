"""Chiffre au repos les fichiers documents encore en clair (migration lazy / batch)."""
from __future__ import annotations

from pathlib import Path

from django.conf import settings
from django.core.management.base import BaseCommand

from gestion_documentaire.models import DocumentLocalite, DocumentVersion, ItemLotBrouillonRattachement
from gestion_documentaire.services.document_crypto import encrypt_bytes, is_encrypted

# Racines documentaires à balayer (y compris orphelins hors base).
DOCUMENT_MEDIA_ROOTS = (
    "archive_document",
    "controle_qualite",
    "versions_document",
    "brouillon_rattachement",
)

SKIP_NAMES = {".gitkeep", ".DS_Store", "Thumbs.db"}


class Command(BaseCommand):
    help = (
        "Chiffre les fichiers documents encore en clair sur le disque "
        "(enregistrements en base + orphelins sous les dossiers documentaires)."
    )

    def add_arguments(self, parser):
        parser.add_argument(
            "--dry-run",
            action="store_true",
            help="Affiche ce qui serait chiffré sans écrire.",
        )
        parser.add_argument(
            "--db-only",
            action="store_true",
            help="Ne traite que les fichiers référencés en base (pas le balayage disque).",
        )

    def handle(self, *args, **options):
        dry_run = options["dry_run"]
        db_only = options["db_only"]
        total = encrypted = skipped = missing = errors = 0
        seen_paths: set[str] = set()

        sources = [
            ("DocumentLocalite", DocumentLocalite.objects.exclude(fichier="").exclude(fichier=None)),
            ("DocumentVersion", DocumentVersion.objects.exclude(fichier="").exclude(fichier=None)),
            (
                "ItemLotBrouillon",
                ItemLotBrouillonRattachement.objects.exclude(fichier="").exclude(fichier=None),
            ),
        ]

        for label, qs in sources:
            self.stdout.write(self.style.NOTICE(f"— {label}"))
            for obj in qs.iterator():
                total += 1
                field = obj.fichier
                if not field or not field.name:
                    missing += 1
                    continue
                storage = field.storage
                name = field.name
                if not storage.exists(name):
                    missing += 1
                    self.stdout.write(self.style.WARNING(f"  manquant: {name}"))
                    continue
                try:
                    path = Path(storage.path(name))
                except Exception as exc:
                    errors += 1
                    self.stdout.write(self.style.ERROR(f"  erreur chemin {name}: {exc}"))
                    continue

                result = self._encrypt_path(path, label=name, dry_run=dry_run)
                seen_paths.add(str(path.resolve()))
                encrypted += result["encrypted"]
                skipped += result["skipped"]
                errors += result["errors"]

        if not db_only:
            media_root = Path(settings.MEDIA_ROOT)
            self.stdout.write(self.style.NOTICE("— Balayage disque (orphelins inclus)"))
            for root_name in DOCUMENT_MEDIA_ROOTS:
                root_dir = media_root / root_name
                if not root_dir.is_dir():
                    continue
                for path in root_dir.rglob("*"):
                    if not path.is_file() or path.name in SKIP_NAMES:
                        continue
                    resolved = str(path.resolve())
                    if resolved in seen_paths:
                        continue
                    total += 1
                    rel = path.relative_to(media_root).as_posix()
                    result = self._encrypt_path(path, label=rel, dry_run=dry_run)
                    seen_paths.add(resolved)
                    encrypted += result["encrypted"]
                    skipped += result["skipped"]
                    errors += result["errors"]

        self.stdout.write("")
        self.stdout.write(
            self.style.SUCCESS(
                f"Terminé — total={total} chiffrés={encrypted} déjà_ok={skipped} "
                f"manquants={missing} erreurs={errors}"
                + (" (dry-run)" if dry_run else "")
            )
        )

    def _encrypt_path(self, path: Path, *, label: str, dry_run: bool) -> dict[str, int]:
        out = {"encrypted": 0, "skipped": 0, "errors": 0}
        try:
            raw = path.read_bytes()
        except Exception as exc:
            out["errors"] = 1
            self.stdout.write(self.style.ERROR(f"  erreur lecture {label}: {exc}"))
            return out

        if is_encrypted(raw):
            out["skipped"] = 1
            return out

        if dry_run:
            out["encrypted"] = 1
            self.stdout.write(f"  [dry-run] chiffrerait: {label}")
            return out

        try:
            path.write_bytes(encrypt_bytes(raw))
            out["encrypted"] = 1
            self.stdout.write(self.style.SUCCESS(f"  chiffré: {label}"))
        except Exception as exc:
            out["errors"] = 1
            self.stdout.write(self.style.ERROR(f"  erreur chiffrement {label}: {exc}"))
        return out
