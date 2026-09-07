import { userHasModule } from "../constants/modules";
import { CONTROLE_QUALITE_STATUT_IDS } from "./controleQualiteMenu";
import {
  canAccessControleQualite,
  canViewStatutMenu,
} from "../utils/controleQualitePermissions";
import {
  MODEL_PERMISSIONS,
  MODELS,
  PERMISSIONS,
  canAccessGuideAideAdmin,
  canAccessSauvegardeBase,
  canViewGedPlanClassement,
  hasAnyPermission,
  hasPermission,
} from "../utils/permissions";

function checkControleQualitePath(pathname) {
  if (!canAccessControleQualite()) return false;
  const segments = pathname.split("/").filter(Boolean);
  const statut = segments[1];
  if (statut && CONTROLE_QUALITE_STATUT_IDS.includes(statut)) {
    return canViewStatutMenu(statut);
  }
  return true;
}

function checkPlanClassementPath(pathname) {
  if (pathname.includes("/rattacher")) {
    return hasPermission(MODEL_PERMISSIONS[MODELS.DOCUMENT_LOCALITE].add);
  }
  if (pathname.includes("/documents")) {
    return hasPermission(PERMISSIONS.VIEW_DOCUMENT_LOCALITE);
  }
  return canViewGedPlanClassement();
}

/**
 * Plus le préfixe est long, plus la règle est précise.
 * module : le groupe doit avoir le module.
 * anyPermission : au moins une permission (comme le menu).
 */
export const ROUTE_ACCESS_RULES = [
  {
    prefix: "/parametrage/type_document",
    module: "parametrage",
    anyPermission: [PERMISSIONS.VIEW_TYPE_DOCUMENT],
  },
  {
    prefix: "/parametrage/champs_document",
    module: "parametrage",
    anyPermission: [PERMISSIONS.VIEW_CHAMPS_DOCUMENT],
  },
  {
    prefix: "/parametrage/structure_geographique",
    module: "parametrage",
    anyPermission: [PERMISSIONS.VIEW_STRUCTURE_GEOGRAPHIQUE],
  },
  {
    prefix: "/parametrage/plan_geographique",
    module: "parametrage",
    anyPermission: [PERMISSIONS.VIEW_PLAN_GEOGRAPHIQUE],
  },
  { prefix: "/parametrage", module: "parametrage" },

  {
    prefix: "/gestion_documentaire/plan_geographique",
    module: "gestion_documentaire",
    check: checkPlanClassementPath,
  },
  {
    prefix: "/gestion_documentaire/documents",
    module: "gestion_documentaire",
    anyPermission: [PERMISSIONS.VIEW_DOCUMENT_LOCALITE],
  },
  {
    prefix: "/gestion_documentaire/brouillons",
    module: "gestion_documentaire",
    anyPermission: [PERMISSIONS.VIEW_DOCUMENT_LOCALITE],
  },
  { prefix: "/gestion_documentaire", module: "gestion_documentaire" },

  {
    prefix: "/recherche_avancee",
    module: "recherche_avancee",
    anyPermission: [PERMISSIONS.VIEW_DOCUMENT_LOCALITE],
  },

  {
    prefix: "/controle_qualite",
    module: "controle_qualite",
    check: checkControleQualitePath,
  },

  {
    prefix: "/analytique/administration",
    module: "analytique",
    anyPermission: [PERMISSIONS.VIEW_USER, PERMISSIONS.VIEW_GROUP],
  },
  {
    prefix: "/analytique/documents",
    module: "analytique",
    anyPermission: [PERMISSIONS.VIEW_DOCUMENT_LOCALITE],
  },
  { prefix: "/analytique", module: "analytique" },

  {
    prefix: "/gestion_acces/utilisateurs",
    module: "gestion_acces",
    anyPermission: [PERMISSIONS.VIEW_USER],
  },
  {
    prefix: "/gestion_acces/groupes",
    module: "gestion_acces",
    anyPermission: [PERMISSIONS.VIEW_GROUP],
  },
  {
    prefix: "/gestion_acces/permissions",
    module: "gestion_acces",
    anyPermission: [PERMISSIONS.VIEW_PERMISSION],
  },
  {
    prefix: "/gestion_acces/liens-telechargement",
    module: "gestion_acces",
    anyPermission: [PERMISSIONS.VIEW_LIEN_TELECHARGEMENT],
  },
  {
    prefix: "/gestion_acces/journal-activite",
    module: "gestion_acces",
    anyPermission: [PERMISSIONS.VIEW_JOURNAL_ACTIVITE],
  },
  {
    prefix: "/gestion_acces/entreprise",
    module: "gestion_acces",
    anyPermission: [PERMISSIONS.VIEW_ENTREPRISE, PERMISSIONS.CHANGE_ENTREPRISE],
  },
  {
    prefix: "/gestion_acces/configuration-email",
    module: "gestion_acces",
    anyPermission: [PERMISSIONS.VIEW_CONFIGURATION_EMAIL, PERMISSIONS.CHANGE_CONFIGURATION_EMAIL],
  },
  {
    prefix: "/gestion_acces/mes-notifications",
    allowAuthenticated: true,
  },
  {
    prefix: "/gestion_acces/notifications",
    module: "gestion_acces",
    anyPermission: [PERMISSIONS.VIEW_REGLE_NOTIFICATION, PERMISSIONS.CHANGE_REGLE_NOTIFICATION],
  },
  { prefix: "/gestion_acces/profil", allowAuthenticated: true },
  {
    prefix: "/gestion_acces/aide-video",
    module: "gestion_acces",
    check: canAccessGuideAideAdmin,
  },
  {
    prefix: "/gestion_acces/base-de-donnees",
    module: "gestion_acces",
    check: canAccessSauvegardeBase,
  },
  { prefix: "/gestion_acces", module: "gestion_acces" },

  { prefix: "/aide-video", module: "aide_video" },
];

const SORTED_RULES = [...ROUTE_ACCESS_RULES].sort(
  (a, b) => b.prefix.length - a.prefix.length
);

function isPublicPath(pathname) {
  return (
    !pathname ||
    pathname === "/" ||
    pathname.startsWith("/auth/") ||
    pathname.startsWith("/telechargement/")
  );
}

function matchRule(pathname) {
  return SORTED_RULES.find(
    (rule) => pathname === rule.prefix || pathname.startsWith(`${rule.prefix}/`)
  );
}

/** True si l'utilisateur peut ouvrir cette URL (même sans le menu). */
export function canAccessPath(pathname) {
  if (isPublicPath(pathname)) return true;
  const rule = matchRule(pathname);
  if (!rule) return true;
  if (rule.allowAuthenticated) return true;
  if (rule.module && !userHasModule(rule.module)) return false;
  if (rule.anyPermission && !hasAnyPermission(rule.anyPermission)) return false;
  if (rule.check && !rule.check(pathname)) return false;
  return true;
}

/** Pages d'entrée par module, du plus utile au repli. */
export const MODULE_LANDING_CANDIDATES = {
  parametrage: [
    "/parametrage/type_document",
    "/parametrage/champs_document",
    "/parametrage/structure_geographique",
    "/parametrage/plan_geographique",
  ],
  gestion_documentaire: [
    "/gestion_documentaire/plan_geographique",
    "/gestion_documentaire/documents",
    "/gestion_documentaire/brouillons",
  ],
  recherche_avancee: ["/recherche_avancee"],
  controle_qualite: ["/controle_qualite"],
  analytique: ["/analytique/documents", "/analytique/administration"],
  gestion_acces: [
    "/gestion_acces/utilisateurs",
    "/gestion_acces/groupes",
    "/gestion_acces/permissions",
    "/gestion_acces/liens-telechargement",
    "/gestion_acces/journal-activite",
    "/gestion_acces/entreprise",
    "/gestion_acces/base-de-donnees",
    "/gestion_acces/aide-video",
    "/gestion_acces/configuration-email",
    "/gestion_acces/notifications",
  ],
  aide_video: ["/aide-video"],
};

export const MODULE_ROOT_PATHS = {
  parametrage: "/parametrage",
  gestion_documentaire: "/gestion_documentaire",
  recherche_avancee: "/recherche_avancee",
  controle_qualite: "/controle_qualite",
  analytique: "/analytique",
  gestion_acces: "/gestion_acces",
  aide_video: "/aide-video",
};

/** Première URL réellement accessible pour un module, ou null. */
export function getModuleEntryPath(moduleCode) {
  const candidates = MODULE_LANDING_CANDIDATES[moduleCode] || [];
  const page = candidates.find((path) => canAccessPath(path));
  if (page) return page;
  const root = MODULE_ROOT_PATHS[moduleCode];
  if (root && canAccessPath(root)) return root;
  return null;
}
