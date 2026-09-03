import { useEffect, useMemo, useState } from "react";
import {
  STATUT_BROUILLON,
  STATUT_EN_ATTENTE,
  STATUT_REJETE,
  STATUT_VALIDE,
} from "./documentStatutQualite";
import {
  getModelCrudPermissions,
  getStoredUser,
  hasPermission,
  MODELS,
  PERMISSIONS,
} from "./permissions";

export const QC_PERMISSIONS = {
  VIEW: PERMISSIONS.VIEW_DOCUMENT_LOCALITE,
  CHANGE: "gestion_documentaire.change_documentlocalite",
  SOUMETTRE: "gestion_documentaire.qc_soumettre",
  VALIDER: "gestion_documentaire.qc_valider",
  REJETER: "gestion_documentaire.qc_rejeter",
  MENU_EN_ATTENTE: "gestion_documentaire.qc_menu_en_attente",
  MENU_BROUILLON: "gestion_documentaire.qc_menu_brouillon",
  MENU_REJETE: "gestion_documentaire.qc_menu_rejete",
  MENU_VALIDE: "gestion_documentaire.qc_menu_valide",
};

export const QC_MENU_PERMISSIONS = {
  [STATUT_EN_ATTENTE]: QC_PERMISSIONS.MENU_EN_ATTENTE,
  [STATUT_REJETE]: QC_PERMISSIONS.MENU_REJETE,
  [STATUT_VALIDE]: QC_PERMISSIONS.MENU_VALIDE,
};

const STATUT_ORDER = [STATUT_EN_ATTENTE, STATUT_REJETE, STATUT_VALIDE];

export function hasModule(moduleCode) {
  const user = getStoredUser();
  if (!user) return false;
  if (user.is_superuser) return true;
  if (!user.modules?.length) return true;
  return user.modules.includes(moduleCode);
}

function docCrud() {
  return getModelCrudPermissions(MODELS.DOCUMENT_LOCALITE);
}

export function canViewStatutMenu(statut) {
  if (!hasModule("controle_qualite") || !hasPermission(QC_PERMISSIONS.VIEW)) return false;
  const menuPerm = QC_MENU_PERMISSIONS[statut];
  return menuPerm ? hasPermission(menuPerm) : false;
}

export function getVisibleStatutMenus() {
  return STATUT_ORDER.filter((s) => canViewStatutMenu(s));
}

export function hasControleQualiteModule() {
  return hasModule("controle_qualite") && hasPermission(QC_PERMISSIONS.VIEW) && getVisibleStatutMenus().length > 0;
}

export function canAccessControleQualite() {
  return hasControleQualiteModule();
}

export function canPrepareQc() {
  return hasModule("controle_qualite") && hasPermission(QC_PERMISSIONS.CHANGE);
}

export function canSoumettreQc() {
  return hasModule("controle_qualite") && hasPermission(QC_PERMISSIONS.SOUMETTRE);
}

export function canValiderQc() {
  return hasModule("controle_qualite") && hasPermission(QC_PERMISSIONS.VALIDER);
}

export function canRejeterQc() {
  return hasModule("controle_qualite") && hasPermission(QC_PERMISSIONS.REJETER);
}

export function getDefaultStatutMenu() {
  const visible = getVisibleStatutMenus();
  return visible[0] || STATUT_EN_ATTENTE;
}

export function canOpenDocumentQc(statut) {
  if (!canViewStatutMenu(statut)) return false;
  if (statut === STATUT_VALIDE) return hasPermission(QC_PERMISSIONS.VIEW);
  if (statut === STATUT_EN_ATTENTE) return canValiderQc() || canRejeterQc();
  if (statut === STATUT_BROUILLON || statut === STATUT_REJETE) return canPrepareQc();
  return false;
}

/** Accès géographique à une localité feuille (groupes ou sans restriction). */
export function canAccessLocalite(localiteId) {
  const user = getStoredUser();
  if (!user) return false;
  if (user.is_superuser) return true;
  const localites = user.localites || [];
  if (localites.length === 0) return true;
  const id = Number(localiteId);
  return localites.some((loc) => Number(typeof loc === "object" ? loc.id : loc) === id);
}

/** Peut ouvrir le contrôle qualité sur les documents en attente de cette localité. */
export function canRedirectToControleQualiteAfterImport(localiteId) {
  if (!canViewStatutMenu(STATUT_EN_ATTENTE) || !canOpenDocumentQc(STATUT_EN_ATTENTE)) {
    return false;
  }
  return canAccessLocalite(localiteId);
}

/** URL de redirection après rattachement, ou null pour revenir au plan de classement. */
export function getControleQualiteRedirectAfterImport(localiteId, documentResult) {
  if (!canRedirectToControleQualiteAfterImport(localiteId)) return null;
  const docId = documentResult?.id;
  if (docId) {
    return `/controle_qualite/validation/${localiteId}/${docId}?statut=${STATUT_EN_ATTENTE}`;
  }
  return `/controle_qualite/${STATUT_EN_ATTENTE}?casier=${localiteId}`;
}

export function getQcActionLabel(statut) {
  if (statut === STATUT_VALIDE) return "Consulter";
  return "Contrôler";
}

export function useControleQualitePermissions() {
  const [version, setVersion] = useState(0);

  useEffect(() => {
    const onUpdate = () => setVersion((v) => v + 1);
    window.addEventListener("user-profile-updated", onUpdate);
    return () => window.removeEventListener("user-profile-updated", onUpdate);
  }, []);

  return useMemo(() => {
    const crud = docCrud();
    return {
      canAccess: canAccessControleQualite(),
      canView: crud.canView,
      canChange: crud.canChange,
      canPrepare: canPrepareQc(),
      canSoumettre: canSoumettreQc(),
      canValider: canValiderQc(),
      canRejeter: canRejeterQc(),
      canViewStatutMenu,
      canOpenDocumentQc,
      getVisibleStatutMenus,
      getQcActionLabel,
    };
  }, [version]);
}
