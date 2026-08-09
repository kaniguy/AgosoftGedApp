/** Affiche une date/heure au format jj/mm/aaaa hh:mm (ou avec secondes / date seule). */
export function formatDisplayDateTime(value, { dateOnly = false, withSeconds = false } = {}) {
  if (value == null || String(value).trim() === "") return "—";

  const v = String(value).trim();

  const dtMatch = v.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?/);
  if (dtMatch) {
    const [, y, m, d, h, min, sec] = dtMatch;
    if (dateOnly) return `${d}/${m}/${y}`;
    if (withSeconds) return `${d}/${m}/${y} ${h}:${min}:${sec ?? "00"}`;
    return `${d}/${m}/${y} ${h}:${min}`;
  }

  const dateMatch = v.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (dateMatch) {
    const [, y, m, d] = dateMatch;
    return `${d}/${m}/${y}`;
  }

  try {
    const date = new Date(v);
    if (!Number.isNaN(date.getTime())) {
      const d = String(date.getDate()).padStart(2, "0");
      const m = String(date.getMonth() + 1).padStart(2, "0");
      const y = date.getFullYear();
      if (dateOnly) return `${d}/${m}/${y}`;
      const h = String(date.getHours()).padStart(2, "0");
      const min = String(date.getMinutes()).padStart(2, "0");
      if (withSeconds) {
        const s = String(date.getSeconds()).padStart(2, "0");
        return `${d}/${m}/${y} ${h}:${min}:${s}`;
      }
      return `${d}/${m}/${y} ${h}:${min}`;
    }
  } catch {
    // valeur brute inchangée
  }

  return v;
}

/** Formate la valeur d'un champ dynamique selon son type. */
export function formatChampValue(value, typeChamp) {
  if (value == null || String(value).trim() === "") return "—";
  if (typeChamp === "datetime") return formatDisplayDateTime(value);
  if (typeChamp === "date") return formatDisplayDateTime(value, { dateOnly: true });
  return String(value);
}

/** Normalise une valeur stockée pour l'input datetime-local (édition). */
export function normalizeDatetimeLocalValue(value) {
  if (!value) return "";
  const match = String(value).trim().match(/^(\d{4}-\d{2}-\d{2}T\d{2}:\d{2})/);
  return match ? match[1] : String(value);
}

/** Champ métier « date d'enregistrement » (libellé + type date/datetime). */
export function isRegistrationDateChamp(champ) {
  const label = String(champ?.libelle_champ || "").toLowerCase();
  return (
    (label.includes("enregistrement") || label.includes("date d'enreg")) &&
    (champ.type_champ === "date" || champ.type_champ === "datetime")
  );
}

/** Valeur courante pour un champ date ou datetime (format input HTML). */
export function nowForChampType(typeChamp) {
  const now = new Date();
  const pad = (n) => String(n).padStart(2, "0");
  const y = now.getFullYear();
  const m = pad(now.getMonth() + 1);
  const d = pad(now.getDate());
  if (typeChamp === "date") return `${y}-${m}-${d}`;
  const h = pad(now.getHours());
  const min = pad(now.getMinutes());
  return `${y}-${m}-${d}T${h}:${min}`;
}

export function getRegistrationDateFromDocument(doc) {
  const fromChamp = (doc?.valeurs || []).find((v) => {
    const label = String(v.libelle_champ || "").toLowerCase();
    return (
      (label.includes("enregistrement") || label.includes("date d'enreg")) &&
      String(v.valeur || "").trim() !== ""
    );
  });
  if (fromChamp?.valeur) return fromChamp.valeur;
  return doc?.date_creation ?? null;
}

/** Construit les valeurs à envoyer à l'API, avec date d'enregistrement à jour si demandé. */
export function buildValeursPayload(champs, fieldValues, { refreshRegistrationDate = false } = {}) {
  return champs.map((champ) => {
    let valeur = String(fieldValues[champ.id] ?? "");
    if (refreshRegistrationDate && isRegistrationDateChamp(champ)) {
      valeur = nowForChampType(champ.type_champ);
    }
    return { champ_id: champ.id, valeur };
  });
}
