from rest_framework.throttling import AnonRateThrottle


class LoginRateThrottle(AnonRateThrottle):
    """5 tentatives par minute par IP sur l'endpoint de connexion."""
    scope = "login"
