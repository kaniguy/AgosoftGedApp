from rest_framework.decorators import api_view, permission_classes, throttle_classes
from rest_framework.permissions import IsAuthenticated, AllowAny
from rest_framework.response import Response
from rest_framework import status
from django.contrib.auth import authenticate
from django.contrib.auth.models import User
from rest_framework.authtoken.models import Token
from gestion_acces.serializers.profile_serializer import UserSerializer
from gestion_acces.services.access_service import get_user_access_payload
from gestion_acces.models.journal_activite import JournalActivite
from gestion_acces.services.audit_service import log_activite
from config.throttling import LoginRateThrottle


def resolve_auth_username(login_identifier):
    """Accepte un nom d'utilisateur ou une adresse e-mail."""
    value = (login_identifier or "").strip()
    if not value:
        return ""
    if "@" not in value:
        return value
    user = User.objects.filter(email__iexact=value).first()
    return user.username if user else value


@api_view(["POST"])
@permission_classes([AllowAny])
@throttle_classes([LoginRateThrottle])
def login_view(request):
    login_identifier = request.data.get("username") or request.data.get("login")
    password = request.data.get("password")

    if not login_identifier or not password:
        return Response(
            {"detail": "Veuillez fournir un identifiant et un mot de passe."},
            status=status.HTTP_400_BAD_REQUEST,
        )

    auth_username = resolve_auth_username(login_identifier)
    user = authenticate(username=auth_username, password=password)

    if not user:
        log_activite(
            action=JournalActivite.Action.CONNEXION_ECHOUEE,
            description=f"Tentative de connexion échouée pour « {login_identifier} »",
            username=str(login_identifier)[:150],
            categorie=JournalActivite.Categorie.AUTHENTIFICATION,
            request=request,
            chemin="",
            methode_http="",
        )
        return Response(
            {"detail": "Identifiant ou mot de passe incorrect."},
            status=status.HTTP_400_BAD_REQUEST,
        )

    if not user.is_active:
        log_activite(
            action=JournalActivite.Action.CONNEXION_ECHOUEE,
            description=f"Connexion refusée — compte désactivé ({user.username})",
            user=user,
            username=user.username,
            categorie=JournalActivite.Categorie.AUTHENTIFICATION,
            request=request,
            chemin="",
            methode_http="",
        )
        return Response(
            {"detail": "Ce compte est désactivé."},
            status=status.HTTP_400_BAD_REQUEST,
        )

    # Rotation du jeton à chaque connexion (invalide les sessions précédentes).
    Token.objects.filter(user=user).delete()
    token = Token.objects.create(user=user)
    user_data = UserSerializer(user, context={"request": request}).data
    access = get_user_access_payload(user)

    log_activite(
        action=JournalActivite.Action.CONNEXION,
        description=f"Connexion réussie de {user.username}",
        user=user,
        username=user.username,
        categorie=JournalActivite.Categorie.AUTHENTIFICATION,
        request=request,
        chemin="",
        methode_http="",
    )

    return Response(
        {
            "token": token.key,
            "user": {**user_data, **access},
            "modules": access["modules"],
            "localites": access["localites"],
            "permissions": access["permissions"],
            "is_superuser": access["is_superuser"],
        },
        status=status.HTTP_200_OK,
    )

@api_view(["POST"])
@permission_classes([IsAuthenticated])
def logout_view(request):
    try:
        log_activite(
            action=JournalActivite.Action.DECONNEXION,
            description=f"Déconnexion de {request.user.username}",
            user=request.user,
            username=request.user.username,
            categorie=JournalActivite.Categorie.AUTHENTIFICATION,
            request=request,
            chemin="",
            methode_http="",
        )
        # Supprimer le token de l'utilisateur
        request.user.auth_token.delete()
        return Response(
            {"detail": "Déconnexion réussie."},
            status=status.HTTP_200_OK,
        )
    except Exception as e:
        return Response(
            {"detail": "Une erreur est survenue lors de la déconnexion."},
            status=status.HTTP_400_BAD_REQUEST,
        )

@api_view(["GET"])
@permission_classes([IsAuthenticated])
def me_view(request):
    user = request.user
    access = get_user_access_payload(user)
    user_data = UserSerializer(user, context={"request": request}).data
    return Response(
        {**user_data, **access},
        status=status.HTTP_200_OK,
    )
