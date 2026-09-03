"""Libellés français des permissions Django pour l'interface GED."""

from django.contrib.auth.models import Permission

# Verbes d'action (équivalent de Can add / change / delete / view)
ACTION_LABELS_FR = {
    "add": "Peut ajouter",
    "change": "Peut modifier",
    "delete": "Peut supprimer",
    "view": "Peut consulter",
    "exporter": "Peut exporter",
    "restaurer": "Peut restaurer",
    "reinitialiser": "Peut réinitialiser",
}

# Applications Django → libellé module
APP_LABELS_FR = {
    "parametrage": "Paramétrage",
    "gestion_documentaire": "Gestion documentaire",
    "gestion_acces": "Gestion des accès",
    "auth": "Authentification",
    "contenttypes": "Types de contenu",
    "sessions": "Sessions",
    "admin": "Administration",
    "authtoken": "Jetons d'authentification",
}

# Modèles Django (content_type.model) → nom affiché en français
MODEL_LABELS_FR = {
    "documentlocalite": "document localité",
    "typedocument": "type de document",
    "champsdocument": "champ document",
    "optionchamp": "option de champ",
    "reponsedocument": "réponse document",
    "valeurchamp": "valeur de champ",
    "plangeographique": "plan de classement",
    "structuregeographique": "niveau de classement",
    "userprofile": "profil utilisateur",
    "groupprofile": "profil de groupe",
    "entreprise": "entreprise",
    "lientelechargement": "lien de téléchargement",
    "journalactivite": "journal d'activité",
    "configurationemail": "configuration e-mail",
    "reglenotification": "règle de notification",
    "modeleemailnotification": "modèle d'e-mail de notification",
    "configurationresumeperiodique": "configuration du résumé périodique",
    "preferencenotification": "préférence de notification",
    "notificationemaillog": "journal de notification e-mail",
    "usersignature": "signature utilisateur",
    "guideaide": "guide d'aide",
    "guideaidedocument": "document de guide d'aide",
    "sauvegardebase": "base de données",
    "user": "utilisateur",
    "group": "groupe",
    "permission": "permission",
    "contenttype": "type de contenu",
    "session": "session",
    "logentry": "entrée du journal",
    "token": "jeton",
    "tokenproxy": "jeton",
}


def get_model_label_fr(model_key: str) -> str:
    """Retourne le libellé français d'un modèle à partir de son identifiant technique."""
    key = (model_key or "").lower()
    if key in MODEL_LABELS_FR:
        return MODEL_LABELS_FR[key]
    return key.replace("_", " ")


def get_app_label_fr(app_label: str) -> str:
    """Retourne le libellé français d'une application Django."""
    return APP_LABELS_FR.get(app_label, app_label)


def format_permission_label_fr(permission: Permission) -> str:
    """
    Construit un libellé lisible en français, ex. :
    « Peut ajouter document localité » au lieu de « Can add document localité ».
    """
    codename = permission.codename or ""
    for action, action_label in sorted(
        ACTION_LABELS_FR.items(), key=lambda item: len(item[0]), reverse=True
    ):
        prefix = f"{action}_"
        if codename.startswith(prefix):
            model_key = codename[len(prefix) :]
            model_label = get_model_label_fr(model_key)
            return f"{action_label} {model_label}"
    return permission.name or codename


def sync_permission_names_fr(queryset=None):
    """
    Met à jour le champ name en base pour toutes les permissions (ou un sous-ensemble).
    Retourne le nombre de permissions modifiées.
    """
    qs = queryset if queryset is not None else Permission.objects.all()
    updated = 0
    for perm in qs.select_related("content_type"):
        label = format_permission_label_fr(perm)
        if perm.name != label:
            perm.name = label
            perm.save(update_fields=["name"])
            updated += 1
    return updated
