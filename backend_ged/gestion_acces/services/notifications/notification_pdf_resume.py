"""Génération du PDF détaillé joint au résumé périodique."""

from __future__ import annotations

from datetime import datetime

import fitz
from django.utils import timezone

PAGE_WIDTH, PAGE_HEIGHT = fitz.paper_size("a4-l")
MARGIN = 24
HEADER_HEIGHT = 28
TITLE_HEIGHT = 52
LINE_HEIGHT = 10
CELL_PADDING = 5
FONT_SIZE = 7.5

ENTETES = [
    "Localisation",
    "Type de document",
    "Date d'enregistrement",
    "Importé par",
]


def _nom_utilisateur(user) -> str:
    if not user:
        return "—"
    nom = f"{user.first_name or ''} {user.last_name or ''}".strip()
    return nom or user.get_username()


def _chemin_geographique(localite) -> str:
    """Chemin complet de la localité, du niveau racine vers le plus fin."""
    parties = []
    courant = localite
    while courant is not None:
        if courant.libelle:
            parties.append(courant.libelle)
        courant = courant.parent
    return " / ".join(reversed(parties))


def _lignes_cellule(texte, largeur: float, *, gras=False) -> list[str]:
    """Découpe le texte en lignes tenant dans la largeur de la cellule."""
    fontname = "hebo" if gras else "helv"
    largeur_utile = largeur - 2 * CELL_PADDING
    lignes: list[str] = []
    for brut in str(texte or "—").splitlines() or ["—"]:
        courante = ""
        for mot in brut.split(" "):
            essai = f"{courante} {mot}".strip()
            if (
                not courante
                or fitz.get_text_length(essai, fontname=fontname, fontsize=FONT_SIZE)
                <= largeur_utile
            ):
                courante = essai
            else:
                lignes.append(courante)
                courante = mot
        lignes.append(courante)
    return lignes or ["—"]


def _dessiner_ligne(page, y, valeurs, largeurs, *, entete=False, alternee=False):
    cellules = [
        _lignes_cellule(valeur, largeur, gras=entete)
        for valeur, largeur in zip(valeurs, largeurs)
    ]
    if entete:
        hauteur = HEADER_HEIGHT
        fond = (0.96, 0.91, 0.72)
    else:
        max_lignes = max(len(lignes) for lignes in cellules)
        hauteur = max_lignes * LINE_HEIGHT + 2 * CELL_PADDING
        fond = (0.97, 0.98, 0.99) if alternee else (1, 1, 1)

    x = MARGIN
    for lignes, largeur in zip(cellules, largeurs):
        rect = fitz.Rect(x, y, x + largeur, y + hauteur)
        page.draw_rect(rect, color=(0.78, 0.80, 0.84), fill=fond, width=0.5)
        for index, ligne in enumerate(lignes):
            page.insert_text(
                (x + CELL_PADDING, y + CELL_PADDING + (index + 1) * LINE_HEIGHT - 2.5),
                ligne,
                fontsize=7 if entete else FONT_SIZE,
                fontname="hebo" if entete else "helv",
                color=(0.12, 0.16, 0.23),
            )
        x += largeur
    return y + hauteur


def _hauteur_ligne(valeurs, largeurs) -> float:
    max_lignes = max(
        len(_lignes_cellule(valeur, largeur))
        for valeur, largeur in zip(valeurs, largeurs)
    )
    return max_lignes * LINE_HEIGHT + 2 * CELL_PADDING


def _largeurs_colonnes() -> list[float]:
    largeur_disponible = PAGE_WIDTH - (2 * MARGIN)
    # Localisation, type, date et importateur.
    return [
        largeur_disponible * 0.38,
        largeur_disponible * 0.24,
        largeur_disponible * 0.14,
        largeur_disponible * 0.24,
    ]


def generer_pdf_resume(documents, destinataire, date_generation=None) -> bytes:
    """Retourne un PDF paysage contenant la liste détaillée du destinataire."""
    date_generation = date_generation or timezone.localtime(timezone.now())
    largeurs = _largeurs_colonnes()

    pdf = fitz.open()
    page = None
    y = 0.0

    def nouvelle_page():
        nonlocal page, y
        page = pdf.new_page(width=PAGE_WIDTH, height=PAGE_HEIGHT)
        page.insert_text(
            (MARGIN, MARGIN + 12),
            "Documents en attente de contrôle qualité",
            fontsize=14,
            fontname="hebo",
            color=(0.29, 0.13, 0.55),
        )
        sous_titre = (
            f"Destinataire : {_nom_utilisateur(destinataire)}  •  "
            f"Généré le {date_generation.strftime('%d/%m/%Y à %H:%M')}  •  "
            f"{len(documents)} document(s)"
        )
        page.insert_text(
            (MARGIN, MARGIN + 30),
            sous_titre,
            fontsize=8,
            fontname="helv",
            color=(0.35, 0.39, 0.47),
        )
        y = MARGIN + TITLE_HEIGHT
        y = _dessiner_ligne(page, y, ENTETES, largeurs, entete=True)

    nouvelle_page()
    for index, document in enumerate(documents):
        importe_par = _nom_utilisateur(document.created_by)
        if document.created_by and document.created_by.email:
            importe_par = f"{importe_par}\n{document.created_by.email}"
        valeurs = [
            _chemin_geographique(document.localite),
            f"{document.type_document.libelle} (#{document.pk})",
            timezone.localtime(document.date_creation).strftime("%d/%m/%Y %H:%M"),
            importe_par,
        ]
        if y + _hauteur_ligne(valeurs, largeurs) > PAGE_HEIGHT - MARGIN:
            nouvelle_page()
        y = _dessiner_ligne(
            page,
            y,
            valeurs,
            largeurs,
            alternee=index % 2 == 1,
        )

    contenu = pdf.tobytes(garbage=3, deflate=True)
    pdf.close()
    return contenu


def nom_fichier_pdf(date_generation: datetime | None = None) -> str:
    date_generation = date_generation or timezone.localtime(timezone.now())
    return f"documents_en_attente_{date_generation.strftime('%Y%m%d_%H%M')}.pdf"
