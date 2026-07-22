import {
  STATUT_EN_ATTENTE,
  STATUT_REJETE,
  STATUT_VALIDE,
} from "../utils/documentStatutQualite";

export const CONTROLE_QUALITE_STATUTS = [
  {
    id: STATUT_EN_ATTENTE,
    label: "En attente de validation",
    shortLabel: "En attente",
    subtitle: "File de contrôle — à valider ou rejeter",
    path: `/controle_qualite/${STATUT_EN_ATTENTE}`,
    badgeClass: "bg-yellow-100 text-yellow-800",
    actionLabel: "Contrôler",
  },
  {
    id: STATUT_REJETE,
    label: "Rejetés",
    shortLabel: "Rejetés",
    subtitle: "À corriger puis resoumettre au contrôle qualité",
    path: `/controle_qualite/${STATUT_REJETE}`,
    badgeClass: "bg-red-100 text-red-800",
    actionLabel: "Contrôler",
  },
  {
    id: STATUT_VALIDE,
    label: "Validés",
    shortLabel: "Validés",
    subtitle: "Archivés après contrôle qualité",
    path: `/controle_qualite/${STATUT_VALIDE}`,
    badgeClass: "bg-emerald-100 text-emerald-800",
    actionLabel: "Consulter",
  },
];

export const CONTROLE_QUALITE_STATUT_IDS = CONTROLE_QUALITE_STATUTS.map((s) => s.id);

export function getControleQualiteStatutConfig(statut) {
  return CONTROLE_QUALITE_STATUTS.find((s) => s.id === statut) || CONTROLE_QUALITE_STATUTS[0];
}

export function isControleQualiteStatut(value) {
  return CONTROLE_QUALITE_STATUT_IDS.includes(value);
}
