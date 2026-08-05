"""Stockage Django qui chiffre à l'écriture et déchiffre à la lecture."""
from __future__ import annotations

from django.core.files.base import ContentFile
from django.core.files.storage import FileSystemStorage

from gestion_documentaire.services.document_crypto import decrypt_bytes, encrypt_bytes


class EncryptedDocumentStorage(FileSystemStorage):
    """FileSystemStorage avec chiffrement AES-256-GCM transparent."""

    def _save(self, name, content):
        if hasattr(content, "open"):
            try:
                content.open("rb")
            except Exception:
                pass
        if hasattr(content, "seek"):
            try:
                content.seek(0)
            except Exception:
                pass
        data = content.read()
        if isinstance(data, str):
            data = data.encode("utf-8")
        encrypted = encrypt_bytes(data or b"")
        return super()._save(name, ContentFile(encrypted))

    def _open(self, name, mode="rb"):
        handle = super()._open(name, "rb")
        try:
            data = handle.read()
        finally:
            handle.close()
        plain = decrypt_bytes(data)
        return ContentFile(plain, name=name)


encrypted_document_storage = EncryptedDocumentStorage()
