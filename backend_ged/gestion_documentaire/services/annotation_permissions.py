"""Droits d'édition des annotations (annoter, tamponner, signer) sans modifier le document."""

import json

PERM_VIEW_DOCUMENT = "gestion_documentaire.view_documentlocalite"
PERM_CHANGE_DOCUMENT = "gestion_documentaire.change_documentlocalite"
PERM_ANNOTER = "gestion_documentaire.annoter_document"
PERM_TAMPONNER = "gestion_documentaire.tamponner_document"
PERM_SIGNER = "gestion_documentaire.signer_document"

ANNOTATION_EDIT_PERMISSIONS = (PERM_ANNOTER, PERM_TAMPONNER, PERM_SIGNER)

# Seuls champs acceptés d'un utilisateur qui n'a pas le droit de modifier le document
# (ni index, ni type, ni fichier).
ANNOTATION_ONLY_FIELDS = frozenset({"annotations", "save_mode"})

_PERM_BY_TYPE = {"stamp": PERM_TAMPONNER, "signature": PERM_SIGNER}

_ACTION_LABELS = {
    PERM_ANNOTER: "annoter",
    PERM_TAMPONNER: "tamponner",
    PERM_SIGNER: "signer",
}


def user_can_change_document(user):
    return bool(user and user.is_authenticated and (user.is_superuser or user.has_perm(PERM_CHANGE_DOCUMENT)))


def user_can_edit_annotations(user):
    if not user or not user.is_authenticated:
        return False
    if user.is_superuser:
        return True
    return user.has_perm(PERM_VIEW_DOCUMENT) and any(
        user.has_perm(perm) for perm in ANNOTATION_EDIT_PERMISSIONS
    )


def permission_for_annotation(annotation):
    ann_type = annotation.get("type") if isinstance(annotation, dict) else None
    return _PERM_BY_TYPE.get(ann_type, PERM_ANNOTER)


def parse_annotations(raw):
    """Liste d'annotations envoyée par le client ; ValueError si le format est invalide."""
    if raw is None:
        return None
    if isinstance(raw, list):
        return raw
    if not str(raw).strip():
        return []
    parsed = json.loads(raw)
    if not isinstance(parsed, list):
        raise ValueError("Les annotations doivent être une liste.")
    return parsed


def _annotation_id(annotation):
    return annotation.get("id") if isinstance(annotation, dict) else None


def changed_annotations(before, after):
    """Annotations ajoutées, supprimées ou modifiées (ancienne et nouvelle version)."""
    before = list(before or [])
    after = list(after or [])
    before_by_id = {_annotation_id(a): a for a in before if _annotation_id(a)}
    after_by_id = {_annotation_id(a): a for a in after if _annotation_id(a)}

    changed = []
    for ann_id, ann in after_by_id.items():
        previous = before_by_id.get(ann_id)
        if previous != ann:
            changed.append(ann)
            if previous is not None:
                changed.append(previous)
    changed.extend(ann for ann_id, ann in before_by_id.items() if ann_id not in after_by_id)
    changed.extend(a for a in after if not _annotation_id(a) and a not in before)
    changed.extend(a for a in before if not _annotation_id(a) and a not in after)
    return changed


def missing_annotation_permissions(user, before, after):
    """Permissions manquantes pour passer des annotations `before` à `after`."""
    if user.is_superuser:
        return []
    needed = {permission_for_annotation(a) for a in changed_annotations(before, after)}
    return sorted(perm for perm in needed if not user.has_perm(perm))


def annotation_refusal_message(missing_permissions):
    actions = [_ACTION_LABELS.get(perm, perm) for perm in missing_permissions]
    return f"Vous n'avez pas le droit de {' / '.join(actions)} ce document."
