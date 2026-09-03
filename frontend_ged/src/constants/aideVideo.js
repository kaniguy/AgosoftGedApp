/** Chemins d'ouverture des modules depuis l'aide. */
export const AIDE_MODULE_PATHS = {
  general: "/",
  parametrage: "/parametrage/type_document",
  gestion_documentaire: "/gestion_documentaire/plan_geographique",
  controle_qualite: "/controle_qualite",
  recherche_avancee: "/recherche_avancee",
  gestion_acces: "/gestion_acces/utilisateurs",
  analytique: "/analytique/documents",
};

export function getAideModulePath(moduleCode) {
  return AIDE_MODULE_PATHS[moduleCode] || "/";
}
