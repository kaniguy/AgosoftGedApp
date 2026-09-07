/**
 * Regroupements pour les filtres du tableau de bord (un filtre = plusieurs modules).
 */
export const MODULE_FILTER_GROUPS = [
  {
    id: "documents",
    label: "Documents",
    styleKey: "emerald",
    moduleCodes: ["gestion_documentaire", "recherche_avancee", "controle_qualite"],
  },
  {
    id: "administration",
    label: "Administration",
    styleKey: "blue",
    moduleCodes: ["parametrage", "gestion_acces"],
  },
  {
    id: "pilotage",
    label: "Pilotage",
    styleKey: "orange",
    moduleCodes: ["analytique"],
  },
  {
    id: "ressources",
    label: "Ressources",
    styleKey: "indigo",
    moduleCodes: ["aide_video", "a_propos"],
  },
];

/**
 * Modules applicatifs (codes alignés avec le backend gestion_acces/constants.py).
 */
export const APP_MODULES = [
  {
    code: "parametrage",
    title: "Paramétrage",
    filterGroup: "administration",
    color: "blue",
    icon: "settings",
    description: "Configuration avancée et préférences personnalisées du système",
    path: "/parametrage/type_document",
  },
  {
    code: "gestion_documentaire",
    title: "Gestion Documentaire",
    filterGroup: "documents",
    color: "green",
    icon: "documents",
    description: "Archive intelligente, recherche rapide et organisation optimisée",
    path: "/gestion_documentaire/plan_geographique",
  },
  {
    code: "recherche_avancee",
    title: "Recherche Avancée",
    filterGroup: "documents",
    color: "cyan",
    icon: "search",
    description: "Recherche multi-critères, filtres par colonne et exploration approfondie des archives",
    path: "/recherche_avancee",
  },
  {
    code: "controle_qualite",
    title: "Contrôle qualité",
    filterGroup: "documents",
    color: "yellow",
    icon: "quality",
    description: "Organisation par buckets — un bucket par localité du dernier niveau",
    path: "/controle_qualite",
  },
  {
    code: "analytique",
    title: "Analytique & Rapports",
    filterGroup: "pilotage",
    color: "orange",
    icon: "reports",
    description: "Tableaux de bord, indicateurs de performance et analyses détaillées",
    path: "/analytique/documents",
  },
  {
    code: "gestion_acces",
    title: "Gestion des accès",
    filterGroup: "administration",
    color: "purple",
    icon: "users",
    description: "Contrôle des permissions, rôles utilisateurs et sécurité d'accès",
    path: "/gestion_acces/utilisateurs",
  },
  {
    code: "aide_video",
    title: "Aide Vidéo",
    filterGroup: "ressources",
    color: "rose",
    icon: "video",
    description: "Tutoriels vidéo, guides interactifs et assistance pas à pas",
    path: "/aide-video",
  },
  {
    code: "a_propos",
    title: "À Propos d'AGSOFT",
    filterGroup: "ressources",
    color: "indigo",
    icon: "info",
    description: "Informations sur l'entreprise",
    path: "https://agosoftci.com/",
  },
];

/** Lit l'utilisateur depuis le localStorage. */
function getStoredUser() {
  if (typeof window === "undefined") return null;
  try {
    return JSON.parse(localStorage.getItem("user") || "null");
  } catch {
    return null;
  }
}

/** Retourne les modules visibles selon les droits stockés en session. */
export function getVisibleModules(userModules, isSuperuser = false) {
  if (isSuperuser) {
    return APP_MODULES;
  }
  if (!Array.isArray(userModules)) {
    return APP_MODULES;
  }
  if (userModules.length === 0) {
    return [];
  }
  return APP_MODULES.filter((m) => userModules.includes(m.code));
}

/** Modules visibles pour l'utilisateur connecté (session localStorage). */
export function getVisibleModulesFromStorage() {
  const user = getStoredUser();
  if (!user) {
    return [];
  }
  return getVisibleModules(user.modules, user.is_superuser);
}

/**
 * Puces de filtre du tableau de bord : « Tous » + un onglet par regroupement
 * contenant au moins un module autorisé.
 */
export function getModuleFilterChips(visibleModules) {
  const visibleCodes = new Set(visibleModules.map((m) => m.code));
  const chips = [{ id: "all", label: "Tous", styleKey: "slate" }];
  for (const group of MODULE_FILTER_GROUPS) {
    const hasVisibleModule = group.moduleCodes.some((code) => visibleCodes.has(code));
    if (hasVisibleModule) {
      chips.push({
        id: group.id,
        label: group.label,
        styleKey: group.styleKey,
      });
    }
  }
  return chips;
}

/** Indique si un module appartient au regroupement de filtre sélectionné. */
export function moduleMatchesFilterGroup(module, filterGroupId) {
  if (!filterGroupId || filterGroupId === "all") return true;
  return module.filterGroup === filterGroupId;
}

/** Lit les modules autorisés depuis le localStorage. */
export function getUserModulesFromStorage() {
  const user = getStoredUser();
  return user?.modules ?? null;
}

/** Indique si l'utilisateur connecté est superutilisateur. */
export function isSuperuserFromStorage() {
  const user = getStoredUser();
  return Boolean(user?.is_superuser);
}

/** Indique si le module est assigné au groupe de l'utilisateur. */
export function userHasModule(moduleCode) {
  if (isSuperuserFromStorage()) return true;
  const modules = getUserModulesFromStorage();
  if (!Array.isArray(modules)) return true;
  if (modules.length === 0) return false;
  return modules.includes(moduleCode);
}

/** Lit les localités assignées depuis le localStorage. */
export function getUserLocalitesFromStorage() {
  if (typeof window === "undefined") return [];
  try {
    const user = JSON.parse(localStorage.getItem("user") || "{}");
    return user.localites || [];
  } catch {
    return [];
  }
}
