import { getDocuments } from "../services/documentLocalite.service";
import { listRattachementDrafts } from "./rattachementDraftStore";
import { STATUT_BROUILLON } from "./documentStatutQualite";

function mapDocumentBrouillon(doc) {
  const chemin = Array.isArray(doc.localite_chemin)
    ? doc.localite_chemin.map((c) => c.libelle).filter(Boolean).join(" > ")
    : "";
  return {
    id: `doc-${doc.id}`,
    kind: "document",
    documentId: doc.id,
    localiteId: doc.localite,
    localiteLibelle: doc.localite_libelle || "",
    localiteCheminStr: chemin,
    typeLibelle: doc.type_document_libelle || "",
    pendingCount: 1,
    totalCount: 1,
    updatedAt: doc.date_modification
      ? new Date(doc.date_modification).getTime()
      : doc.date_creation
        ? new Date(doc.date_creation).getTime()
        : null,
    utilisateurNom: doc.importe_par?.nom || "",
    statut: doc.statut_qualite || STATUT_BROUILLON,
  };
}

async function listDocumentBrouillons() {
  const rows = [];
  let offset = 0;
  const limit = 100;
  for (let page = 0; page < 20; page += 1) {
    const res = await getDocuments({
      statutQualite: STATUT_BROUILLON,
      offset,
      limit,
    });
    const batch = Array.isArray(res.results) ? res.results : [];
    rows.push(...batch.map(mapDocumentBrouillon));
    if (!res.has_more || !batch.length) break;
    offset += limit;
  }
  return rows;
}

/** Lots de saisie + documents statut brouillon (même source que la page et le menu). */
export async function listAllVisibleBrouillons() {
  let lots = [];
  let documents = [];
  let loadError = "";
  try {
    lots = await listRattachementDrafts();
  } catch (err) {
    loadError = err.message || "Impossible de charger les lots brouillon.";
    lots = [];
  }
  try {
    documents = await listDocumentBrouillons();
  } catch {
    documents = [];
  }
  const lotRows = (Array.isArray(lots) ? lots : []).map((d) => ({
    ...d,
    kind: "lot",
    statut: "saisie",
  }));
  const merged = [...(Array.isArray(documents) ? documents : []), ...lotRows].sort(
    (a, b) => (b.updatedAt || 0) - (a.updatedAt || 0)
  );
  return { drafts: merged, loadError };
}
