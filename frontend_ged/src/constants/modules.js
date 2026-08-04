/**
 * Modules applicatifs (codes alignés avec le backend gestion_acces/constants.py).
 */
export const APP_MODULES = [
  {
    code: "parametrage",
    title: "Paramétrage",
    filterLabel: "Paramétrage",
    color: "blue",
    icon: "settings",
    description: "Configuration avancée et préférences personnalisées du système",
    path: "/parametrage/type_document",
  },
  {
    code: "gestion_documentaire",
    title: "Gestion Documentaire",
    filterLabel: "Documents",
    color: "green",
    icon: "documents",
    description: "Archive intelligente, recherche rapide et organisation optimisée",
    path: "/gestion_documentaire/plan_geographique",
  },
  {
    code: "recherche_avancee",
    title: "Recherche Avancée",
    filterLabel: "Recherche",
    color: "cyan",
    icon: "search",
    description: "Recherche multi-critères, filtres par colonne et exploration approfondie des archives",
    path: "/recherche_avancee",
  },
  {
    code: "controle_qualite",
    title: "Contrôle qualité",
    filterLabel: "Qualité",
    color: "yellow",
    icon: "quality",
    description: "Organisation par buckets — un bucket par localité du dernier niveau",
    path: "/controle_qualite",
  },
  {
    code: "analytique",
    title: "Analytique & Rapports",
    filterLabel: "Analytique",
    color: "orange",
    icon: "reports",
    description: "Tableaux de bord, indicateurs de performance et analyses détaillées",
    path: "/analytique/documents",
  },
  {
    code: "gestion_acces",
    title: "Gestion des accès",
    filterLabel: "Accès",
    color: "purple",
    icon: "users",
    description: "Contrôle des permissions, rôles utilisateurs et sécurité d'accès",
    path: "/gestion_acces/utilisateurs",
  },
  {
    code: "aide_video",
    title: "Aide Vidéo",
    filterLabel: "Aide",
    color: "rose",
    icon: "video",
    description: "Tutoriels vidéo, guides interactifs et assistance pas à pas",
    path: "/aide-video",
  },
  {
    code: "a_propos",
    title: "À Propos d'AGSOFT",
    filterLabel: "À Propos",
    color: "indigo",
    icon: "info",
    description: "Informations sur l'entreprise",
    path: "https://agosoftci.com/",
  },
];

/** Clé de style Tailwind pour les puces de filtre (green → emerald). */
export function getFilterStyleKey(color) {
  return color === "green" ? "emerald" : color;
}

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
  if (!userModules || userModules.length === 0) {
    return APP_MODULES;
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
 * Puces de filtre du tableau de bord : « Tous » + un onglet par module autorisé.
 */
export function getModuleFilterChips(visibleModules) {
  const chips = [{ id: "all", label: "Tous", styleKey: "slate" }];
  for (const module of visibleModules) {
    chips.push({
      id: module.color,
      label: module.filterLabel || module.title,
      styleKey: getFilterStyleKey(module.color),
    });
  }
  return chips;
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
