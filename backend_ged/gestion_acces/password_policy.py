"""Règles de mot de passe GED : 8 caractères, majuscule, minuscule, chiffre."""

from __future__ import annotations

import secrets
import string

from django.core.exceptions import ValidationError

PASSWORD_HELP = (
    "8 caractères minimum, dont au moins une majuscule, une minuscule et un chiffre."
)
PASSWORD_MIN_LENGTH = 8


def password_complexity_errors(password: str) -> list[str]:
    value = password or ""
    errors = []
    if len(value) < PASSWORD_MIN_LENGTH:
        errors.append(f"au moins {PASSWORD_MIN_LENGTH} caractères")
    if not any(c.isupper() for c in value):
        errors.append("une lettre majuscule")
    if not any(c.islower() for c in value):
        errors.append("une lettre minuscule")
    if not any(c.isdigit() for c in value):
        errors.append("un chiffre")
    return errors


def validate_password_complexity(password: str, user=None):
    missing = password_complexity_errors(password)
    if missing:
        raise ValidationError(
            f"Le mot de passe doit contenir {', '.join(missing)}.",
            code="password_complexity",
        )


class ComplexityPasswordValidator:
    """Validateur Django (AUTH_PASSWORD_VALIDATORS)."""

    def validate(self, password, user=None):
        validate_password_complexity(password, user=user)

    def get_help_text(self):
        return PASSWORD_HELP


def generate_ged_password(length: int = 12) -> str:
    """Génère un mot de passe aléatoire conforme à la politique."""
    alphabet = string.ascii_letters + string.digits
    length = max(length, PASSWORD_MIN_LENGTH)
    while True:
        password = "".join(secrets.choice(alphabet) for _ in range(length))
        if not password_complexity_errors(password):
            return password
