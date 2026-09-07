"""Droits d'accès au module contrôle qualité (menus, statuts, actions)."""

from gestion_acces.services.access_service import get_user_modules
from gestion_documentaire.models import DocumentLocalite

PERM_VIEW = "gestion_documentaire.view_documentlocalite"
PERM_CHANGE = "gestion_documentaire.change_documentlocalite"
PERM_QC_SOUMETTRE = "gestion_documentaire.qc_soumettre"
PERM_QC_VALIDER = "gestion_documentaire.qc_valider"
PERM_QC_REJETER = "gestion_documentaire.qc_rejeter"
PERM_QC_MENU_EN_ATTENTE = "gestion_documentaire.qc_menu_en_attente"
PERM_QC_MENU_BROUILLON = "gestion_documentaire.qc_menu_brouillon"
PERM_QC_MENU_REJETE = "gestion_documentaire.qc_menu_rejete"
PERM_QC_MENU_VALIDE = "gestion_documentaire.qc_menu_valide"

MENU_PERM_BY_STATUT = {
    DocumentLocalite.STATUT_EN_ATTENTE: PERM_QC_MENU_EN_ATTENTE,
    DocumentLocalite.STATUT_BROUILLON: PERM_QC_MENU_BROUILLON,
    DocumentLocalite.STATUT_REJETE: PERM_QC_MENU_REJETE,
    DocumentLocalite.STATUT_VALIDE: PERM_QC_MENU_VALIDE,
}

STATUTS_QC = [
    DocumentLocalite.STATUT_BROUILLON,
    DocumentLocalite.STATUT_EN_ATTENTE,
    DocumentLocalite.STATUT_REJETE,
    DocumentLocalite.STATUT_VALIDE,
]

# Statuts affichés dans les menus QC (brouillon géré via gestion documentaire)
STATUTS_QC_MENU = [
    DocumentLocalite.STATUT_EN_ATTENTE,
    DocumentLocalite.STATUT_REJETE,
    DocumentLocalite.STATUT_VALIDE,
]


def user_has_controle_qualite_module(user):
    if not user or not user.is_authenticated:
        return False
    if user.is_superuser:
        return True
    return "controle_qualite" in get_user_modules(user)


def user_has_perm(user, perm):
    if not user or not user.is_authenticated:
        return False
    if user.is_superuser:
        return True
    return user.has_perm(perm)


def user_can_view_menu_statut(user, statut):
    if not user_has_controle_qualite_module(user) or not user_has_perm(user, PERM_VIEW):
        return False
    menu_perm = MENU_PERM_BY_STATUT.get(statut)
    if not menu_perm:
        return False
    return user_has_perm(user, menu_perm)


def user_can_view_statut_qualite(user, statut):
    return user_can_view_menu_statut(user, statut)


def user_can_filter_documents_by_statut(user, statut):
    """Filtre API liste documents : archives validées et brouillons GD visibles avec view_documentlocalite."""
    if statut in (DocumentLocalite.STATUT_VALIDE, DocumentLocalite.STATUT_BROUILLON):
        return user_has_perm(user, PERM_VIEW)
    return user_can_view_menu_statut(user, statut)


def user_visible_statuts_qualite(user):
    return [s for s in STATUTS_QC_MENU if user_can_view_menu_statut(user, s)]


def user_can_access_controle_qualite(user):
    if not user_has_controle_qualite_module(user) or not user_has_perm(user, PERM_VIEW):
        return False
    return bool(user_visible_statuts_qualite(user))


def user_can_prepare_qc(user):
    return user_has_controle_qualite_module(user) and user_has_perm(user, PERM_CHANGE)


def user_can_soumettre_qc(user):
    return user_has_controle_qualite_module(user) and user_has_perm(user, PERM_QC_SOUMETTRE)


def user_can_valider_qc(user):
    return user_has_controle_qualite_module(user) and user_has_perm(user, PERM_QC_VALIDER)


def user_can_rejeter_qc(user):
    return user_has_controle_qualite_module(user) and user_has_perm(user, PERM_QC_REJETER)


def user_can_open_document_qc(user, statut):
    if not user_can_view_menu_statut(user, statut):
        return False
    if statut == DocumentLocalite.STATUT_VALIDE:
        return user_has_perm(user, PERM_VIEW)
    if statut == DocumentLocalite.STATUT_EN_ATTENTE:
        return user_can_valider_qc(user) or user_can_rejeter_qc(user)
    if statut in (DocumentLocalite.STATUT_BROUILLON, DocumentLocalite.STATUT_REJETE):
        return user_can_prepare_qc(user)
    return False
