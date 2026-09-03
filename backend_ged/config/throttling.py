from rest_framework.throttling import AnonRateThrottle


class LoginRateThrottle(AnonRateThrottle):
    """5 tentatives par minute par IP sur l'endpoint de connexion."""
    scope = "login"


class DownloadLinkRateThrottle(AnonRateThrottle):
    """Limitation des accès anonymes aux liens de téléchargement publics."""
    scope = "download_link"
