"""Dépendances entre permissions Django (cascade arborescente)."""

# Une permission implique toutes celles listées (et leurs propres dépendances).
PERMISSION_REQUIRES = {
    "gestion_documentaire.view_documentlocalite": [
        "parametrage.view_typedocument",
        "parametrage.view_champsdocument",
        "parametrage.view_plangeographique",
        "parametrage.view_structuregeographique",
        "parametrage.view_reponsedocument",
        "parametrage.view_valeurchamp",
    ],
    "gestion_documentaire.add_documentlocalite": [
        "gestion_documentaire.view_documentlocalite",
        "parametrage.add_reponsedocument",
        "parametrage.add_valeurchamp",
    ],
    "gestion_documentaire.change_documentlocalite": [
        "gestion_documentaire.view_documentlocalite",
        "parametrage.change_reponsedocument",
        "parametrage.add_valeurchamp",
        "parametrage.change_valeurchamp",
        "parametrage.delete_valeurchamp",
    ],
    "gestion_documentaire.delete_documentlocalite": [
        "gestion_documentaire.view_documentlocalite",
        "parametrage.delete_reponsedocument",
        "parametrage.delete_valeurchamp",
    ],
    "gestion_documentaire.telecharger_document": [
        "gestion_documentaire.view_documentlocalite",
    ],
    "gestion_documentaire.annoter_document": [
        "gestion_documentaire.view_documentlocalite",
    ],
    "gestion_documentaire.tamponner_document": [
        "gestion_documentaire.view_documentlocalite",
    ],
    "gestion_documentaire.signer_document": [
        "gestion_documentaire.view_documentlocalite",
    ],
    "gestion_documentaire.commenter_document": [
        "gestion_documentaire.view_documentlocalite",
    ],
    "gestion_documentaire.qc_soumettre": [
        "gestion_documentaire.view_documentlocalite",
    ],
    "gestion_documentaire.qc_valider": [
        "gestion_documentaire.view_documentlocalite",
    ],
    "gestion_documentaire.qc_rejeter": [
        "gestion_documentaire.view_documentlocalite",
    ],
    "gestion_documentaire.qc_menu_en_attente": [
        "gestion_documentaire.view_documentlocalite",
    ],
    "gestion_documentaire.qc_menu_brouillon": [
        "gestion_documentaire.view_documentlocalite",
    ],
    "gestion_documentaire.qc_menu_rejete": [
        "gestion_documentaire.view_documentlocalite",
    ],
    "gestion_documentaire.qc_menu_valide": [
        "gestion_documentaire.view_documentlocalite",
    ],
    "parametrage.view_champsdocument": [
        "parametrage.view_typedocument",
    ],
    "parametrage.add_typedocument": ["parametrage.view_typedocument"],
    "parametrage.change_typedocument": ["parametrage.view_typedocument"],
    "parametrage.delete_typedocument": ["parametrage.view_typedocument"],
    "parametrage.add_champsdocument": [
        "parametrage.view_champsdocument",
        "parametrage.add_optionchamp",
    ],
    "parametrage.change_champsdocument": [
        "parametrage.view_champsdocument",
        "parametrage.add_optionchamp",
        "parametrage.change_optionchamp",
        "parametrage.delete_optionchamp",
    ],
    "parametrage.delete_champsdocument": [
        "parametrage.view_champsdocument",
        "parametrage.delete_optionchamp",
    ],
    "parametrage.view_optionchamp": ["parametrage.view_champsdocument"],
    "parametrage.add_optionchamp": ["parametrage.view_optionchamp"],
    "parametrage.change_optionchamp": ["parametrage.view_optionchamp"],
    "parametrage.delete_optionchamp": ["parametrage.view_optionchamp"],
    "parametrage.view_reponsedocument": ["parametrage.view_typedocument"],
    "parametrage.add_reponsedocument": ["parametrage.view_reponsedocument"],
    "parametrage.change_reponsedocument": ["parametrage.view_reponsedocument"],
    "parametrage.delete_reponsedocument": ["parametrage.view_reponsedocument"],
    "parametrage.view_valeurchamp": [
        "parametrage.view_reponsedocument",
        "parametrage.view_champsdocument",
    ],
    "parametrage.add_valeurchamp": ["parametrage.view_valeurchamp"],
    "parametrage.change_valeurchamp": ["parametrage.view_valeurchamp"],
    "parametrage.delete_valeurchamp": ["parametrage.view_valeurchamp"],
    "parametrage.add_plangeographique": [
        "parametrage.view_plangeographique",
        "parametrage.view_structuregeographique",
    ],
    "parametrage.change_plangeographique": ["parametrage.view_plangeographique"],
    "parametrage.delete_plangeographique": ["parametrage.view_plangeographique"],
    "parametrage.add_structuregeographique": ["parametrage.view_structuregeographique"],
    "parametrage.change_structuregeographique": ["parametrage.view_structuregeographique"],
    "parametrage.delete_structuregeographique": ["parametrage.view_structuregeographique"],
    "auth.add_user": ["auth.view_user"],
    "auth.change_user": ["auth.view_user"],
    "auth.delete_user": ["auth.view_user"],
    "auth.add_group": ["auth.view_group"],
    "auth.change_group": ["auth.view_group"],
    "auth.delete_group": ["auth.view_group"],
}


def required_codenames(full_codename, acc=None):
    """Retourne le codename et toutes ses dépendances transitives."""
    if acc is None:
        acc = set()
    if not full_codename or full_codename in acc:
        return acc
    acc.add(full_codename)
    for req in PERMISSION_REQUIRES.get(full_codename, []):
        required_codenames(req, acc)
    return acc


def expand_codenames(full_codenames):
    """Union des permissions et de leurs prérequis."""
    expanded = set()
    for full in full_codenames or []:
        required_codenames(full, expanded)
    return expanded


def expand_permission_objects(permissions):
    """Ajoute les Permission Django prérequises à une liste d'objets Permission."""
    from django.contrib.auth.models import Permission

    current = list(permissions or [])
    known = {
        f"{p.content_type.app_label}.{p.codename}": p
        for p in current
        if getattr(p, "content_type", None)
    }
    needed = expand_codenames(known.keys())
    missing = [c for c in needed if c not in known]
    if not missing:
        return current

    for full in missing:
        app_label, _, codename = full.partition(".")
        perm = Permission.objects.filter(
            content_type__app_label=app_label, codename=codename
        ).first()
        if perm:
            current.append(perm)
    return current
