import os
import uuid

from django.core.files.base import ContentFile
from django.db import transaction

from gestion_documentaire.models import DocumentVersion


def _valeurs_snapshot_from_document(document):
    if not document.reponse_id:
        return []
    return [
        {
            "champ_id": v.champ_id,
            "libelle_champ": v.champ.libelle_champ if v.champ_id else "",
            "valeur": v.valeur,
        }
        for v in document.reponse.valeurs.select_related("champ").all()
    ]


def _copy_fichier_to_version(document, version):
    if not document.fichier or not document.fichier.name:
        return False
    storage = document.fichier.storage
    path = document.fichier.name.replace("\\", "/")
    if not storage.exists(path):
        return False
    base_name = os.path.basename(path)
    with storage.open(path, "rb") as source:
        version.fichier.save(base_name, ContentFile(source.read()), save=True)
    return True


@transaction.atomic
def archive_document_version(document, user, *, increment_version=False):
    """
    Archive l'état courant du document avant modification.
    increment_version=True : passe le document à la version suivante après archivage.
    """
    if not document.fichier or not document.fichier.name:
        if increment_version:
            document.version_courante = (document.version_courante or 1) + 1
            document.save(update_fields=["version_courante"])
        return None

    version = DocumentVersion(
        document=document,
        version_number=document.version_courante or 1,
        valeurs_snapshot=_valeurs_snapshot_from_document(document),
        annotations=list(document.annotations or []),
        created_by=user if user and user.is_authenticated else None,
    )
    version.save()
    if not _copy_fichier_to_version(document, version):
        version.delete()
        if increment_version:
            document.version_courante = (document.version_courante or 1) + 1
            document.save(update_fields=["version_courante"])
        return None

    if increment_version:
        document.version_courante = (document.version_courante or 1) + 1
        document.save(update_fields=["version_courante"])

    return version


def delete_document_versions(document):
    """Supprime les fichiers de versions liés à un document."""
    for version in document.versions.all():
        if version.fichier:
            version.fichier.delete(save=False)
        version.delete()


def dedupe_archived_versions(versions_qs):
    """
    Retourne une entrée par numéro de version (la plus récente).
    Corrige l'affichage si des doublons ont été créés par un écrasement.
    """
    seen = {}
    for version in versions_qs:
        if version.version_number not in seen:
            seen[version.version_number] = version
    return sorted(seen.values(), key=lambda v: (-v.version_number, -v.pk))
