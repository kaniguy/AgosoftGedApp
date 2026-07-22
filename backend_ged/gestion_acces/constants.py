# Liste des modules applicatifs assignables aux groupes (miroir du tableau de bord frontend)
APP_MODULES = [
    {
        "code": "parametrage",
        "label": "Paramétrage",
        "description": "Configuration du système",
        "app_labels": ["parametrage"],
    },
    {
        "code": "gestion_documentaire",
        "label": "Gestion Documentaire",
        "description": "Plan géographique et documents",
        "app_labels": ["gestion_documentaire"],
        "extra_permission_codenames": [
            "gestion_documentaire.annoter_document",
            "gestion_documentaire.tamponner_document",
            "gestion_documentaire.signer_document",
            "gestion_documentaire.commenter_document",
        ],
    },
    {
        "code": "recherche_avancee",
        "label": "Recherche Avancée",
        "description": "Recherche multi-critères sur les documents",
        "app_labels": ["gestion_documentaire"],
        "extra_permission_codenames": [
            "gestion_acces.add_lientelechargement",
        ],
    },
    {
        "code": "controle_qualite",
        "label": "Contrôle qualité",
        "description": "Buckets par localité du dernier niveau",
        "app_labels": ["gestion_documentaire"],
    },
    {
        "code": "analytique",
        "label": "Analytique & Rapports",
        "description": "Tableaux de bord et rapports",
        "app_labels": [],
    },
    {
        "code": "gestion_acces",
        "label": "Gestion des accès",
        "description": "Utilisateurs, groupes et permissions",
        "app_labels": ["gestion_acces", "auth"],
    },
    {
        "code": "aide_video",
        "label": "Aide Vidéo",
        "description": "Tutoriels et guides",
        "app_labels": [],
    },
    {
        "code": "a_propos",
        "label": "À Propos d'AGSOFT",
        "description": "Informations sur l'entreprise",
        "app_labels": [],
    },
]

VALID_MODULE_CODES = {m["code"] for m in APP_MODULES}

# Association module applicatif → apps Django (permissions filtrées par app_label)
MODULE_APP_LABELS = {m["code"]: m.get("app_labels", []) for m in APP_MODULES}


def get_app_labels_for_modules(module_codes):
    """Retourne les app_labels Django correspondant aux modules sélectionnés."""
    labels = set()
    for code in module_codes or []:
        labels.update(MODULE_APP_LABELS.get(code, []))
    return labels


def get_extra_permission_codenames_for_modules(module_codes):
    """Permissions Django assignables en plus des app_labels (ex. création de liens depuis la recherche)."""
    codenames = set()
    for code in module_codes or []:
        for module in APP_MODULES:
            if module["code"] == code:
                codenames.update(module.get("extra_permission_codenames", []))
                break
    return codenames
