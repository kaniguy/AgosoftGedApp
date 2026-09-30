import {
  canAccessGuideAideAdmin,
  canAccessSauvegardeBase,
  hasAnyPermission,
  hasPermission,
  PERMISSIONS,
} from "../utils/permissions";

/**
 * Menu du module Paramétrage, dans l'ordre de configuration à respecter :
 * structures → plan de classement → types de documents → champs.
 * `countKey` : compteur renvoyé par /api/parametrage/etat-parametrage/ (étape réalisée si > 0).
 * `requires` : étape précédente obligatoire (menu verrouillé tant que son compteur vaut 0).
 */
export const PARAMETRAGE_SECTIONS = [
  {
    id: "geographique",
    step: 1,
    label: "Référentiel géographique",
    icon: "map",
    items: [
      {
        id: "structure-geographique",
        step: "1.1",
        name: "Structures géographiques",
        path: "/parametrage/structure_geographique",
        permission: PERMISSIONS.VIEW_STRUCTURE_GEOGRAPHIQUE,
        countKey: "structures",
      },
      {
        id: "plan-geographique",
        step: "1.2",
        name: "Plans géographiques",
        path: "/parametrage/plan_geographique",
        permission: PERMISSIONS.VIEW_PLAN_GEOGRAPHIQUE,
        countKey: "plans",
        requires: {
          countKey: "structures",
          label: "Structures géographiques",
          path: "/parametrage/structure_geographique",
          message: "Créez d'abord au moins une structure géographique : le plan de classement s'appuie sur ses niveaux.",
        },
      },
    ],
  },
  {
    id: "documentaire",
    step: 2,
    label: "Référentiel documentaire",
    icon: "document",
    items: [
      {
        id: "type-document",
        step: "2.1",
        name: "Types de documents",
        path: "/parametrage/type_document",
        permission: PERMISSIONS.VIEW_TYPE_DOCUMENT,
        countKey: "types_documents",
        requires: {
          countKey: "plans",
          label: "Plans géographiques",
          path: "/parametrage/plan_geographique",
          message: "Créez d'abord le plan de classement avant de définir les types de documents.",
        },
      },
      {
        id: "champs-document",
        step: "2.2",
        name: "Champs documents",
        path: "/parametrage/champs_document",
        permission: PERMISSIONS.VIEW_CHAMPS_DOCUMENT,
        countKey: "champs_documents",
        requires: {
          countKey: "types_documents",
          label: "Types de documents",
          path: "/parametrage/type_document",
          message: "Créez d'abord au moins un type de document : les champs lui sont rattachés.",
        },
      },
    ],
  },
  {
    id: "application",
    step: 3,
    label: "Application",
    icon: "building",
    items: [
      {
        id: "entreprise",
        name: "Entreprise",
        path: "/parametrage/entreprise",
        permissionCheck: () =>
          hasAnyPermission([PERMISSIONS.VIEW_ENTREPRISE, PERMISSIONS.CHANGE_ENTREPRISE]),
      },
      {
        id: "aide-video",
        name: "Aide Vidéo",
        path: "/parametrage/aide-video",
        permissionCheck: () => canAccessGuideAideAdmin(),
      },
    ],
  },
  {
    id: "emails",
    step: 4,
    label: "E-mails & notifications",
    icon: "mail",
    items: [
      {
        id: "configuration-email",
        name: "Configuration SMTP-MAIL",
        path: "/parametrage/configuration-email",
        permissionCheck: () =>
          hasAnyPermission([
            PERMISSIONS.VIEW_CONFIGURATION_EMAIL,
            PERMISSIONS.CHANGE_CONFIGURATION_EMAIL,
          ]),
      },
      {
        id: "notifications",
        name: "Notifications",
        path: "/parametrage/notifications",
        permissionCheck: () =>
          hasAnyPermission([
            PERMISSIONS.VIEW_REGLE_NOTIFICATION,
            PERMISSIONS.CHANGE_REGLE_NOTIFICATION,
          ]),
      },
    ],
  },
  {
    id: "systeme",
    step: 5,
    label: "Système",
    icon: "database",
    items: [
      {
        id: "base-de-donnees",
        name: "Base de données",
        path: "/parametrage/base-de-donnees",
        permissionCheck: () => canAccessSauvegardeBase(),
      },
    ],
  },
];

export function isParametrageItemVisible(item) {
  return item.permissionCheck ? item.permissionCheck() : hasPermission(item.permission);
}

export function isPathInItem(pathname, item) {
  return pathname === item.path || pathname.startsWith(`${item.path}/`);
}

/** Prérequis manquant pour ce menu (null si accessible ou état inconnu). */
export function getMissingPrerequisite(item, etat) {
  if (!item?.requires || !etat) return null;
  const count = Number(etat[item.requires.countKey]);
  return Number.isFinite(count) && count <= 0 ? item.requires : null;
}

export function findParametrageItem(pathname) {
  for (const section of PARAMETRAGE_SECTIONS) {
    const item = section.items.find((it) => isPathInItem(pathname, it));
    if (item) return { section, item };
  }
  return null;
}
