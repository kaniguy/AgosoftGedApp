"""
Filtres avancés par colonne sur les documents (style Odoo).

Rôle : traduire les paramètres de requête API (filter_*_op, filter_*, champ_<id>_op, …)
en objets Q Django pour la liste des DocumentLocalite.

Colonnes fixes : localité, type, format, date d'enregistrement.
Champs dynamiques : valeurs stockées en texte (ValeurChamp) avec cast SQL pour nombre et date.

Point d'entrée : apply_column_filters(qs, query_params) — appelé depuis document_view.py.
"""
from datetime import datetime, timedelta
from decimal import Decimal, InvalidOperation

from django.db import connection
from django.db.models import Exists, OuterRef, Q

from parametrage.models.champs_document import ChampsDocument, ValeurChamp

TEXT_OPS = frozenset({"contains", "not_contains", "eq", "neq", "startswith", "endswith"})
NUMBER_OPS = frozenset({"eq", "neq", "gt", "gte", "lt", "lte", "between"})
DATE_OPS = frozenset({"eq", "before", "before_eq", "after", "after_eq", "between"})

CHAMP_TYPE_MAP = {
    "texte": "text",
    "texte_long": "text",
    "nombre": "number",
    "date": "date",
    "datetime": "date",
    "select": "text",
    "choix": "text",
    "qr": "text",
    "code_barre": "text",
}

FORMAT_EXTENSIONS = {
    "pdf": (".pdf",),
    "jpeg": (".jpg", ".jpeg"),
    "jpg": (".jpg", ".jpeg"),
    "png": (".png",),
    "webp": (".webp",),
    "gif": (".gif",),
    "tiff": (".tif", ".tiff"),
    "tif": (".tif", ".tiff"),
    "word": (".doc", ".docx"),
    "excel": (".xls", ".xlsx"),
    "powerpoint": (".ppt", ".pptx"),
}


def _parse_decimal(value):
    """Convertit une chaîne utilisateur en Decimal (virgule → point)."""
    if value is None:
        return None
    raw = str(value).strip().replace(" ", "").replace(",", ".")
    if not raw:
        return None
    try:
        return Decimal(raw)
    except (InvalidOperation, ValueError, TypeError):
        return None


def _numeric_cast_sql(column="valeur"):
    """Expression SQL pour comparer un champ texte comme nombre décimal."""
    vendor = connection.vendor
    if vendor in ("microsoft", "mssql"):
        return (
            f"TRY_CAST(REPLACE(COALESCE([{column}], ''), ',', '.') AS DECIMAL(38, 10))"
        )
    if vendor == "postgresql":
        return (
            f"NULLIF(REGEXP_REPLACE(COALESCE({column}, ''), '[^0-9.-]', '', 'g'), '')::numeric"
        )
    if vendor == "sqlite":
        return f"CAST(REPLACE(COALESCE({column}, ''), ',', '.') AS REAL)"
    return f"CAST(REPLACE(COALESCE({column}, ''), ',', '.') AS DECIMAL(38, 10))"


def _impossible_q():
    """Q objet qui ne matche aucun enregistrement (valeur de filtre invalide)."""
    return Q(pk__in=[])


def _champ_number_filter_q(champ_id, op, value, value_to=None):
    """Filtre numérique sur ValeurChamp.valeur (TextField) via cast SQL."""
    num = _parse_decimal(value)
    if num is None:
        return _impossible_q()

    cast_expr = _numeric_cast_sql("valeur")
    op_sql = {
        "eq": "=",
        "neq": "!=",
        "gt": ">",
        "gte": ">=",
        "lt": "<",
        "lte": "<=",
    }

    if op == "between":
        num_to = _parse_decimal(value_to)
        if num_to is None:
            return _impossible_q()
        where = f"{cast_expr} >= %s AND {cast_expr} <= %s"
        params = [num, num_to]
    elif op in op_sql:
        where = f"{cast_expr} {op_sql[op]} %s"
        params = [num]
    else:
        return _impossible_q()

    sub = ValeurChamp.objects.filter(
        champ_id=champ_id,
        reponse_id=OuterRef("reponse_id"),
    ).extra(where=[where], params=params)

    if op == "neq":
        return ~Q(Exists(sub))
    return Q(Exists(sub))


def _stored_value_datetime_sql(column="valeur", date_only=False):
    """Convertit une valeur texte stockée en date/datetime SQL Server."""
    vendor = connection.vendor
    if vendor in ("microsoft", "mssql"):
        dt_expr = (
            f"COALESCE("
            f"TRY_CONVERT(datetime2, [{column}], 126), "
            f"TRY_CONVERT(datetime2, [{column}], 23)"
            f")"
        )
        if date_only:
            return f"CONVERT(date, {dt_expr})"
        return dt_expr
    if vendor == "postgresql":
        dt_expr = (
            f"COALESCE("
            f"NULLIF({column}, '')::timestamp, "
            f"to_timestamp({column}, 'YYYY-MM-DD')"
            f")"
        )
        if date_only:
            return f"({dt_expr})::date"
        return dt_expr
    if vendor == "sqlite":
        dt_expr = f"datetime(REPLACE(COALESCE({column}, ''), 'T', ' '))"
        if date_only:
            return f"date({dt_expr})"
        return dt_expr
    dt_expr = f"CAST(REPLACE(COALESCE({column}, ''), 'T', ' ') AS DATETIME)"
    if date_only:
        return f"DATE({dt_expr})"
    return dt_expr


def _champ_date_filter_q(champ_id, op, value, value_to=None, date_only=False):
    """Filtre date/datetime sur ValeurChamp.valeur (TextField) via cast SQL."""
    parsed = _parse_date_value(value)
    if not parsed:
        return _impossible_q()

    cast_expr = _stored_value_datetime_sql("valeur", date_only=date_only)

    def _build_where(operator, param_a, param_b=None):
        if operator == "between" and param_b is not None:
            return f"{cast_expr} >= %s AND {cast_expr} <= %s", [param_a, param_b]
        if operator == "eq":
            if date_only:
                return f"{cast_expr} = %s", [param_a]
            return f"{cast_expr} >= %s AND {cast_expr} < %s", [param_a, param_b]
        sql_ops = {
            "before": "<",
            "before_eq": "<=",
            "after": ">",
            "after_eq": ">=",
        }
        if operator in sql_ops:
            return f"{cast_expr} {sql_ops[operator]} %s", [param_a]
        return None, None

    if op == "between":
        end = _parse_date_value(value_to)
        if not end:
            return _impossible_q()
        if date_only:
            where, params = _build_where("between", parsed.date().isoformat(), end.date().isoformat())
        else:
            where, params = _build_where(
                "between",
                parsed.strftime("%Y-%m-%d %H:%M:%S"),
                end.strftime("%Y-%m-%d %H:%M:%S"),
            )
    elif op == "eq":
        if date_only:
            where, params = _build_where("eq", parsed.date().isoformat())
        else:
            end = parsed + timedelta(minutes=1)
            where, params = _build_where(
                "eq",
                parsed.strftime("%Y-%m-%d %H:%M:%S"),
                end.strftime("%Y-%m-%d %H:%M:%S"),
            )
    elif op in ("before", "before_eq", "after", "after_eq"):
        if date_only:
            where, params = _build_where(op, parsed.date().isoformat())
        else:
            where, params = _build_where(op, parsed.strftime("%Y-%m-%d %H:%M:%S"))
    else:
        return _impossible_q()

    if not where:
        return _impossible_q()

    sub = ValeurChamp.objects.filter(
        champ_id=champ_id,
        reponse_id=OuterRef("reponse_id"),
    ).extra(where=[where], params=params)
    return Q(Exists(sub))


def _parse_date_value(value):
    """Parse ISO date ou datetime-local (YYYY-MM-DD, YYYY-MM-DDTHH:MM)."""
    if not value:
        return None
    raw = str(value).strip()
    candidates = [
        ("%Y-%m-%dT%H:%M:%S", raw[:19]),
        ("%Y-%m-%dT%H:%M", raw[:16]),
        ("%Y-%m-%d", raw[:10]),
    ]
    for fmt, chunk in candidates:
        if not chunk:
            continue
        try:
            return datetime.strptime(chunk, fmt)
        except (TypeError, ValueError):
            continue
    return None


def _text_q(field, op, value):
    """Construit un Q pour filtre texte sur un champ ORM (contains, eq, …)."""
    value = (value or "").strip()
    if not value:
        return Q()
    mapping = {
        "contains": Q(**{f"{field}__icontains": value}),
        "not_contains": ~Q(**{f"{field}__icontains": value}),
        "eq": Q(**{f"{field}__iexact": value}),
        "neq": ~Q(**{f"{field}__iexact": value}),
        "startswith": Q(**{f"{field}__istartswith": value}),
        "endswith": Q(**{f"{field}__iendswith": value}),
    }
    return mapping.get(op, mapping["contains"])


def _multi_text_q(fields, op, value):
    """Filtre texte sur plusieurs champs (OU pour eq/contains, ET pour neq/not_contains)."""
    q = Q()
    use_and = op in ("not_contains", "neq")
    for field in fields:
        part = _text_q(field, op, value)
        if not q:
            q = part
        elif use_and:
            q &= part
        else:
            q |= part
    return q


def _date_creation_q(op, value, value_to=None):
    """Filtre sur DocumentLocalite.date_creation (jour seul ou datetime si heure fournie)."""
    parsed = _parse_date_value(value)
    if not parsed:
        return Q()

    raw = str(value or "").strip()
    has_time = "T" in raw and len(raw) > 10

    if has_time:
        if op == "between":
            end = _parse_date_value(value_to)
            if not end:
                return Q()
            return Q(date_creation__gte=parsed) & Q(date_creation__lte=end)
        if op == "eq":
            end = parsed + timedelta(minutes=1)
            return Q(date_creation__gte=parsed) & Q(date_creation__lt=end)
        if op == "before":
            return Q(date_creation__lt=parsed)
        if op == "before_eq":
            return Q(date_creation__lte=parsed)
        if op == "after":
            return Q(date_creation__gt=parsed)
        if op == "after_eq":
            return Q(date_creation__gte=parsed)

    target = parsed.date()
    if op == "between":
        end = _parse_date_value(value_to)
        if not end:
            return Q()
        return Q(date_creation__date__gte=target) & Q(date_creation__date__lte=end.date())
    if op == "eq":
        return Q(date_creation__date=target)
    if op == "before":
        return Q(date_creation__date__lt=target)
    if op == "before_eq":
        return Q(date_creation__date__lte=target)
    if op == "after":
        return Q(date_creation__date__gt=target)
    if op == "after_eq":
        return Q(date_creation__date__gte=target)
    return Q(date_creation__date=target)


def _format_extension_q(op, value):
    """Filtre sur l'extension du fichier (pdf, jpeg, …)."""
    value = (value or "").strip().lower()
    if not value:
        return Q()
    extensions = FORMAT_EXTENSIONS.get(value, (f".{value}",))
    format_q = Q()
    for ext in extensions:
        format_q |= Q(fichier__iendswith=ext)
    if op == "neq":
        return ~format_q
    return format_q


def _champ_filter_q(champ_id, op, value, value_to=None):
    """Route le filtre vers nombre, date ou texte selon ChampsDocument.type_champ."""
    try:
        champ = ChampsDocument.objects.get(pk=champ_id)
    except ChampsDocument.DoesNotExist:
        return Q()

    family = CHAMP_TYPE_MAP.get(champ.type_champ, "text")

    if family == "number":
        return _champ_number_filter_q(champ_id, op, value, value_to)
    if family == "date":
        date_only = champ.type_champ == "date"
        return _champ_date_filter_q(champ_id, op, value, value_to, date_only=date_only)
    if op not in TEXT_OPS:
        op = "contains"
    base = Q(reponse__valeurs__champ_id=champ_id)
    return base & _text_q("reponse__valeurs__valeur", op, value)


def _read_filter_triplet(query_params, prefix):
    """Lit opérateur, valeur et borne supérieure depuis les query params."""
    op = (query_params.get(f"{prefix}_op") or "contains").strip()
    value = (query_params.get(prefix) or "").strip()
    value_to = (query_params.get(f"{prefix}_to") or "").strip()
    return op, value, value_to


def apply_column_filters(qs, query_params):
    """Applique les filtres par colonne (base + champs dynamiques)."""
    applied = False

    op, value, value_to = _read_filter_triplet(query_params, "filter_localite")
    if value:
        qs = qs.filter(
            _multi_text_q(
                ["localite__libelle", "localite__code"],
                op if op in TEXT_OPS else "contains",
                value,
            )
        )
        applied = True

    op, value, _ = _read_filter_triplet(query_params, "filter_type")
    if value:
        qs = qs.filter(
            _text_q(
                "type_document__libelle",
                op if op in TEXT_OPS else "contains",
                value,
            )
        )
        applied = True

    op, value, _ = _read_filter_triplet(query_params, "filter_format")
    if value:
        qs = qs.filter(_format_extension_q(op if op in ("eq", "neq") else "eq", value))
        applied = True

    op, value, value_to = _read_filter_triplet(query_params, "filter_date")
    if value:
        qs = qs.filter(_date_creation_q(op if op in DATE_OPS else "eq", value, value_to))
        applied = True

    for key in list(query_params.keys()):
        if not key.startswith("filter_geo_") or key.endswith("_op") or key.endswith("_to"):
            continue
        suffix = key[len("filter_geo_") :]
        if not suffix.isdigit():
            continue
        from gestion_documentaire.services.localite_chemin import geo_level_filter_q

        op, value, _ = _read_filter_triplet(query_params, key)
        if not value:
            continue
        geo_q = geo_level_filter_q(int(suffix), op if op in TEXT_OPS else "contains", value)
        if geo_q is not None:
            qs = qs.filter(geo_q)
            applied = True

    for key in query_params:
        if not key.startswith("champ_") or key.endswith("_op") or key.endswith("_to"):
            continue
        try:
            champ_id = int(key[6:])
        except (TypeError, ValueError):
            continue
        op, value, value_to = _read_filter_triplet(query_params, key)
        if not value and op != "between":
            continue
        if op == "between" and (not value or not value_to):
            continue
        qs = qs.filter(_champ_filter_q(champ_id, op, value, value_to))
        applied = True

    return qs, applied
