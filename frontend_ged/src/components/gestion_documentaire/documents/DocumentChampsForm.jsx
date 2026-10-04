// Formulaire des champs dynamiques (métadonnées) selon le type de document
"use client";

import { useMemo } from "react";

// Détermine le nombre de colonnes selon la largeur du panneau formulaire
function getColumnCount(width) {
  if (!width || width < 420) return 1;
  if (width < 680) return 2;
  return 3;
}

// Indique si un champ doit occuper toute la largeur de la grille
function isFullWidthField(champ) {
  return (
    champ.type_champ === "choix"
    || champ.type_champ === "texte_long"
    || champ.type_champ === "qr"
    || champ.type_champ === "code_barre"
  );
}

// Affiche les champs dynamiques du type de document en grille responsive
export default function DocumentChampsForm({
  champs,
  values,
  errors,
  onChange,
  onChampFocus,
  filledChampIds = [],
  panelWidth = 0,
  readOnly = false,
}) {
  const columns = useMemo(() => getColumnCount(panelWidth), [panelWidth]);

  if (!champs?.length) {
    return (
      <p className="text-sm text-gray-500 italic py-4">
        Aucun champ configuré pour ce type de document. Vous pouvez enregistrer le fichier directement.
      </p>
    );
  }

  // Met à jour la valeur d'un champ dans l'état parent
  const handleChange = (champId, valeur) => {
    onChange(champId, valeur);
  };

  // Notifie le parent qu'un champ a reçu le focus (surlignage zone à droite)
  const handleFocus = (champId) => {
    onChampFocus?.(champId);
  };

  const gridClass =
    columns === 3
      ? "grid-cols-1 sm:grid-cols-2 xl:grid-cols-3"
      : columns === 2
        ? "grid-cols-1 sm:grid-cols-2"
        : "grid-cols-1";

  return (
    <fieldset
      disabled={readOnly}
      className={`grid ${gridClass} gap-x-4 gap-y-5 min-w-0 border-0 p-0 m-0 ${
        readOnly ? "[&_input]:bg-gray-50 [&_select]:bg-gray-50 [&_textarea]:bg-gray-50 [&_input]:text-gray-600 [&_textarea]:text-gray-600 [&_select]:text-gray-600" : ""
      }`}
    >
      {champs.map((champ) => {
        const value = values[champ.id] ?? "";
        const error = errors[champ.id];
        const inputId = `champ-doc-${champ.id}`;
        const spanFull = isFullWidthField(champ) || columns === 1;

        const isFilled =
          filledChampIds.includes(champ.id) && String(values[champ.id] ?? "").trim() !== "";

        return (
          <div key={champ.id} className={spanFull ? "col-span-full" : ""}>
            <label htmlFor={inputId} className="block text-sm font-medium text-gray-700 mb-1">
              {champ.libelle_champ}
              {champ.obligatoire && <span className="text-red-500 ml-1">*</span>}
              {isFilled && (
                <span className="ml-2 text-[10px] font-medium text-emerald-600 uppercase tracking-wide">
                  détecté
                </span>
              )}
            </label>

            {champ.type_champ === "texte" && (
              <input
                id={inputId}
                type="text"
                value={value}
                onChange={(e) => handleChange(champ.id, e.target.value)}
                onFocus={() => handleFocus(champ.id)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
              />
            )}

            {champ.type_champ === "texte_long" && (
              <textarea
                id={inputId}
                rows={4}
                value={value}
                onChange={(e) => handleChange(champ.id, e.target.value)}
                onFocus={() => handleFocus(champ.id)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 resize-y min-h-[100px]"
              />
            )}

            {champ.type_champ === "qr" && (
              <textarea
                id={inputId}
                rows={3}
                value={value}
                onChange={(e) => handleChange(champ.id, e.target.value)}
                onFocus={() => handleFocus(champ.id)}
                placeholder="Contenu du code QR (extrait automatiquement)"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm font-mono focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 resize-y min-h-[80px]"
              />
            )}

            {champ.type_champ === "code_barre" && (
              <textarea
                id={inputId}
                rows={2}
                value={value}
                onChange={(e) => handleChange(champ.id, e.target.value)}
                onFocus={() => handleFocus(champ.id)}
                placeholder="Contenu du code barre (extrait automatiquement)"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm font-mono focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 resize-y min-h-[60px]"
              />
            )}

            {champ.type_champ === "nombre" && (
              <input
                id={inputId}
                type="number"
                value={value}
                onChange={(e) => handleChange(champ.id, e.target.value)}
                onFocus={() => handleFocus(champ.id)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
              />
            )}

            {champ.type_champ === "date" && (
              <input
                id={inputId}
                type="date"
                value={value}
                onChange={(e) => handleChange(champ.id, e.target.value)}
                onFocus={() => handleFocus(champ.id)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
              />
            )}

            {champ.type_champ === "datetime" && (
              <input
                id={inputId}
                type="datetime-local"
                value={value}
                onChange={(e) => handleChange(champ.id, e.target.value)}
                onFocus={() => handleFocus(champ.id)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
              />
            )}

            {champ.type_champ === "select" && (
              <select
                id={inputId}
                value={value}
                onChange={(e) => handleChange(champ.id, e.target.value)}
                onFocus={() => handleFocus(champ.id)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
              >
                <option value="">— Sélectionner —</option>
                {(champ.options || []).map((opt) => (
                  <option key={opt.id || opt.valeur} value={opt.valeur}>
                    {opt.valeur}
                  </option>
                ))}
              </select>
            )}

            {champ.type_champ === "choix" && (
              <div
                className="grid grid-cols-1 sm:grid-cols-2 gap-2 border border-gray-200 rounded-lg p-3 bg-gray-50/50"
                onFocus={() => handleFocus(champ.id)}
              >
                {(champ.options || []).map((opt) => (
                  <label key={opt.id || opt.valeur} className="flex items-center gap-2 text-sm text-gray-700">
                    <input
                      type="checkbox"
                      checked={(value || "").split(",").filter(Boolean).includes(opt.valeur)}
                      onFocus={() => handleFocus(champ.id)}
                      onChange={(e) => {
                        const current = (value || "").split(",").filter(Boolean);
                        const next = e.target.checked
                          ? [...current, opt.valeur]
                          : current.filter((v) => v !== opt.valeur);
                        handleChange(champ.id, next.join(","));
                      }}
                      className="rounded border-gray-300 text-emerald-600 focus:ring-emerald-500"
                    />
                    {opt.valeur}
                  </label>
                ))}
              </div>
            )}

            {!["texte", "texte_long", "qr", "code_barre", "nombre", "date", "datetime", "select", "choix"].includes(champ.type_champ) && (
              <input
                id={inputId}
                type="text"
                value={value}
                onChange={(e) => handleChange(champ.id, e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
              />
            )}

            {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
          </div>
        );
      })}
    </fieldset>
  );
}
