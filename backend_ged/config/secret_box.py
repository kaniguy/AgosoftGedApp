"""Chiffrement de secrets applicatifs (ex. mot de passe SMTP) au repos."""

from __future__ import annotations

import base64
import os

from Crypto.Cipher import AES

from gestion_documentaire.services.document_crypto import DocumentEncryptionError, _load_key

_PREFIX = "GEDSEC1:"
_NONCE_SIZE = 12
_TAG_SIZE = 16


def encrypt_secret(plaintext: str) -> str:
    value = (plaintext or "").strip()
    if not value:
        return ""
    if value.startswith(_PREFIX):
        return value

    key = _load_key()
    nonce = os.urandom(_NONCE_SIZE)
    cipher = AES.new(key, AES.MODE_GCM, nonce=nonce)
    ciphertext, tag = cipher.encrypt_and_digest(value.encode("utf-8"))
    blob = base64.urlsafe_b64encode(nonce + ciphertext + tag).decode("ascii")
    return f"{_PREFIX}{blob}"


def decrypt_secret(stored: str) -> str:
    value = stored or ""
    if not value:
        return ""
    if not value.startswith(_PREFIX):
        # Compatibilité : anciennes valeurs en clair
        return value

    try:
        raw = base64.urlsafe_b64decode(value[len(_PREFIX) :].encode("ascii"))
        nonce = raw[:_NONCE_SIZE]
        tag = raw[-_TAG_SIZE:]
        ciphertext = raw[_NONCE_SIZE:-_TAG_SIZE]
        cipher = AES.new(_load_key(), AES.MODE_GCM, nonce=nonce)
        return cipher.decrypt_and_verify(ciphertext, tag).decode("utf-8")
    except Exception as exc:
        raise DocumentEncryptionError("Impossible de déchiffrer le secret stocké.") from exc
