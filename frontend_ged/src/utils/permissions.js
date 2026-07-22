"use client";

import { useEffect, useMemo, useState } from "react";

/** Clés des modèles Django pour les droits CRUD. */
export const MODELS = {
  TYPE_DOCUMENT: "type_document",
  CHAMPS_DOCUMENT: "champs_document",
  STRUCTURE_GEOGRAPHIQUE: "structure_geographique",
  PLAN_GEOGRAPHIQUE: "plan_geographique",
  DOCUMENT_LOCALITE: "document_localite",
  USER: "user",
  GROUP: "group",
  ENTREPRISE: "entreprise",
  LIEN_TELECHARGEMENT: "lien_telechargement",
  JOURNAL_ACTIVITE: "journal_activite",
  CONFIGURATION_EMAIL: "configuration_email",
  REGLE_NOTIFICATION: "regle_notification",
};

/** Permissions Django par modèle (view / add / change / delete). */
export const MODEL_PERMISSIONS = {
  [MODELS.TYPE_DOCUMENT]: {
    view: "parametrage.view_typedocument",
    add: "parametrage.add_typedocument",
    change: "parametrage.change_typedocument",
    delete: "parametrage.delete_typedocument",
  },
  [MODELS.CHAMPS_DOCUMENT]: {
    view: "parametrage.view_champsdocument",
    add: "parametrage.add_champsdocument",
    change: "parametrage.change_champsdocument",
    delete: "parametrage.delete_champsdocument",
  },
  [MODELS.STRUCTURE_GEOGRAPHIQUE]: {
    view: "parametrage.view_structuregeographique",
    add: "parametrage.add_structuregeographique",
    change: "parametrage.change_structuregeographique",
    delete: "parametrage.delete_structuregeographique",
  },
  [MODELS.PLAN_GEOGRAPHIQUE]: {
    view: "parametrage.view_plangeographique",
    add: "parametrage.add_plangeographique",
    change: "parametrage.change_plangeographique",
    delete: "parametrage.delete_plangeographique",
  },
  [MODELS.DOCUMENT_LOCALITE]: {
    view: "gestion_documentaire.view_documentlocalite",
    add: "gestion_documentaire.add_documentlocalite",
    change: "gestion_documentaire.change_documentlocalite",
    delete: "gestion_documentaire.delete_documentlocalite",
  },
  [MODELS.USER]: {
    view: "auth.view_user",
    add: "auth.add_user",
    change: "auth.change_user",
    delete: "auth.delete_user",
  },
  [MODELS.GROUP]: {
    view: "auth.view_group",
    add: "auth.add_group",
    change: "auth.change_group",
    delete: "auth.delete_group",
  },
  [MODELS.ENTREPRISE]: {
    view: "gestion_acces.view_entreprise",
    add: "gestion_acces.add_entreprise",
    change: "gestion_acces.change_entreprise",
    delete: "gestion_acces.delete_entreprise",
  },
  [MODELS.LIEN_TELECHARGEMENT]: {
    view: "gestion_acces.view_lientelechargement",
    add: "gestion_acces.add_lientelechargement",
    change: "gestion_acces.change_lientelechargement",
    delete: "gestion_acces.delete_lientelechargement",
  },
  [MODELS.JOURNAL_ACTIVITE]: {
    view: "gestion_acces.view_journalactivite",
    add: "gestion_acces.add_journalactivite",
    change: "gestion_acces.change_journalactivite",
    delete: "gestion_acces.delete_journalactivite",
  },
  [MODELS.CONFIGURATION_EMAIL]: {
    view: "gestion_acces.view_configurationemail",
    add: "gestion_acces.add_configurationemail",
    change: "gestion_acces.change_configurationemail",
    delete: "gestion_acces.delete_configurationemail",
  },
  [MODELS.REGLE_NOTIFICATION]: {
    view: "gestion_acces.view_reglenotification",
    add: "gestion_acces.add_reglenotification",
    change: "gestion_acces.change_reglenotification",
    delete: "gestion_acces.delete_reglenotification",
  },
};

/** Alias pour les menus (rétrocompatibilité). */
export const PERMISSIONS = {
  VIEW_TYPE_DOCUMENT: MODEL_PERMISSIONS[MODELS.TYPE_DOCUMENT].view,
  VIEW_CHAMPS_DOCUMENT: MODEL_PERMISSIONS[MODELS.CHAMPS_DOCUMENT].view,
  VIEW_STRUCTURE_GEOGRAPHIQUE: MODEL_PERMISSIONS[MODELS.STRUCTURE_GEOGRAPHIQUE].view,
  VIEW_PLAN_GEOGRAPHIQUE: MODEL_PERMISSIONS[MODELS.PLAN_GEOGRAPHIQUE].view,
  VIEW_DOCUMENT_LOCALITE: MODEL_PERMISSIONS[MODELS.DOCUMENT_LOCALITE].view,
  VIEW_USER: MODEL_PERMISSIONS[MODELS.USER].view,
  VIEW_GROUP: MODEL_PERMISSIONS[MODELS.GROUP].view,
  VIEW_PERMISSION: "auth.view_permission",
  VIEW_ENTREPRISE: "gestion_acces.view_entreprise",
  CHANGE_ENTREPRISE: "gestion_acces.change_entreprise",
  VIEW_LIEN_TELECHARGEMENT: "gestion_acces.view_lientelechargement",
  ADD_LIEN_TELECHARGEMENT: "gestion_acces.add_lientelechargement",
  CHANGE_LIEN_TELECHARGEMENT: "gestion_acces.change_lientelechargement",
  VIEW_JOURNAL_ACTIVITE: "gestion_acces.view_journalactivite",
  VIEW_CONFIGURATION_EMAIL: "gestion_acces.view_configurationemail",
  CHANGE_CONFIGURATION_EMAIL: "gestion_acces.change_configurationemail",
  VIEW_REGLE_NOTIFICATION: "gestion_acces.view_reglenotification",
  CHANGE_REGLE_NOTIFICATION: "gestion_acces.change_reglenotification",
  VIEW_NOTIFICATION_EMAIL_LOG: "gestion_acces.view_notificationemaillog",
  QC_SOUMETTRE: "gestion_documentaire.qc_soumettre",
  QC_VALIDER: "gestion_documentaire.qc_valider",
  QC_REJETER: "gestion_documentaire.qc_rejeter",
  QC_MENU_EN_ATTENTE: "gestion_documentaire.qc_menu_en_attente",
  QC_MENU_BROUILLON: "gestion_documentaire.qc_menu_brouillon",
  QC_MENU_REJETE: "gestion_documentaire.qc_menu_rejete",
  QC_MENU_VALIDE: "gestion_documentaire.qc_menu_valide",
  ANNOTER_DOCUMENT: "gestion_documentaire.annoter_document",
  TAMPONNER_DOCUMENT: "gestion_documentaire.tamponner_document",
  SIGNER_DOCUMENT: "gestion_documentaire.signer_document",
  COMMENTER_DOCUMENT: "gestion_documentaire.commenter_document",
};

/** Lit l'utilisateur depuis le localStorage. */
export function getStoredUser() {
  if (typeof window === "undefined") return null;
  try {
    return JSON.parse(localStorage.getItem("user") || "null");
  } catch {
    return null;
  }
}

/**
 * Retourne la liste des permissions ou null si accès complet (superuser).
 */
export function getStoredPermissions() {
  const user = getStoredUser();
  if (!user) return [];
  if (user.is_superuser) return null;
  return user.permissions ?? [];
}

/** Vérifie si l'utilisateur possède une permission Django. */
export function hasPermission(codename) {
  if (!codename) return true;
  const perms = getStoredPermissions();
  if (perms === null) return true;
  return perms.includes(codename);
}

/** Vérifie si l'utilisateur possède au moins une des permissions listées. */
export function hasAnyPermission(codenames = []) {
  if (!codenames.length) return true;
  return codenames.some((c) => hasPermission(c));
}

/** Droits CRUD pour un modèle donné. */
export function getModelCrudPermissions(modelKey) {
  const defs = MODEL_PERMISSIONS[modelKey];
  if (!defs) {
    return { canView: true, canAdd: true, canChange: true, canDelete: true };
  }
  return {
    canView: hasPermission(defs.view),
    canAdd: hasPermission(defs.add),
    canChange: hasPermission(defs.change),
    canDelete: hasPermission(defs.delete),
  };
}

/** Hook React : droits CRUD réactifs après login / refresh profil. */
export function useCrudPermissions(modelKey) {
  const [version, setVersion] = useState(0);

  useEffect(() => {
    const onUpdate = () => setVersion((v) => v + 1);
    window.addEventListener("user-profile-updated", onUpdate);
    return () => window.removeEventListener("user-profile-updated", onUpdate);
  }, []);

  return useMemo(() => {
    const rights = getModelCrudPermissions(modelKey);
    return {
      ...rights,
      canWrite: rights.canAdd || rights.canChange || rights.canDelete,
    };
  }, [modelKey, version]);
}
