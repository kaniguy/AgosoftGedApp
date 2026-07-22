/** Statuts du flux documentaire — import → QC → archive */

export const STATUT_BROUILLON = "brouillon";
export const STATUT_EN_ATTENTE = "en_attente";
export const STATUT_VALIDE = "valide";
export const STATUT_REJETE = "rejete";

export const STATUT_LABELS = {
  [STATUT_BROUILLON]: "Brouillon",
  [STATUT_EN_ATTENTE]: "En attente de validation",
  [STATUT_VALIDE]: "Validé",
  [STATUT_REJETE]: "Rejeté",
};

export const STATUT_BADGE_CLASS = {
  [STATUT_BROUILLON]: "bg-slate-100 text-slate-700",
  [STATUT_EN_ATTENTE]: "bg-yellow-100 text-yellow-800",
  [STATUT_VALIDE]: "bg-emerald-100 text-emerald-800",
  [STATUT_REJETE]: "bg-red-100 text-red-800",
};

export function getStatutLabel(statut) {
  return STATUT_LABELS[statut] || STATUT_LABELS[STATUT_BROUILLON];
}

export function canSoumettreValidation(statut) {
  return statut === STATUT_BROUILLON || statut === STATUT_REJETE;
}

export function canValiderOuRejeter(statut) {
  return statut === STATUT_EN_ATTENTE;
}

export function isModeCorrection(statut) {
  return canSoumettreValidation(statut);
}

export function isModeControle(statut) {
  return canValiderOuRejeter(statut);
}
