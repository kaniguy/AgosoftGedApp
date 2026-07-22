"""Application temporaire de zones ajustées côté client (rattachement document)."""

from __future__ import annotations

import json
from typing import Any


class ZoneOverrideChamp:
    """Proxy lecture seule : coordonnées de zone surchargées pour l'extraction."""

    __slots__ = ("_champ", "_override")

    def __init__(self, champ, override: dict | None = None):
        self._champ = champ
        self._override = override or {}

    @property
    def id(self):
        return self._champ.id

    @property
    def capture_page(self):
        if "capture_page" in self._override:
            return self._override["capture_page"]
        return self._champ.capture_page

    @property
    def zone_x(self):
        if "zone_x" in self._override:
            return self._override["zone_x"]
        return self._champ.zone_x

    @property
    def zone_y(self):
        if "zone_y" in self._override:
            return self._override["zone_y"]
        return self._champ.zone_y

    @property
    def zone_width(self):
        if "zone_width" in self._override:
            return self._override["zone_width"]
        return self._champ.zone_width

    @property
    def zone_height(self):
        if "zone_height" in self._override:
            return self._override["zone_height"]
        return self._champ.zone_height

    @property
    def has_capture_zone(self):
        return (
            self.zone_x is not None
            and self.zone_y is not None
            and self.zone_width is not None
            and self.zone_height is not None
            and self.zone_width > 0
            and self.zone_height > 0
        )

    def __getattr__(self, name: str):
        return getattr(self._champ, name)


def parse_zone_overrides(raw: Any) -> dict[int, dict]:
    """Parse le JSON `zone_overrides` envoyé par le frontend."""
    if not raw:
        return {}

    payload = raw
    if isinstance(raw, str):
        try:
            payload = json.loads(raw)
        except json.JSONDecodeError:
            return {}

    if not isinstance(payload, list):
        return {}

    result: dict[int, dict] = {}
    for item in payload:
        if not isinstance(item, dict):
            continue
        try:
            champ_id = int(item["champ_id"])
            result[champ_id] = {
                "capture_page": int(item.get("capture_page", 0)),
                "zone_x": float(item["zone_x"]),
                "zone_y": float(item["zone_y"]),
                "zone_width": float(item["zone_width"]),
                "zone_height": float(item["zone_height"]),
            }
        except (KeyError, TypeError, ValueError):
            continue
    return result


def parse_ocr_pages(raw: Any) -> set[int] | None:
    """Parse la liste optionnelle de pages (0-based) à traiter pour l'OCR."""
    if not raw:
        return None

    payload = raw
    if isinstance(raw, str):
        try:
            payload = json.loads(raw)
        except json.JSONDecodeError:
            payload = [p.strip() for p in raw.split(",") if p.strip()]

    if isinstance(payload, int):
        payload = [payload]

    if not isinstance(payload, (list, tuple, set)):
        return None

    pages: set[int] = set()
    for item in payload:
        try:
            pages.add(int(item))
        except (TypeError, ValueError):
            continue
    return pages or None


def apply_zone_overrides(champs, overrides: dict[int, dict]):
    """Retourne la liste des champs avec zones éventuellement surchargées."""
    if not overrides:
        return champs
    return [
        ZoneOverrideChamp(champ, overrides.get(champ.id))
        if overrides.get(champ.id)
        else champ
        for champ in champs
    ]
