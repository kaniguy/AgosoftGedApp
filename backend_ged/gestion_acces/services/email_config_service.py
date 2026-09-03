"""Lecture / application de la configuration SMTP (gestion des accès)."""

from django.core.mail import get_connection


def get_configuration_email():
    from gestion_acces.models.configuration_email import ConfigurationEmail

    return ConfigurationEmail.get_solo()


def get_email_settings_dict():
    """Retourne uniquement la configuration saisie en base (pas de données .env)."""
    from config.secret_box import decrypt_secret

    cfg = get_configuration_email()
    return {
        "EMAIL_BACKEND": cfg.email_backend
        or "django.core.mail.backends.smtp.EmailBackend",
        "EMAIL_HOST": cfg.email_host or "",
        "EMAIL_PORT": int(cfg.email_port or 587),
        "EMAIL_USE_TLS": bool(cfg.email_use_tls),
        "EMAIL_USE_SSL": bool(cfg.email_use_ssl),
        "EMAIL_HOST_USER": cfg.email_host_user or "",
        "EMAIL_HOST_PASSWORD": decrypt_secret(cfg.email_host_password or ""),
        "DEFAULT_FROM_EMAIL": cfg.default_from_email or cfg.email_host_user or "",
    }


def is_email_configured():
    cfg = get_email_settings_dict()
    return bool(cfg["EMAIL_HOST"] and cfg["EMAIL_HOST_USER"])


def get_smtp_connection(fail_silently=False):
    """Connexion e-mail basée sur la configuration en base."""
    if not is_email_configured():
        raise ValueError(
            "Configuration SMTP-mail incomplète. Renseignez-la dans Gestion des accès → Configuration SMTP-mail."
        )
    cfg = get_email_settings_dict()
    return get_connection(
        backend=cfg["EMAIL_BACKEND"],
        host=cfg["EMAIL_HOST"],
        port=cfg["EMAIL_PORT"],
        username=cfg["EMAIL_HOST_USER"],
        password=cfg["EMAIL_HOST_PASSWORD"],
        use_tls=cfg["EMAIL_USE_TLS"],
        use_ssl=cfg["EMAIL_USE_SSL"],
        fail_silently=fail_silently,
    )


def get_default_from_email():
    cfg = get_email_settings_dict()
    return cfg["DEFAULT_FROM_EMAIL"] or cfg["EMAIL_HOST_USER"] or "noreply@localhost"
