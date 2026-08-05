"""Chiffrement AES-256-GCM des documents au repos (pycryptodome).

Format blob :
  magic (4) | version (1) | nonce (12) | ciphertext | tag (16)

Les fichiers sans magic « GED1 » sont traités comme du plaintext
(compatibilité / migration progressive).
"""
from __future__ import annotations

import base64
import os

from Crypto.Cipher import AES
from django.conf import settings

MAGIC = b"GED1"
FORMAT_VERSION = 1
NONCE_SIZE = 12
TAG_SIZE = 16
HEADER_SIZE = len(MAGIC) + 1 + NONCE_SIZE


class DocumentEncryptionError(Exception):
    """Erreur de chiffrement / déchiffrement document."""


def _load_key() -> bytes:
    raw = getattr(settings, "DOCUMENT_ENCRYPTION_KEY", "") or ""
    raw = str(raw).strip()
    if not raw:
        raise DocumentEncryptionError(
            "DOCUMENT_ENCRYPTION_KEY manquante dans la configuration."
        )
    for decoder in (base64.urlsafe_b64decode, base64.b64decode):
        try:
            key = decoder(raw)
            if len(key) == 32:
                return key
        except Exception:
            pass
    try:
        key = bytes.fromhex(raw)
        if len(key) == 32:
            return key
    except ValueError:
        pass
    raw_bytes = raw.encode("utf-8")
    if len(raw_bytes) == 32:
        return raw_bytes
    raise DocumentEncryptionError(
        "DOCUMENT_ENCRYPTION_KEY invalide : attendu 32 octets (base64 ou hex)."
    )


def is_encrypted(data: bytes) -> bool:
    return bool(data) and data.startswith(MAGIC)


def encrypt_bytes(plaintext: bytes) -> bytes:
    """Chiffre des octets clairs → blob GED1."""
    if plaintext is None:
        raise DocumentEncryptionError("Contenu vide.")
    if is_encrypted(plaintext):
        return plaintext
    key = _load_key()
    nonce = os.urandom(NONCE_SIZE)
    cipher = AES.new(key, AES.MODE_GCM, nonce=nonce)
    ciphertext, tag = cipher.encrypt_and_digest(plaintext)
    return MAGIC + bytes([FORMAT_VERSION]) + nonce + ciphertext + tag


def decrypt_bytes(blob: bytes) -> bytes:
    """Déchiffre un blob GED1. Si plaintext détecté, retourne tel quel."""
    if blob is None:
        raise DocumentEncryptionError("Contenu vide.")
    if not is_encrypted(blob):
        return blob
    if len(blob) < HEADER_SIZE + TAG_SIZE:
        raise DocumentEncryptionError("Blob chiffré tronqué.")
    version = blob[len(MAGIC)]
    if version != FORMAT_VERSION:
        raise DocumentEncryptionError(f"Version de chiffrement non supportée : {version}")
    nonce = blob[len(MAGIC) + 1 : HEADER_SIZE]
    body = blob[HEADER_SIZE:]
    ciphertext, tag = body[:-TAG_SIZE], body[-TAG_SIZE:]
    key = _load_key()
    try:
        cipher = AES.new(key, AES.MODE_GCM, nonce=nonce)
        return cipher.decrypt_and_verify(ciphertext, tag)
    except Exception as exc:
        raise DocumentEncryptionError("Échec du déchiffrement du document.") from exc


def read_document_field_bytes(file_field) -> bytes:
    """Lit et déchiffre le contenu d'un FileField document."""
    if not file_field or not file_field.name:
        raise FileNotFoundError("Fichier indisponible.")
    with file_field.open("rb") as handle:
        return handle.read()
