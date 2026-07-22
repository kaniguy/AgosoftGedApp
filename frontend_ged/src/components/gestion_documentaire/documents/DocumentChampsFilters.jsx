// Filtres dynamiques sur les champs d'index du type de document sélectionné
"use client";

const INPUT_CLASS =
  "w-full border border-emerald-200 rounded-xl px-3 py-2.5 text-sm bg-white focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 shadow-sm";

const INPUT_INVALID_CLASS =
  "w-full border-2 border-red-400 rounded-xl px-3 py-2.5 text-sm bg-red-50/50 focus:ring-2 focus:ring-red-500 focus:border-red-500 shadow-sm";

const IMMEDIATE_TYPES = new Set(["date", "datetime", "select", "choix"]);

function isImmediateType(typeChamp) {
  return IMMEDIATE_TYPES.has(typeChamp);
}

function fieldClass(isUnmatched) {
  return isUnmatched ? INPUT_INVALID_CLASS : INPUT_CLASS;
}

function labelClass(isUnmatched) {
  return isUnmatched
    ? "block text-xs font-semibold text-red-700 uppercase tracking-wide mb-1.5"
    : "block text-xs font-semibold text-emerald-800 uppercase tracking-wide mb-1.5";
}

// Filtres dynamiques sur les champs d'index du type de document sélectionné
export default function DocumentChampsFilters({
  champs,
  values = {},
  unmatchedChampIds = [],
  onChange,
}) {
  if (!champs?.length) return null;

  const unmatchedSet = new Set(unmatchedChampIds.map(String));

  const handleChange = (champ, value) => {
    onChange(champ.id, value, isImmediateType(champ.type_champ));
  };

  return (
    <>
      {champs.map((champ) => {
        const value = values[champ.id] ?? "";
        const inputId = `filtre-champ-${champ.id}`;
        const label = champ.libelle_champ || `Champ ${champ.id}`;
        const isUnmatched = unmatchedSet.has(String(champ.id));
        const controlClass = `${fieldClass(isUnmatched)}${champ.type_champ === "select" || champ.type_champ === "choix" ? " cursor-pointer" : ""}`;

        return (
          <div key={champ.id} className="sm:col-span-2 lg:col-span-2">
            <label htmlFor={inputId} className={labelClass(isUnmatched)}>
              {label}
            </label>

            {champ.type_champ === "select" && (
              <select
                id={inputId}
                value={value}
                onChange={(e) => handleChange(champ, e.target.value)}
                className={controlClass}
                aria-invalid={isUnmatched}
              >
                <option value="">Toutes les valeurs</option>
                {(champ.options || []).map((opt) => (
                  <option key={opt.id || opt.valeur} value={opt.valeur}>
                    {opt.valeur}
                  </option>
                ))}
              </select>
            )}

            {champ.type_champ === "choix" && (
              <select
                id={inputId}
                value={value}
                onChange={(e) => handleChange(champ, e.target.value)}
                className={controlClass}
                aria-invalid={isUnmatched}
              >
                <option value="">Toutes les valeurs</option>
                {(champ.options || []).map((opt) => (
                  <option key={opt.id || opt.valeur} value={opt.valeur}>
                    {opt.valeur}
                  </option>
                ))}
              </select>
            )}

            {champ.type_champ === "date" && (
              <input
                id={inputId}
                type="date"
                value={value}
                onChange={(e) => handleChange(champ, e.target.value)}
                className={controlClass}
                aria-invalid={isUnmatched}
              />
            )}

            {champ.type_champ === "datetime" && (
              <input
                id={inputId}
                type="datetime-local"
                value={value}
                onChange={(e) => handleChange(champ, e.target.value)}
                className={controlClass}
                aria-invalid={isUnmatched}
              />
            )}

            {champ.type_champ === "nombre" && (
              <input
                id={inputId}
                type="number"
                value={value}
                onChange={(e) => handleChange(champ, e.target.value)}
                placeholder="Filtrer…"
                className={controlClass}
                aria-invalid={isUnmatched}
              />
            )}

            {(champ.type_champ === "texte" || champ.type_champ === "texte_long" || champ.type_champ === "qr" || champ.type_champ === "code_barre") && (
              <input
                id={inputId}
                type="text"
                value={value}
                onChange={(e) => handleChange(champ, e.target.value)}
                placeholder="Contient…"
                className={controlClass}
                aria-invalid={isUnmatched}
              />
            )}

            {!["texte", "texte_long", "qr", "code_barre", "nombre", "date", "datetime", "select", "choix"].includes(champ.type_champ) && (
              <input
                id={inputId}
                type="text"
                value={value}
                onChange={(e) => handleChange(champ, e.target.value)}
                placeholder="Contient…"
                className={controlClass}
                aria-invalid={isUnmatched}
              />
            )}

            {isUnmatched && (
              <p className="mt-1 text-xs text-red-600">Aucun document ne correspond à cette valeur.</p>
            )}
          </div>
        );
      })}
    </>
  );
}

export { hasChampFilterValues } from "../../../services/documentLocalite.service";
