"""Associe le texte OCR aux champs dynamiques d'un type de document."""

from __future__ import annotations

import re
import unicodedata
from difflib import SequenceMatcher


DATE_PATTERNS = [
  (re.compile(r"(\d{4})-(\d{2})-(\d{2})"), lambda m: f"{m.group(1)}-{m.group(2)}-{m.group(3)}"),
  (re.compile(r"(\d{2})[/.-](\d{2})[/.-](\d{4})"), lambda m: f"{m.group(3)}-{m.group(2)}-{m.group(1)}"),
  (re.compile(r"(\d{2})[/.-](\d{2})[/.-](\d{2})"), lambda m: f"20{m.group(3)}-{m.group(2)}-{m.group(1)}"),
]

DATETIME_PATTERNS = [
  (
    re.compile(r"(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})"),
    lambda m: f"{m.group(1)}-{m.group(2)}-{m.group(3)}T{m.group(4)}:{m.group(5)}",
  ),
  (
    re.compile(r"(\d{2})[/.-](\d{2})[/.-](\d{4})\s+(\d{2}):(\d{2})"),
    lambda m: f"{m.group(3)}-{m.group(2)}-{m.group(1)}T{m.group(4)}:{m.group(5)}",
  ),
]

NUMBER_PATTERN = re.compile(r"-?\d+(?:[.,]\d+)?")
AMOUNT_PATTERN = re.compile(
  r"-?\d{1,3}(?:[.\s\u00a0]\d{3})*(?:[.,]\d+)?|-?\d+(?:[.,]\d+)?"
)

# Mots qui prolongent un libellé (« Nom du vendeur », « Date et heure »)
_LABEL_CONNECTORS = frozenset({
  "du", "de", "des", "la", "le", "les", "d", "l", "et", "au", "aux", "en", "sur", "a",
})


def _normalize_text(value: str) -> str:
  if not value:
    return ""
  normalized = unicodedata.normalize("NFKD", value)
  normalized = "".join(ch for ch in normalized if not unicodedata.combining(ch))
  normalized = normalized.lower()
  normalized = re.sub(r"[^a-z0-9\s]", " ", normalized)
  return re.sub(r"\s+", " ", normalized).strip()


def _similarity(a: str, b: str) -> float:
  if not a or not b:
    return 0.0
  return SequenceMatcher(None, a, b).ratio()


def _parse_date(value: str) -> str | None:
  for pattern, formatter in DATE_PATTERNS:
    match = pattern.search(value)
    if match:
      return formatter(match)
  return None


def _parse_datetime(value: str) -> str | None:
  for pattern, formatter in DATETIME_PATTERNS:
    match = pattern.search(value)
    if match:
      return formatter(match)
  return None


def _parse_number(value: str) -> str | None:
  """Extrait le montant le plus plausible (évite de ne garder que le premier chiffre)."""
  from gestion_documentaire.services.zone_text_refine import _best_amount_token
  result = _best_amount_token(value or "")
  return result if result else None


def _clean_value(raw: str) -> str:
  return re.sub(r"\s+", " ", raw).strip(" :;,-")


def _looks_like_field_assignment(text: str) -> bool:
  """
  True si le texte ressemble à « Libellé : valeur » (autre champ),
  ex. « Nom de PDV : RIVIERA » / « Établissement : SOCOPRIX ».
  """
  if not text or not str(text).strip():
    return False
  return bool(
    re.match(
      r"^\s*[A-Za-zÀ-ÿ][A-Za-zÀ-ÿ0-9 \t'/°N°\-]{1,50}[ \t]*[:：][ \t]*\S",
      str(text).strip(),
    )
  )


def _is_empty_labeled_line(line: str, label: str) -> bool:
  """True pour « Nom du vendeur : » sans valeur."""
  return bool(
    re.match(
      rf"(?i)^\s*{re.escape(label.strip())}[ \t]*[:：][ \t]*$",
      line or "",
    )
  )


def _is_usable_value(value: str | None) -> bool:
  if not value or not str(value).strip():
    return False
  if _looks_like_field_assignment(value):
    return False
  return True


def _score_label_match(line: str, label: str) -> float:
  """
  Score la pertinence d'une ligne pour un libellé de champ.
  Évite qu'un champ court (« Nom ») matche « Nom du vendeur ».
  """
  norm_label = _normalize_text(label)
  norm_line = _normalize_text(line)
  if not norm_label or not norm_line:
    return -1.0

  # 1) Libellé exact suivi de « : » (meilleur cas)
  strict = re.compile(rf"(?i)^\s*{re.escape(label.strip())}[ \t]*[:：][ \t]*(.+)$")
  if strict.search(line):
    return 200.0 + len(norm_label)

  # Variante normalisée : début de ligne = libellé + reste (valeur)
  if norm_line == norm_label:
    return 150.0 + len(norm_label)

  if not norm_line.startswith(norm_label + " "):
    # Autorise « … Libellé : valeur » en milieu de ligne uniquement avec « : »
    mid = re.compile(rf"(?i)(?:^|[\s|;]){re.escape(label.strip())}[ \t]*[:：][ \t]*(.+)$")
    if mid.search(line):
      return 100.0 + len(norm_label)
    return -1.0

  remainder = norm_line[len(norm_label) + 1 :]
  rest_tokens = remainder.split()
  if not rest_tokens:
    return 150.0 + len(norm_label)

  # « Nom du vendeur … » = libellé plus long, pas le champ « Nom »
  if rest_tokens[0] in _LABEL_CONNECTORS:
    return -1.0

  # Libellé + valeur sur la même ligne
  return 80.0 + len(norm_label) - min(len(rest_tokens), 8) * 0.5


def _extract_value_from_matched_line(line: str, label: str) -> str | None:
  """Extrait la valeur une fois la ligne validée pour ce libellé."""
  if _is_empty_labeled_line(line, label):
    return None

  strict = re.compile(rf"(?i)^\s*{re.escape(label.strip())}[ \t]*[:：][ \t]*(.+)$")
  match = strict.search(line)
  if match:
    value = _clean_value(match.group(1))
    return value if _is_usable_value(value) else None

  mid = re.compile(rf"(?i)(?:^|[\s|;]){re.escape(label.strip())}[ \t]*[:：][ \t]*(.+)$")
  match = mid.search(line)
  if match:
    value = _clean_value(match.group(1))
    return value if _is_usable_value(value) else None

  parts = re.split(r"[:：]", line, maxsplit=1)
  if len(parts) == 2 and _normalize_text(parts[0]).endswith(_normalize_text(label)):
    value = _clean_value(parts[1])
    return value if _is_usable_value(value) else None

  norm_line = _normalize_text(line)
  norm_label = _normalize_text(label)
  if norm_line.startswith(norm_label + " "):
    original_parts = line.split()
    label_word_count = len(label.split())
    if len(original_parts) > label_word_count:
      value = _clean_value(" ".join(original_parts[label_word_count:]))
      return value if _is_usable_value(value) else None

  return None


def _find_label_matches(lines: list[str], label: str) -> list[tuple[float, int, str]]:
  """
  Toutes les lignes compatibles avec le libellé, triées par score puis ordre document.
  Permet d'assigner la 1ʳᵉ / 2ᵉ occurrence à des champs homonymes (ex. 2× NCC).
  """
  matches: list[tuple[float, int, str]] = []
  for index, line in enumerate(lines):
    score = _score_label_match(line, label)
    if score > 0:
      matches.append((score, index, line))
  matches.sort(key=lambda item: (-item[0], item[1]))
  return matches


def _match_option(value: str, options: list[str]) -> str | None:
  normalized_value = _normalize_text(value)
  if not normalized_value:
    return None

  best_option = None
  best_score = 0.0
  for option in options:
    normalized_option = _normalize_text(option)
    if not normalized_option:
      continue
    if normalized_option in normalized_value or normalized_value in normalized_option:
      return option
    score = _similarity(normalized_option, normalized_value)
    if score > best_score:
      best_score = score
      best_option = option

  if best_score >= 0.6:
    return best_option
  return None


def _format_value_for_type(raw_value: str, champ) -> str:
  value = _clean_value(raw_value)
  if not value or _looks_like_field_assignment(value):
    return ""

  champ_type = champ.type_champ
  if champ_type == "date":
    parsed = _parse_date(value)
    return parsed if parsed else ""
  if champ_type == "datetime":
    parsed = _parse_datetime(value) or _parse_date(value)
    return parsed if parsed else ""
  if champ_type == "nombre":
    parsed = _parse_number(value)
    return parsed if parsed else ""
  if champ_type in ("select", "choix"):
    options = [opt.valeur for opt in champ.options.all()]
    matched = _match_option(value, options)
    return matched or value
  return value


def _extract_raw_value(
  label: str,
  lines: list[str],
  full_text: str,
  used_line_indices: set[int] | None = None,
) -> str | None:
  """
  Extrait une valeur pour un libellé.
  used_line_indices : lignes déjà consommées (évite de dupliquer la 1ʳᵉ NCC sur 2 champs).
  """
  used = used_line_indices if used_line_indices is not None else set()

  # 1) Meilleure occurrence encore libre (ordre document pour scores égaux)
  for _score, index, line in _find_label_matches(lines, label):
    if index in used:
      continue

    # « Libellé : » vide → ne pas voler la ligne suivante (autre champ)
    if _is_empty_labeled_line(line, label):
      used.add(index)
      continue

    same_line = _extract_value_from_matched_line(line, label)
    if same_line:
      used.add(index)
      return same_line

    # Libellé seul (sans « : ») → valeur sur la ligne suivante UNIQUEMENT
    # si ce n'est pas déjà un autre « Libellé : valeur »
    if _normalize_text(line) == _normalize_text(label) and index + 1 < len(lines):
      if index + 1 in used:
        used.add(index)
        continue
      next_raw = lines[index + 1]
      if _looks_like_field_assignment(next_raw):
        used.add(index)
        continue
      next_line = _clean_value(next_raw)
      if next_line and _normalize_text(next_line) != _normalize_text(label) and _is_usable_value(next_line):
        used.add(index)
        used.add(index + 1)
        return next_line
      used.add(index)

  # 2) Recherche globale : occurrences « Libellé : valeur » non encore prises
  escaped = re.escape(label.strip())
  if not escaped:
    return None

  consumed_values = set()
  for idx in used:
    if 0 <= idx < len(lines):
      taken = _extract_value_from_matched_line(lines[idx], label)
      if taken:
        consumed_values.add(_normalize_text(taken))

  global_pattern = re.compile(
    rf"(?i)(?:^|[\n\r|;])[ \t]*{escaped}[ \t]*[:：][ \t]*([^\n\r]+)",
  )
  for match in global_pattern.finditer(full_text):
    snippet = _clean_value(match.group(1).strip())[:255]
    if not snippet or not _is_usable_value(snippet):
      continue
    if _normalize_text(snippet) in consumed_values:
      continue
    return snippet

  return None


def extract_field_values(champs, ocr_result: dict) -> list[dict]:
  """
  Retourne une liste de {champ_id, valeur, confidence}.
  Les champs au même libellé (ex. 2× NCC) reçoivent des occurrences distinctes.
  """
  lines = [line["text"] for line in ocr_result.get("lines", []) if line.get("text")]
  full_text = ocr_result.get("full_text", "")
  extracted: list[dict] = []
  used_line_indices: set[int] = set()

  for champ in champs:
    raw_value = _extract_raw_value(
      champ.libelle_champ,
      lines,
      full_text,
      used_line_indices=used_line_indices,
    )
    if not raw_value:
      continue

    valeur = _format_value_for_type(raw_value, champ)
    if not valeur:
      continue

    extracted.append({
      "champ_id": champ.id,
      "valeur": valeur,
      "confidence": 0.85,
    })

  return extracted
