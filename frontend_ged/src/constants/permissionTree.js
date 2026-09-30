/**
 * Dépendances entre permissions (cascade).
 * Cocher une action ajoute ses prérequis (ex. importer → consulter docs + types + champs + plan).
 */

export const PERMISSION_REQUIRES = {
  "gestion_documentaire.view_documentlocalite": [
    "parametrage.view_typedocument",
    "parametrage.view_champsdocument",
    "parametrage.view_plangeographique",
    "parametrage.view_structuregeographique",
    "parametrage.view_reponsedocument",
    "parametrage.view_valeurchamp",
  ],
  "gestion_documentaire.add_documentlocalite": [
    "gestion_documentaire.view_documentlocalite",
    "parametrage.add_reponsedocument",
    "parametrage.add_valeurchamp",
  ],
  "gestion_documentaire.change_documentlocalite": [
    "gestion_documentaire.view_documentlocalite",
    "parametrage.change_reponsedocument",
    "parametrage.add_valeurchamp",
    "parametrage.change_valeurchamp",
    "parametrage.delete_valeurchamp",
  ],
  "gestion_documentaire.delete_documentlocalite": [
    "gestion_documentaire.view_documentlocalite",
    "parametrage.delete_reponsedocument",
    "parametrage.delete_valeurchamp",
  ],
  "gestion_documentaire.telecharger_document": ["gestion_documentaire.view_documentlocalite"],
  "gestion_documentaire.annoter_document": ["gestion_documentaire.view_documentlocalite"],
  "gestion_documentaire.tamponner_document": ["gestion_documentaire.view_documentlocalite"],
  "gestion_documentaire.signer_document": ["gestion_documentaire.view_documentlocalite"],
  "gestion_documentaire.commenter_document": ["gestion_documentaire.view_documentlocalite"],
  "gestion_documentaire.qc_soumettre": ["gestion_documentaire.view_documentlocalite"],
  "gestion_documentaire.qc_valider": ["gestion_documentaire.view_documentlocalite"],
  "gestion_documentaire.qc_rejeter": ["gestion_documentaire.view_documentlocalite"],
  "gestion_documentaire.qc_menu_en_attente": ["gestion_documentaire.view_documentlocalite"],
  "gestion_documentaire.qc_menu_brouillon": ["gestion_documentaire.view_documentlocalite"],
  "gestion_documentaire.qc_menu_rejete": ["gestion_documentaire.view_documentlocalite"],
  "gestion_documentaire.qc_menu_valide": ["gestion_documentaire.view_documentlocalite"],
  "parametrage.view_champsdocument": ["parametrage.view_typedocument"],
  "parametrage.add_typedocument": ["parametrage.view_typedocument"],
  "parametrage.change_typedocument": ["parametrage.view_typedocument"],
  "parametrage.delete_typedocument": ["parametrage.view_typedocument"],
  "parametrage.add_champsdocument": [
    "parametrage.view_champsdocument",
    "parametrage.add_optionchamp",
  ],
  "parametrage.change_champsdocument": [
    "parametrage.view_champsdocument",
    "parametrage.add_optionchamp",
    "parametrage.change_optionchamp",
    "parametrage.delete_optionchamp",
  ],
  "parametrage.delete_champsdocument": [
    "parametrage.view_champsdocument",
    "parametrage.delete_optionchamp",
  ],
  "parametrage.view_optionchamp": ["parametrage.view_champsdocument"],
  "parametrage.add_optionchamp": ["parametrage.view_optionchamp"],
  "parametrage.change_optionchamp": ["parametrage.view_optionchamp"],
  "parametrage.delete_optionchamp": ["parametrage.view_optionchamp"],
  "parametrage.view_reponsedocument": ["parametrage.view_typedocument"],
  "parametrage.add_reponsedocument": ["parametrage.view_reponsedocument"],
  "parametrage.change_reponsedocument": ["parametrage.view_reponsedocument"],
  "parametrage.delete_reponsedocument": ["parametrage.view_reponsedocument"],
  "parametrage.view_valeurchamp": [
    "parametrage.view_reponsedocument",
    "parametrage.view_champsdocument",
  ],
  "parametrage.add_valeurchamp": ["parametrage.view_valeurchamp"],
  "parametrage.change_valeurchamp": ["parametrage.view_valeurchamp"],
  "parametrage.delete_valeurchamp": ["parametrage.view_valeurchamp"],
  "parametrage.add_plangeographique": [
    "parametrage.view_plangeographique",
    "parametrage.view_structuregeographique",
  ],
  "parametrage.change_plangeographique": ["parametrage.view_plangeographique"],
  "parametrage.delete_plangeographique": ["parametrage.view_plangeographique"],
  "parametrage.add_structuregeographique": ["parametrage.view_structuregeographique"],
  "parametrage.change_structuregeographique": ["parametrage.view_structuregeographique"],
  "parametrage.delete_structuregeographique": ["parametrage.view_structuregeographique"],
  "gestion_acces.change_entreprise": ["gestion_acces.view_entreprise"],
  "gestion_acces.change_configurationemail": ["gestion_acces.view_configurationemail"],
  "gestion_acces.change_reglenotification": ["gestion_acces.view_reglenotification"],
  "gestion_acces.view_modeleemailnotification": ["gestion_acces.view_reglenotification"],
  "gestion_acces.change_modeleemailnotification": ["gestion_acces.view_modeleemailnotification"],
  "gestion_acces.view_configurationresumeperiodique": ["gestion_acces.view_reglenotification"],
  "gestion_acces.change_configurationresumeperiodique": [
    "gestion_acces.view_configurationresumeperiodique",
  ],
  "gestion_acces.view_notificationemaillog": ["gestion_acces.view_reglenotification"],
  "gestion_acces.add_guideaide": ["gestion_acces.view_guideaide"],
  "gestion_acces.change_guideaide": ["gestion_acces.view_guideaide"],
  "gestion_acces.delete_guideaide": ["gestion_acces.view_guideaide"],
  "auth.add_user": ["auth.view_user"],
  "auth.change_user": ["auth.view_user"],
  "auth.delete_user": ["auth.view_user"],
  "auth.add_group": ["auth.view_group"],
  "auth.change_group": ["auth.view_group"],
  "auth.delete_group": ["auth.view_group"],
};

/** Arbre d'affichage (codenames app.label). */
export const PERMISSION_TREE = [
  {
    id: "ged",
    label: "Gestion documentaire",
    children: [
      {
        codename: "gestion_documentaire.view_documentlocalite",
        label: "Consulter les documents",
        children: [
          { codename: "gestion_documentaire.add_documentlocalite", label: "Importer / rattacher des documents" },
          { codename: "gestion_documentaire.change_documentlocalite", label: "Modifier des documents" },
          { codename: "gestion_documentaire.delete_documentlocalite", label: "Supprimer des documents" },
          { codename: "gestion_documentaire.telecharger_document", label: "Télécharger des documents" },
          { codename: "gestion_documentaire.annoter_document", label: "Annoter" },
          { codename: "gestion_documentaire.tamponner_document", label: "Tamponner" },
          { codename: "gestion_documentaire.signer_document", label: "Signer" },
          { codename: "gestion_documentaire.commenter_document", label: "Commenter" },
        ],
      },
      {
        id: "qc",
        label: "Contrôle qualité",
        children: [
          { codename: "gestion_documentaire.qc_soumettre", label: "Soumettre au contrôle qualité" },
          { codename: "gestion_documentaire.qc_valider", label: "Valider" },
          { codename: "gestion_documentaire.qc_rejeter", label: "Rejeter" },
          { codename: "gestion_documentaire.qc_menu_en_attente", label: "Menu en attente" },
          { codename: "gestion_documentaire.qc_menu_brouillon", label: "Menu brouillon" },
          { codename: "gestion_documentaire.qc_menu_rejete", label: "Menu rejetés" },
          { codename: "gestion_documentaire.qc_menu_valide", label: "Menu validés" },
        ],
      },
    ],
  },
  {
    id: "refs",
    label: "Référentiels nécessaires (types, champs, plan)",
    hint: "Cochés automatiquement si vous autorisez la consultation ou l’import de documents.",
    children: [
      {
        codename: "parametrage.view_typedocument",
        label: "Consulter les types de documents",
        children: [
          { codename: "parametrage.add_typedocument", label: "Ajouter un type" },
          { codename: "parametrage.change_typedocument", label: "Modifier un type" },
          { codename: "parametrage.delete_typedocument", label: "Supprimer un type" },
        ],
      },
      {
        codename: "parametrage.view_champsdocument",
        label: "Consulter les champs de documents",
        children: [
          { codename: "parametrage.add_champsdocument", label: "Ajouter un champ" },
          { codename: "parametrage.change_champsdocument", label: "Modifier un champ" },
          { codename: "parametrage.delete_champsdocument", label: "Supprimer un champ" },
        ],
      },
      {
        codename: "parametrage.view_plangeographique",
        label: "Consulter le plan de classement",
        children: [
          { codename: "parametrage.add_plangeographique", label: "Ajouter une localité" },
          { codename: "parametrage.change_plangeographique", label: "Modifier une localité" },
          { codename: "parametrage.delete_plangeographique", label: "Supprimer une localité" },
        ],
      },
      {
        codename: "parametrage.view_structuregeographique",
        label: "Consulter les structures géographiques",
        children: [
          { codename: "parametrage.add_structuregeographique", label: "Ajouter un niveau" },
          { codename: "parametrage.change_structuregeographique", label: "Modifier un niveau" },
          { codename: "parametrage.delete_structuregeographique", label: "Supprimer un niveau" },
        ],
      },
    ],
  },
  {
    id: "parametrage_application",
    label: "Paramétrage de l'application",
    hint: "Entreprise, SMTP-MAIL, notifications et aide vidéo (menu Paramétrage).",
    children: [
      {
        codename: "gestion_acces.view_entreprise",
        label: "Consulter les informations de l'entreprise",
        children: [
          { codename: "gestion_acces.change_entreprise", label: "Modifier l'entreprise" },
        ],
      },
      {
        codename: "gestion_acces.view_configurationemail",
        label: "Consulter la configuration SMTP-MAIL",
        children: [
          { codename: "gestion_acces.change_configurationemail", label: "Modifier la configuration SMTP-MAIL" },
        ],
      },
      {
        codename: "gestion_acces.view_reglenotification",
        label: "Consulter les règles de notification",
        children: [
          { codename: "gestion_acces.change_reglenotification", label: "Modifier les règles" },
          { codename: "gestion_acces.view_modeleemailnotification", label: "Consulter les modèles d'e-mails" },
          { codename: "gestion_acces.change_modeleemailnotification", label: "Modifier les modèles d'e-mails" },
          { codename: "gestion_acces.view_configurationresumeperiodique", label: "Consulter le résumé périodique" },
          { codename: "gestion_acces.change_configurationresumeperiodique", label: "Modifier le résumé périodique" },
          { codename: "gestion_acces.view_notificationemaillog", label: "Consulter le journal des envois" },
        ],
      },
      {
        codename: "gestion_acces.view_guideaide",
        label: "Consulter les tutoriels (Aide Vidéo)",
        children: [
          { codename: "gestion_acces.add_guideaide", label: "Ajouter un tutoriel" },
          { codename: "gestion_acces.change_guideaide", label: "Modifier un tutoriel" },
          { codename: "gestion_acces.delete_guideaide", label: "Supprimer un tutoriel" },
        ],
      },
    ],
  },
  {
    id: "acces",
    label: "Gestion des accès",
    children: [
      {
        codename: "auth.view_user",
        label: "Consulter les utilisateurs",
        children: [
          { codename: "auth.add_user", label: "Ajouter" },
          { codename: "auth.change_user", label: "Modifier" },
          { codename: "auth.delete_user", label: "Supprimer" },
        ],
      },
      {
        codename: "auth.view_group",
        label: "Consulter les groupes",
        children: [
          { codename: "auth.add_group", label: "Ajouter" },
          { codename: "auth.change_group", label: "Modifier" },
          { codename: "auth.delete_group", label: "Supprimer" },
        ],
      },
    ],
  },
];

/** Permissions internes : cascade en coulisse, jamais affichées dans l’arbre. */
export const HIDDEN_PERMISSION_KEYS = new Set([
  "parametrage.view_optionchamp",
  "parametrage.add_optionchamp",
  "parametrage.change_optionchamp",
  "parametrage.delete_optionchamp",
  "parametrage.view_reponsedocument",
  "parametrage.add_reponsedocument",
  "parametrage.change_reponsedocument",
  "parametrage.delete_reponsedocument",
  "parametrage.view_valeurchamp",
  "parametrage.add_valeurchamp",
  "parametrage.change_valeurchamp",
  "parametrage.delete_valeurchamp",
  "gestion_acces.view_sauvegardebase",
  "gestion_acces.exporter_sauvegardebase",
  "gestion_acces.restaurer_sauvegardebase",
  "gestion_acces.reinitialiser_sauvegardebase",
]);

export function isHiddenPermissionKey(key) {
  return HIDDEN_PERMISSION_KEYS.has(key);
}

export function permKey(perm) {
  return `${perm.app_label}.${perm.codename}`;
}

export function collectRequires(codename, acc = new Set()) {
  if (!codename || acc.has(codename)) return acc;
  acc.add(codename);
  for (const req of PERMISSION_REQUIRES[codename] || []) {
    collectRequires(req, acc);
  }
  return acc;
}

export function collectDependents(codename, acc = new Set()) {
  if (!codename) return acc;
  acc.add(codename);
  for (const [child, reqs] of Object.entries(PERMISSION_REQUIRES)) {
    if (reqs.includes(codename) && !acc.has(child)) {
      collectDependents(child, acc);
    }
  }
  return acc;
}

export function expandCodenameSet(codenames) {
  const expanded = new Set();
  for (const c of codenames || []) {
    collectRequires(c, expanded);
  }
  return expanded;
}

export function idsForCodenames(codenames, allPerms) {
  const wanted = expandCodenameSet(codenames);
  return allPerms
    .filter((p) => wanted.has(permKey(p)))
    .map((p) => Number(p.id));
}

export function flattenTreeCodenames(nodes = PERMISSION_TREE, acc = new Set()) {
  for (const node of nodes) {
    if (node.codename) acc.add(node.codename);
    if (node.children?.length) flattenTreeCodenames(node.children, acc);
  }
  return acc;
}

export function nodeHasVisiblePerm(node, visibleKeys) {
  if (node.codename && visibleKeys.has(node.codename)) return true;
  return (node.children || []).some((child) => nodeHasVisiblePerm(child, visibleKeys));
}

/** Ajoute les prérequis de toutes les permissions déjà cochées. */
export function expandPermissionIds(selectedIds, allPerms) {
  const idSet = new Set((selectedIds || []).map(Number));
  const keys = allPerms.filter((p) => idSet.has(Number(p.id))).map(permKey);
  return [...new Set([...(selectedIds || []).map(Number), ...idsForCodenames(keys, allPerms)])];
}

/**
 * Cocher une permission ajoute ses prérequis.
 * Décocher retire aussi toutes les permissions qui en dépendent.
 */
export function togglePermissionCascade(selectedIds, permId, allPerms) {
  const id = Number(permId);
  const perm = allPerms.find((p) => Number(p.id) === id);
  if (!perm) return (selectedIds || []).map(Number);
  const current = new Set((selectedIds || []).map(Number));
  const key = permKey(perm);
  if (current.has(id)) {
    const removeKeys = collectDependents(key);
    const removeIds = new Set(
      allPerms.filter((p) => removeKeys.has(permKey(p))).map((p) => Number(p.id))
    );
    return (selectedIds || []).map(Number).filter((x) => !removeIds.has(x));
  }
  return [...new Set([...current, ...idsForCodenames([key], allPerms)])];
}

export function removePermissionKeysCascade(selectedIds, keysToRemove, allPerms) {
  const removeKeys = new Set();
  for (const key of keysToRemove || []) collectDependents(key, removeKeys);
  const removeIds = new Set(
    allPerms.filter((p) => removeKeys.has(permKey(p))).map((p) => Number(p.id))
  );
  return (selectedIds || []).map(Number).filter((x) => !removeIds.has(x));
}
