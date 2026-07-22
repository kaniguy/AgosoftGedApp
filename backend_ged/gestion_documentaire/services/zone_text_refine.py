"""Raffinement du texte OCR extrait d'une zone selon le type/libellé du champ."""

from __future__ import annotations

import re

DATE_PATTERN = re.compile(r"\d{2}[/.-]\d{2}[/.-]\d{4}")
INVOICE_NUMBER_PATTERN = re.compile(r"[A-Z]{2,}[-\s]?\d+")
ORDER_NUMBER_PATTERN = re.compile(r"\d{3,}/\d{4}")
AMOUNT_PATTERN = re.compile(r"-?\d+(?:[.,]\d+)?")
# Milliers français : 4 731 / 1 234 567,89 — points européens : 1.234,56
GROUPED_AMOUNT_PATTERN = re.compile(
    r"-?\d{1,3}(?:[ \u00a0]\d{3})+(?:[.,]\d{1,2})?"
)
EUROPEAN_AMOUNT_PATTERN = re.compile(
    r"-?\d{1,3}(?:\.\d{3})+(?:,\d{1,2})?"
)


def _strip_label_prefix(raw: str) -> str:
    """Retire un libellé en tête de zone (ex. « Facturé à »)."""
    lowered = raw.lower().strip()
    for prefix in (
        "facturé à",
        "facture a",
        "facturé a",
        "envoyé à",
        "envoye a",
        "envoyé a",
    ):
        if lowered.startswith(prefix):
            return raw[len(prefix) :].strip(" :;-\n")
    return raw


def _is_multiline_champ(champ) -> bool:
    """Indique si le champ doit conserver plusieurs lignes (adresses, texte long)."""
    libelle = (champ.libelle_champ or "").lower()
    if champ.type_champ in ("texte_long",):
        return True
    return any(key in libelle for key in ("factur", "envoy", "adresse"))


def _is_amount_champ(champ) -> bool:
    """Indique si le champ attend un montant ou un nombre."""
    if champ.type_champ == "nombre":
        return True
    libelle = (champ.libelle_champ or "").lower()
    return any(key in libelle for key in ("total", "tva", "montant", " ht", "ht ", "ttc"))


def _amount_to_float(token: str) -> float:
    """Convertit un token monétaire en float pour comparaison."""
    cleaned = token.strip().replace("\u00a0", "").replace(" ", "")
    if "," in cleaned and "." in cleaned:
        cleaned = cleaned.replace(".", "").replace(",", ".")
    elif "," in cleaned:
        parts = cleaned.split(",")
        if len(parts) == 2 and len(parts[1]) <= 2:
            cleaned = f"{parts[0]}.{parts[1]}"
        else:
            cleaned = cleaned.replace(",", "")
    else:
        cleaned = cleaned.replace(",", ".")
    cleaned = re.sub(r"[^\d.\-]", "", cleaned)
    try:
        return float(cleaned)
    except ValueError:
        return 0.0


def score_zone_extraction(text: str, confidence: float, champ) -> float:
    """Score un résultat OCR pour choisir la meilleure tentative (marge normale vs élargie)."""
    if not text or not str(text).strip():
        return -1.0

    score = float(confidence)
    stripped = str(text).strip()

    if _is_amount_champ(champ):
        score += min(_amount_to_float(stripped) / 500.0, 0.35)

    libelle = (champ.libelle_champ or "").lower()
    if champ.type_champ == "date" or "date" in libelle or "échéance" in libelle or "echeance" in libelle:
        if DATE_PATTERN.search(stripped):
            score += 0.15

    if len(stripped) > 3:
        score += min(len(stripped) / 120.0, 0.12)

    return score


def _amount_token_to_storage(token: str) -> str:
    """Normalise un montant OCR pour stockage (ex. « 4 731,50 » → « 4731.5 »)."""
    value = _amount_to_float(token)
    if value == int(value):
        return str(int(value))
    formatted = f"{value:.2f}".rstrip("0").rstrip(".")
    return formatted


def _best_amount_token(text: str) -> str:
    """Choisit le montant le plus plausible en gérant les séparateurs de milliers."""
    normalized = re.sub(r"\s+", " ", text.replace("\u00a0", " ")).strip()
    if not normalized:
        return ""

    candidates: list[str] = []

    candidates.extend(GROUPED_AMOUNT_PATTERN.findall(normalized))
    candidates.extend(EUROPEAN_AMOUNT_PATTERN.findall(normalized))

    # « 4 731 » lu comme deux nombres : fusionner les espaces entre chiffres
    compact = re.sub(r"(?<=\d)[ \u00a0](?=\d)", "", normalized)
    candidates.extend(AMOUNT_PATTERN.findall(compact))

    if candidates:
        best = max(candidates, key=lambda token: (_amount_to_float(token), len(token)))
        return _amount_token_to_storage(best)

    return normalized.strip()


def assemble_crop_text(lines: list[dict], champ) -> tuple[str, float]:
    """
    Assemble les lignes OCR d'un crop selon la nature du champ.
    - Adresses : toutes les lignes
    - Montants / codes courts : une seule rangée dominante
    """
    if not lines:
        return "", 0.0

    if len(lines) == 1:
        line = lines[0]
        return line.get("text", "").strip(), float(line.get("confidence", 0.0))

    sorted_lines = sorted(lines, key=lambda row: (row.get("cy", 0.0), row.get("cx", 0.0)))

    if _is_multiline_champ(champ):
        texts = [row.get("text", "").strip() for row in sorted_lines if row.get("text")]
        confidences = [float(row.get("confidence", 0.0)) for row in sorted_lines if row.get("text")]
        joined = "\n".join(texts)
        avg_conf = sum(confidences) / len(confidences) if confidences else 0.0
        return joined, avg_conf

    # Une seule rangée horizontale pour codes, dates, montants
    rows: list[list[dict]] = []
    current = [sorted_lines[0]]
    for line in sorted_lines[1:]:
        if abs(line.get("cy", 0.0) - current[-1].get("cy", 0.0)) < 0.22:
            current.append(line)
        else:
            rows.append(current)
            current = [line]
    rows.append(current)

    best_row = max(rows, key=lambda row: sum(len(item.get("text", "")) for item in row))
    best_row.sort(key=lambda row: row.get("cx", 0.0))
    texts = [item.get("text", "").strip() for item in best_row if item.get("text")]
    confidences = [float(item.get("confidence", 0.0)) for item in best_row if item.get("text")]
    full_text = " ".join(texts).strip()
    avg_conf = sum(confidences) / len(confidences) if confidences else 0.0
    return full_text, avg_conf


def refine_raw_for_champ(raw: str, champ) -> str:
    """
    Nettoie le texte OCR sans tronquer les adresses ni les textes longs.
    """
    if not raw:
        return ""

    text = raw.replace("\r\n", "\n").strip()
    libelle = (champ.libelle_champ or "").lower()
    champ_type = champ.type_champ

    if _is_multiline_champ(champ):
        lines = [_strip_label_prefix(line) for line in text.split("\n")]
        lines = [re.sub(r"[ \t]+", " ", line).strip() for line in lines if line.strip()]
        # Champs « texte » courts : une ligne avec virgules pour le formulaire
        if champ.type_champ == "texte":
            return ", ".join(lines)
        return "\n".join(lines)

    # Une seule ligne logique pour les autres champs
    text = re.sub(r"\s+", " ", text).strip()

    if champ_type == "date" or "date" in libelle or "échéance" in libelle or "echeance" in libelle:
        match = DATE_PATTERN.search(text)
        return match.group(0) if match else text

    if champ_type == "nombre" or _is_amount_champ(champ):
        return _best_amount_token(text)

    if "facture" in libelle and ("n°" in libelle or "n " in libelle or libelle.endswith(" n")):
        match = INVOICE_NUMBER_PATTERN.search(text)
        if match:
            return match.group(0).replace(" ", "-")
        without_dates = DATE_PATTERN.sub("", text).strip()
        return without_dates.split()[0] if without_dates else text

    if "commande" in libelle:
        match = ORDER_NUMBER_PATTERN.search(text)
        if match:
            return match.group(0)
        without_dates = DATE_PATTERN.sub("", text).strip()
        return without_dates.split()[0] if without_dates else text

    return text
