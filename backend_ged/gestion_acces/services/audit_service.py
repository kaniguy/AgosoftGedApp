"""Enregistrement des événements du journal d'activité."""

import re

from gestion_acces.models.journal_activite import JournalActivite


def get_client_ip(request):
    if not request:
        return None
    forwarded = request.META.get("HTTP_X_FORWARDED_FOR")
    if forwarded:
        return forwarded.split(",")[0].strip() or None
    return request.META.get("REMOTE_ADDR") or None


def get_user_agent(request):
    if not request:
        return ""
    return (request.META.get("HTTP_USER_AGENT") or "")[:512]


def log_activite(
    *,
    action,
    description,
    user=None,
    username=None,
    categorie=JournalActivite.Categorie.AUTRE,
    objet_type="",
    objet_id="",
    details=None,
    request=None,
    methode_http=None,
    chemin=None,
):
    """Crée une entrée de journal. Ne lève jamais d'exception vers l'appelant."""
    try:
        nom = (username or "").strip()
        if not nom and user is not None and getattr(user, "is_authenticated", False):
            nom = getattr(user, "username", "") or ""

        ip = get_client_ip(request) if request is not None else None
        ua = get_user_agent(request) if request is not None else ""
        methode = (
            methode_http
            if methode_http is not None
            else (getattr(request, "method", "") if request else "")
        )
        path = (
            chemin
            if chemin is not None
            else (getattr(request, "path", "") if request else "")
        )

        JournalActivite.objects.create(
            utilisateur=user if user is not None and getattr(user, "is_authenticated", False) else None,
            nom_utilisateur=nom[:150],
            action=action,
            categorie=categorie,
            description=(description or "")[:500],
            objet_type=(objet_type or "")[:100],
            objet_id=str(objet_id or "")[:64],
            details=details if isinstance(details, dict) else {},
            adresse_ip=ip,
            user_agent=ua,
            methode_http=(methode or "")[:10],
            chemin=(path or "")[:512],
        )
    except Exception:
        # Le journal ne doit jamais faire échouer l'action métier.
        pass


def mark_request_audited(request):
    if request is not None:
        setattr(request, "_ged_audit_logged", True)


# Endpoints techniques / bruit (pas d'intérêt métier dans le journal)
CHEMINS_EXCLUS_JOURNAL = (
    re.compile(r"/documents/extract-fields/?$", re.I),
    re.compile(r"/lots-brouillon/sync/?$", re.I),
)

ANNOTATION_DRAW_TYPES = {"highlight", "rect", "text", "pen"}


def compter_annotations_par_categorie(annotations):
    """Compte les éléments : annotations dessin, tampons, signatures."""
    counts = {"annotation": 0, "tampon": 0, "signature": 0}
    for ann in annotations or []:
        if not isinstance(ann, dict):
            continue
        t = str(ann.get("type") or "").lower()
        if t == "stamp":
            counts["tampon"] += 1
        elif t == "signature":
            counts["signature"] += 1
        elif t in ANNOTATION_DRAW_TYPES:
            counts["annotation"] += 1
    return counts


def log_modifications_document(
    *,
    request,
    document,
    annotations_avant=None,
    annotations_apres=None,
    fichier_modifie=False,
    valeurs_modifiees=False,
    type_modifie=False,
):
    """
    Journalise une mise à jour document avec détail annotations / tampon / signature.
    Marque la requête pour éviter un doublon middleware.
    """
    mark_request_audited(request)

    user = getattr(request, "user", None) if request else None
    doc_id = getattr(document, "id", "") or ""
    categorie = JournalActivite.Categorie.DOCUMENTS

    logged_specific = False
    if annotations_apres is not None:
        avant = compter_annotations_par_categorie(annotations_avant)
        apres = compter_annotations_par_categorie(annotations_apres)
        specs = [
            ("annotation", JournalActivite.Action.ANNOTER, "annotation(s)"),
            ("tampon", JournalActivite.Action.TAMPONNER, "tampon(s)"),
            ("signature", JournalActivite.Action.SIGNER, "signature(s)"),
        ]
        for key, action, label in specs:
            if apres[key] == avant[key]:
                continue
            if apres[key] > avant[key]:
                delta = apres[key] - avant[key]
                description = f"Ajout de {delta} {label} sur le document #{doc_id}"
            elif apres[key] == 0:
                description = f"Suppression des {label} du document #{doc_id}"
            else:
                description = (
                    f"Modification des {label} sur le document #{doc_id} "
                    f"({avant[key]} → {apres[key]})"
                )
            log_activite(
                action=action,
                description=description,
                user=user,
                categorie=categorie,
                objet_type="document",
                objet_id=doc_id,
                request=request,
                details={"avant": avant[key], "apres": apres[key], "type": key},
            )
            logged_specific = True

        # Déplacement / édition sans changement de quantité
        if not logged_specific and list(annotations_avant or []) != list(annotations_apres or []):
            presents = [k for k, _, __ in specs if apres[k] > 0 or avant[k] > 0]
            if not presents:
                presents = ["annotation"]
            label_map = {
                "annotation": ("annotation(s)", JournalActivite.Action.ANNOTER),
                "tampon": ("tampon(s)", JournalActivite.Action.TAMPONNER),
                "signature": ("signature(s)", JournalActivite.Action.SIGNER),
            }
            for key in presents:
                label, action = label_map[key]
                log_activite(
                    action=action,
                    description=f"Modification des {label} sur le document #{doc_id}",
                    user=user,
                    categorie=categorie,
                    objet_type="document",
                    objet_id=doc_id,
                    request=request,
                )
                logged_specific = True

    autres = []
    if fichier_modifie:
        autres.append("fichier")
    if valeurs_modifiees:
        autres.append("champs")
    if type_modifie:
        autres.append("type de document")

    if autres:
        log_activite(
            action=JournalActivite.Action.MODIFICATION,
            description=f"Modification du document #{doc_id} ({', '.join(autres)})",
            user=user,
            categorie=categorie,
            objet_type="document",
            objet_id=doc_id,
            request=request,
        )
        logged_specific = True

    if not logged_specific:
        log_activite(
            action=JournalActivite.Action.MODIFICATION,
            description=f"Modification du document #{doc_id}",
            user=user,
            categorie=categorie,
            objet_type="document",
            objet_id=doc_id,
            request=request,
        )


# Règles métier : (regex path, méthodes, action, description_fn, catégorie)
_REGLES_METIER = [
    (
        re.compile(r"/documents/(?P<id>\d+)/controle-qualite/soumettre/?$", re.I),
        {"POST"},
        JournalActivite.Action.SOUMETTRE_QC,
        lambda m, sc: f"Soumission au contrôle qualité du document #{m.group('id')}",
        JournalActivite.Categorie.DOCUMENTS,
    ),
    (
        re.compile(r"/documents/(?P<id>\d+)/controle-qualite/valider/?$", re.I),
        {"POST"},
        JournalActivite.Action.VALIDER_QC,
        lambda m, sc: f"Validation (contrôle qualité) du document #{m.group('id')}",
        JournalActivite.Categorie.DOCUMENTS,
    ),
    (
        re.compile(r"/documents/(?P<id>\d+)/controle-qualite/rejeter/?$", re.I),
        {"POST"},
        JournalActivite.Action.REJETER_QC,
        lambda m, sc: f"Rejet (contrôle qualité) du document #{m.group('id')}",
        JournalActivite.Categorie.DOCUMENTS,
    ),
    (
        re.compile(r"/documents/(?P<id>\d+)/commentaires/?$", re.I),
        {"POST"},
        JournalActivite.Action.COMMENTER,
        lambda m, sc: f"Ajout d'une note sur le document #{m.group('id')}",
        JournalActivite.Categorie.DOCUMENTS,
    ),
    (
        re.compile(r"/documents/(?P<id>\d+)/commentaires/(?P<cid>\d+)/?$", re.I),
        {"PUT", "PATCH"},
        JournalActivite.Action.COMMENTER,
        lambda m, sc: f"Modification d'une note sur le document #{m.group('id')}",
        JournalActivite.Categorie.DOCUMENTS,
    ),
    (
        re.compile(r"/documents/(?P<id>\d+)/commentaires/(?P<cid>\d+)/?$", re.I),
        {"DELETE"},
        JournalActivite.Action.COMMENTER,
        lambda m, sc: f"Suppression d'une note sur le document #{m.group('id')}",
        JournalActivite.Categorie.DOCUMENTS,
    ),
    (
        re.compile(r"/documents/(?P<id>\d+)/telecharger/?$", re.I),
        {"GET"},
        JournalActivite.Action.TELECHARGER,
        lambda m, sc: f"Téléchargement du document #{m.group('id')}",
        JournalActivite.Categorie.DOCUMENTS,
    ),
    (
        re.compile(r"/documents/telecharger-archive/?$", re.I),
        {"POST"},
        JournalActivite.Action.TELECHARGER,
        lambda m, sc: "Téléchargement d'une archive de documents",
        JournalActivite.Categorie.DOCUMENTS,
    ),
    (
        re.compile(r"/documents/(?P<id>\d+)/?$", re.I),
        {"PUT", "PATCH"},
        JournalActivite.Action.MODIFICATION,
        lambda m, sc: f"Modification du document #{m.group('id')}",
        JournalActivite.Categorie.DOCUMENTS,
    ),
    (
        re.compile(r"/documents/(?P<id>\d+)/?$", re.I),
        {"DELETE"},
        JournalActivite.Action.SUPPRESSION,
        lambda m, sc: f"Suppression du document #{m.group('id')}",
        JournalActivite.Categorie.DOCUMENTS,
    ),
    (
        re.compile(r"/documents/?$", re.I),
        {"POST"},
        JournalActivite.Action.CREATION,
        lambda m, sc: "Création d'un document",
        JournalActivite.Categorie.DOCUMENTS,
    ),
    (
        re.compile(r"/lots-brouillon/(?P<id>\d+)/?$", re.I),
        {"DELETE"},
        JournalActivite.Action.SUPPRESSION,
        lambda m, sc: f"Suppression du lot brouillon #{m.group('id')}",
        JournalActivite.Categorie.DOCUMENTS,
    ),
    (
        re.compile(r"/lots-brouillon/(?P<id>\d+)/?$", re.I),
        {"PUT", "PATCH"},
        JournalActivite.Action.MODIFICATION,
        lambda m, sc: f"Modification du lot brouillon #{m.group('id')}",
        JournalActivite.Categorie.DOCUMENTS,
    ),
    (
        re.compile(r"/lots-brouillon/?$", re.I),
        {"POST"},
        JournalActivite.Action.CREATION,
        lambda m, sc: "Création d'un lot brouillon",
        JournalActivite.Categorie.DOCUMENTS,
    ),
    # —— Gestion des accès ——
    (
        re.compile(r"/users/(?P<id>\d+)/?$", re.I),
        {"PUT", "PATCH"},
        JournalActivite.Action.MODIFICATION,
        lambda m, sc: f"Modification d'un utilisateur (#{m.group('id')})",
        JournalActivite.Categorie.UTILISATEURS,
    ),
    (
        re.compile(r"/users/(?P<id>\d+)/?$", re.I),
        {"DELETE"},
        JournalActivite.Action.SUPPRESSION,
        lambda m, sc: f"Suppression d'un utilisateur (#{m.group('id')})",
        JournalActivite.Categorie.UTILISATEURS,
    ),
    (
        re.compile(r"/users/?$", re.I),
        {"POST"},
        JournalActivite.Action.CREATION,
        lambda m, sc: "Création d'un utilisateur",
        JournalActivite.Categorie.UTILISATEURS,
    ),
    (
        re.compile(r"/groups/(?P<id>\d+)/?$", re.I),
        {"PUT", "PATCH"},
        JournalActivite.Action.MODIFICATION,
        lambda m, sc: f"Modification d'un groupe (#{m.group('id')})",
        JournalActivite.Categorie.GROUPES,
    ),
    (
        re.compile(r"/groups/(?P<id>\d+)/?$", re.I),
        {"DELETE"},
        JournalActivite.Action.SUPPRESSION,
        lambda m, sc: f"Suppression d'un groupe (#{m.group('id')})",
        JournalActivite.Categorie.GROUPES,
    ),
    (
        re.compile(r"/groups/?$", re.I),
        {"POST"},
        JournalActivite.Action.CREATION,
        lambda m, sc: "Création d'un groupe",
        JournalActivite.Categorie.GROUPES,
    ),
    (
        re.compile(r"/liens-telechargement/(?P<id>\d+)/envoyer-email/?$", re.I),
        {"POST"},
        JournalActivite.Action.ENVOYER_EMAIL,
        lambda m, sc: f"Envoi par e-mail du lien de téléchargement #{m.group('id')}",
        JournalActivite.Categorie.LIENS,
    ),
    (
        re.compile(r"/liens-telechargement/(?P<id>\d+)/?$", re.I),
        {"PUT", "PATCH"},
        JournalActivite.Action.MODIFICATION,
        lambda m, sc: f"Modification du lien de téléchargement #{m.group('id')}",
        JournalActivite.Categorie.LIENS,
    ),
    (
        re.compile(r"/liens-telechargement/(?P<id>\d+)/?$", re.I),
        {"DELETE"},
        JournalActivite.Action.SUPPRESSION,
        lambda m, sc: f"Suppression du lien de téléchargement #{m.group('id')}",
        JournalActivite.Categorie.LIENS,
    ),
    (
        re.compile(r"/liens-telechargement/?$", re.I),
        {"POST"},
        JournalActivite.Action.CREATION,
        lambda m, sc: "Création d'un lien de téléchargement",
        JournalActivite.Categorie.LIENS,
    ),
    (
        re.compile(r"/entreprise/reset/?$", re.I),
        {"POST"},
        JournalActivite.Action.MODIFICATION,
        lambda m, sc: "Réinitialisation des informations de l'entreprise",
        JournalActivite.Categorie.ENTREPRISE,
    ),
    (
        re.compile(r"/entreprise/update/?$", re.I),
        {"PUT", "PATCH"},
        JournalActivite.Action.MODIFICATION,
        lambda m, sc: "Modification des informations de l'entreprise",
        JournalActivite.Categorie.ENTREPRISE,
    ),
    (
        re.compile(r"/configuration-email/update/?$", re.I),
        {"PUT", "PATCH"},
        JournalActivite.Action.MODIFICATION,
        lambda m, sc: "Modification de la configuration e-mail SMTP",
        JournalActivite.Categorie.CONFIGURATION_EMAIL,
    ),
    (
        re.compile(r"/profile/?$", re.I),
        {"PUT", "PATCH"},
        JournalActivite.Action.MODIFICATION,
        lambda m, sc: "Modification du profil utilisateur",
        JournalActivite.Categorie.UTILISATEURS,
    ),
    (
        re.compile(r"/signatures/(?P<id>\d+)/set_default/?$", re.I),
        {"POST"},
        JournalActivite.Action.MODIFICATION,
        lambda m, sc: f"Définition de la signature par défaut (#{m.group('id')})",
        JournalActivite.Categorie.UTILISATEURS,
    ),
    (
        re.compile(r"/signatures/(?P<id>\d+)/?$", re.I),
        {"DELETE"},
        JournalActivite.Action.SUPPRESSION,
        lambda m, sc: f"Suppression d'une signature utilisateur (#{m.group('id')})",
        JournalActivite.Categorie.UTILISATEURS,
    ),
    (
        re.compile(r"/signatures/?$", re.I),
        {"POST"},
        JournalActivite.Action.CREATION,
        lambda m, sc: "Création d'une signature utilisateur",
        JournalActivite.Categorie.UTILISATEURS,
    ),
    (
        re.compile(r"/journal-activite/export-excel/?$", re.I),
        {"GET"},
        JournalActivite.Action.TELECHARGER,
        lambda m, sc: "Export Excel du journal d'activité",
        JournalActivite.Categorie.JOURNAL,
    ),
    (
        re.compile(r"/type-?documents?/(?P<id>\d+)/?$", re.I),
        {"PUT", "PATCH"},
        JournalActivite.Action.MODIFICATION,
        lambda m, sc: f"Modification du type de document #{m.group('id')}",
        JournalActivite.Categorie.PARAMETRAGE,
    ),
    (
        re.compile(r"/type-?documents?/(?P<id>\d+)/?$", re.I),
        {"DELETE"},
        JournalActivite.Action.SUPPRESSION,
        lambda m, sc: f"Suppression du type de document #{m.group('id')}",
        JournalActivite.Categorie.PARAMETRAGE,
    ),
    (
        re.compile(r"/type-?documents?/?$", re.I),
        {"POST"},
        JournalActivite.Action.CREATION,
        lambda m, sc: "Création d'un type de document",
        JournalActivite.Categorie.PARAMETRAGE,
    ),
]


def chemin_a_exclure(path):
    p = path or ""
    return any(rx.search(p) for rx in CHEMINS_EXCLUS_JOURNAL)


def categorie_depuis_chemin(path):
    """Déduit une catégorie métier à partir du chemin API."""
    p = (path or "").lower()
    if "/auth/" in p:
        return JournalActivite.Categorie.AUTHENTIFICATION
    if "/configuration-email" in p:
        return JournalActivite.Categorie.CONFIGURATION_EMAIL
    if "/journal-activite" in p:
        return JournalActivite.Categorie.JOURNAL
    if "/users" in p or "/profile" in p or "/signatures" in p:
        return JournalActivite.Categorie.UTILISATEURS
    if "/groups" in p:
        return JournalActivite.Categorie.GROUPES
    if "/liens-telechargement" in p or "/telechargement/" in p:
        return JournalActivite.Categorie.LIENS
    if "/entreprise" in p:
        return JournalActivite.Categorie.ENTREPRISE
    if "/documents" in p or "/lot" in p or "/gestion-documentaire" in p:
        return JournalActivite.Categorie.DOCUMENTS
    if "/parametrage" in p or "/type-document" in p or "/champs" in p or "/plan" in p or "/structure" in p:
        return JournalActivite.Categorie.PARAMETRAGE
    return JournalActivite.Categorie.AUTRE


def action_depuis_methode(method):
    mapping = {
        "POST": JournalActivite.Action.CREATION,
        "PUT": JournalActivite.Action.MODIFICATION,
        "PATCH": JournalActivite.Action.MODIFICATION,
        "DELETE": JournalActivite.Action.SUPPRESSION,
        "GET": JournalActivite.Action.AUTRE,
    }
    return mapping.get((method or "").upper(), JournalActivite.Action.AUTRE)


def interpreter_requete_api(method, path, status_code=200):
    """
    Traduit une requête API en action / description métier lisibles.
    Retourne None si l'événement ne doit pas être journalisé.
    """
    method = (method or "").upper()
    path = path or ""

    if chemin_a_exclure(path):
        return None

    for regex, methods, action, desc_fn, categorie in _REGLES_METIER:
        if methods and method not in methods:
            continue
        match = regex.search(path)
        if not match:
            continue
        objet_id = match.groupdict().get("id") or ""
        return {
            "action": action,
            "description": desc_fn(match, status_code),
            "categorie": categorie,
            "objet_type": categorie,
            "objet_id": objet_id,
            "skip_chemin_display": True,
        }

    # GET hors téléchargement : ne pas journaliser (évite le bruit de lecture)
    if method == "GET":
        return None

    action = action_depuis_methode(method)
    categorie = categorie_depuis_chemin(path)
    labels = {
        JournalActivite.Action.CREATION: "Création",
        JournalActivite.Action.MODIFICATION: "Modification",
        JournalActivite.Action.SUPPRESSION: "Suppression",
    }
    label = labels.get(action, "Action")
    ressource = {
        JournalActivite.Categorie.DOCUMENTS: "documentaire",
        JournalActivite.Categorie.UTILISATEURS: "utilisateurs",
        JournalActivite.Categorie.GROUPES: "groupes",
        JournalActivite.Categorie.PARAMETRAGE: "paramétrage",
        JournalActivite.Categorie.LIENS: "liens",
        JournalActivite.Categorie.ENTREPRISE: "entreprise",
    }.get(categorie, "application")
    return {
        "action": action,
        "description": f"{label} — module {ressource}",
        "categorie": categorie,
        "objet_type": categorie,
        "objet_id": "",
        "skip_chemin_display": True,
    }
