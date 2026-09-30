"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { canAccessGuideAideAdmin, useCrudPermissions, MODELS } from "../../../utils/permissions";
import {
  deleteGuideAide,
  listGuidesAide,
  saveGuideAide,
} from "../../../services/guideAide.service";

const emptyForm = {
  module_code: "general",
  titre: "",
  description: "",
  include_youtube: true,
  include_documents: true,
  include_guide: true,
  youtube_url: "",
  documents_files: [],
  delete_document_ids: [],
  existing_documents: [],
  guide: "",
  ordre: 0,
  actif: true,
};

export default function GestionAideVideoPage() {
  const router = useRouter();
  const canAccess = canAccessGuideAideAdmin();
  const { canAdd, canChange, canDelete } = useCrudPermissions(MODELS.GUIDE_AIDE);
  const fileRef = useRef(null);
  const [guides, setGuides] = useState([]);
  const [modules, setModules] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [message, setMessage] = useState({ type: "", text: "" });
  const [showForm, setShowForm] = useState(false);

  const load = async () => {
    try {
      const data = await listGuidesAide();
      setGuides(data.results);
      setModules(data.modules);
    } catch (err) {
      setMessage({ type: "error", text: err.message || "Chargement impossible." });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!canAccess) {
      setLoading(false);
      return;
    }
    load();
  }, [canAccess]);

  const moduleLabel = useMemo(() => {
    const map = Object.fromEntries(modules.map((m) => [m.code, m.label]));
    return (code) => map[code] || code;
  }, [modules]);

  const resetForm = () => {
    setEditingId(null);
    setForm({
      ...emptyForm,
      module_code: modules[0]?.code || "general",
    });
    if (fileRef.current) fileRef.current.value = "";
  };

  const openCreate = () => {
    resetForm();
    setShowForm(true);
    setMessage({ type: "", text: "" });
  };

  const openEdit = (guide) => {
    setEditingId(guide.id);
    setForm({
      module_code: guide.module_code,
      titre: guide.titre || "",
      description: guide.description || "",
      include_youtube: Boolean(guide.youtube_url),
      include_documents: Boolean((guide.documents || []).length),
      include_guide: Boolean((guide.guide || "").trim()),
      youtube_url: guide.youtube_url || "",
      documents_files: [],
      delete_document_ids: [],
      existing_documents: guide.documents || [],
      guide: guide.guide || "",
      ordre: guide.ordre ?? 0,
      actif: Boolean(guide.actif),
    });
    if (fileRef.current) fileRef.current.value = "";
    setShowForm(true);
    setMessage({ type: "", text: "" });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (saving) return;
    setSaving(true);
    setMessage({ type: "", text: "" });
    try {
      const deleteIds = form.include_documents
        ? form.delete_document_ids
        : [
            ...form.delete_document_ids,
            ...form.existing_documents.map((d) => d.id),
          ];
      await saveGuideAide(
        {
          ...form,
          youtube_url: form.include_youtube ? form.youtube_url : "",
          documents_files: form.include_documents ? form.documents_files : [],
          delete_document_ids: deleteIds,
          guide: form.include_guide ? form.guide : "",
        },
        editingId
      );
      setMessage({ type: "success", text: "Guide enregistré." });
      setShowForm(false);
      resetForm();
      await load();
    } catch (err) {
      setMessage({ type: "error", text: err.message });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (guide) => {
    if (!window.confirm(`Supprimer « ${guide.titre} » ?`)) return;
    try {
      await deleteGuideAide(guide.id);
      if (editingId === guide.id) {
        setShowForm(false);
        resetForm();
      }
      await load();
    } catch (err) {
      setMessage({ type: "error", text: err.message });
    }
  };

  const markDocumentDeleted = (id) => {
    setForm((p) => ({
      ...p,
      delete_document_ids: [...p.delete_document_ids, id],
      existing_documents: p.existing_documents.filter((d) => d.id !== id),
    }));
  };

  if (!canAccess) {
    return (
      <div className="max-w-xl mx-auto py-16 text-center">
        <h1 className="text-xl font-semibold text-slate-800">Accès réservé</h1>
        <p className="text-sm text-slate-500 mt-2">
          Il faut la permission de consulter ou de gérer les guides d’aide.
        </p>
      </div>
    );
  }

  return (
    <div className="w-full">
      <nav className="text-sm flex flex-wrap items-center gap-1.5 mb-6">
        <button type="button" onClick={() => router.push("/")} className="text-slate-500 hover:text-purple-600">
          Accueil
        </button>
        <span className="text-slate-300">/</span>
        <span className="text-slate-400">Paramétrage</span>
        <span className="text-slate-300">/</span>
        <span className="text-purple-700 font-semibold">Aide Vidéo</span>
      </nav>

      <div className="flex flex-wrap items-start justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Guides d’aide</h1>
          <p className="text-sm text-slate-500 mt-1">
            Cochez une ou plusieurs options : lien YouTube, documents et guide écrit.
          </p>
        </div>
        {canAdd && (
          <button
            type="button"
            onClick={openCreate}
            className="px-4 py-2 rounded-lg bg-purple-600 text-white text-sm font-medium hover:bg-purple-700"
          >
            Nouveau guide
          </button>
        )}
      </div>

      {message.text && (
        <div
          className={`mb-4 px-4 py-3 rounded-lg text-sm ${
            message.type === "error" ? "bg-red-50 text-red-700" : "bg-emerald-50 text-emerald-700"
          }`}
        >
          {message.text}
        </div>
      )}

      {showForm && (canAdd || canChange) && (
        <form
          onSubmit={handleSubmit}
          className="mb-8 bg-white rounded-2xl border border-purple-100 shadow-sm p-6 space-y-4"
        >
          <h2 className="font-semibold text-slate-800">
            {editingId ? "Modifier le guide" : "Nouveau guide"}
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <label className="text-sm text-slate-600">
              Module
              <select
                value={form.module_code}
                onChange={(e) => setForm((p) => ({ ...p, module_code: e.target.value }))}
                className="mt-1 w-full border border-slate-200 rounded-lg px-3 py-2"
                required
              >
                {modules.map((m) => (
                  <option key={m.code} value={m.code}>
                    {m.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="text-sm text-slate-600">
              Titre
              <input
                value={form.titre}
                onChange={(e) => setForm((p) => ({ ...p, titre: e.target.value }))}
                className="mt-1 w-full border border-slate-200 rounded-lg px-3 py-2"
                maxLength={180}
                required
              />
            </label>
          </div>
          <label className="text-sm text-slate-600 block">
            Description
            <input
              value={form.description}
              onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))}
              className="mt-1 w-full border border-slate-200 rounded-lg px-3 py-2"
              maxLength={400}
            />
          </label>

          <fieldset className="border border-slate-200 rounded-xl p-4 space-y-4">
            <legend className="text-sm font-medium text-slate-700 px-1">
              Contenus du guide (sélection multiple)
            </legend>
            <p className="text-xs text-slate-400">
              Cochez une ou plusieurs options : YouTube, documents et guide écrit peuvent coexister.
            </p>
            <div className="flex flex-wrap gap-4 text-sm text-slate-700">
              <label className="inline-flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={form.include_youtube}
                  onChange={(e) => setForm((p) => ({ ...p, include_youtube: e.target.checked }))}
                />
                Lien YouTube
              </label>
              <label className="inline-flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={form.include_documents}
                  onChange={(e) => setForm((p) => ({ ...p, include_documents: e.target.checked }))}
                />
                Importer un fichier
              </label>
              <label className="inline-flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={form.include_guide}
                  onChange={(e) => setForm((p) => ({ ...p, include_guide: e.target.checked }))}
                />
                Pas de vidéo (guide seul)
              </label>
            </div>

            {form.include_youtube && (
              <label className="text-sm text-slate-600 block">
                Lien YouTube
                <input
                  value={form.youtube_url}
                  onChange={(e) => setForm((p) => ({ ...p, youtube_url: e.target.value }))}
                  placeholder="https://www.youtube.com/watch?v=…"
                  className="mt-1 w-full border border-slate-200 rounded-lg px-3 py-2"
                />
              </label>
            )}

            {form.include_documents && (
              <div className="text-sm text-slate-600">
                <p className="mb-2">Importer des fichiers (sélection multiple : PDF ou images)</p>
                {form.existing_documents.length > 0 && (
                  <ul className="mb-3 space-y-1">
                    {form.existing_documents.map((doc) => (
                      <li key={doc.id} className="flex items-center justify-between gap-2 bg-slate-50 rounded-lg px-3 py-2">
                        <span className="truncate">{doc.nom}</span>
                        <button
                          type="button"
                          onClick={() => markDocumentDeleted(doc.id)}
                          className="text-red-600 text-xs hover:underline shrink-0"
                        >
                          Retirer
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
                <input
                  ref={fileRef}
                  type="file"
                  multiple
                  accept=".pdf,.jpg,.jpeg,.png,.webp,.gif,application/pdf,image/*"
                  onChange={(e) => {
                    const added = Array.from(e.target.files || []);
                    setForm((p) => ({
                      ...p,
                      documents_files: [...p.documents_files, ...added],
                    }));
                    e.target.value = "";
                  }}
                  className="w-full text-sm"
                />
                {form.documents_files.length > 0 && (
                  <ul className="mt-2 space-y-1 text-xs text-slate-500">
                    {form.documents_files.map((file, index) => (
                      <li key={`${file.name}-${index}`} className="flex items-center justify-between gap-2">
                        <span className="truncate">{file.name}</span>
                        <button
                          type="button"
                          onClick={() =>
                            setForm((p) => ({
                              ...p,
                              documents_files: p.documents_files.filter((_, i) => i !== index),
                            }))
                          }
                          className="text-red-600 hover:underline shrink-0"
                        >
                          Retirer
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}

            {form.include_guide && (
              <label className="text-sm text-slate-600 block">
                Guide écrit (une étape par ligne)
                <textarea
                  value={form.guide}
                  onChange={(e) => setForm((p) => ({ ...p, guide: e.target.value }))}
                  rows={8}
                  className="mt-1 w-full border border-slate-200 rounded-lg px-3 py-2 font-sans"
                  placeholder={"Ouvrez le module…\nChoisissez un casier…\nEnregistrez le document."}
                />
              </label>
            )}
          </fieldset>

          <div className="flex flex-wrap items-center gap-4">
            <label className="text-sm text-slate-600">
              Ordre
              <input
                type="number"
                min="0"
                value={form.ordre}
                onChange={(e) => setForm((p) => ({ ...p, ordre: Number(e.target.value) || 0 }))}
                className="ml-2 w-20 border border-slate-200 rounded-lg px-2 py-1"
              />
            </label>
            <label className="inline-flex items-center gap-2 text-sm text-slate-600">
              <input
                type="checkbox"
                checked={form.actif}
                onChange={(e) => setForm((p) => ({ ...p, actif: e.target.checked }))}
              />
              Publié (visible dans Aide Vidéo)
            </label>
          </div>

          <div className="flex gap-3 pt-2">
            <button
              type="submit"
              disabled={saving}
              className="px-4 py-2 rounded-lg bg-purple-600 text-white text-sm font-medium hover:bg-purple-700 disabled:opacity-60"
            >
              {saving ? "Enregistrement…" : "Enregistrer"}
            </button>
            <button
              type="button"
              onClick={() => {
                setShowForm(false);
                resetForm();
              }}
              className="px-4 py-2 rounded-lg border border-slate-200 text-sm text-slate-600"
            >
              Annuler
            </button>
          </div>
        </form>
      )}

      {loading ? (
        <p className="text-sm text-slate-500">Chargement…</p>
      ) : guides.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-200 p-10 text-center text-slate-500">
          Aucun guide pour l’instant. Créez-en un pour chaque module.
        </div>
      ) : (
        <div className="space-y-3">
          {guides.map((guide) => (
            <div
              key={guide.id}
              className="bg-white rounded-xl border border-slate-200 p-4 flex flex-wrap items-start justify-between gap-3"
            >
              <div>
                <p className="text-xs uppercase tracking-wide text-purple-600 font-medium">
                  {moduleLabel(guide.module_code)}
                </p>
                <h3 className="font-semibold text-slate-800">{guide.titre}</h3>
                <p className="text-sm text-slate-500">{guide.description}</p>
                <p className="text-xs text-slate-400 mt-1">
                  {guide.youtube_url ? "YouTube" : "Sans vidéo"}
                  {(guide.documents || []).length
                    ? ` · ${guide.documents.length} document(s)`
                    : ""}
                  {guide.actif ? " · Publié" : " · Brouillon"}
                </p>
              </div>
              <div className="flex gap-2">
                {canChange && (
                  <button
                    type="button"
                    onClick={() => openEdit(guide)}
                    className="px-3 py-1.5 text-sm rounded-lg border border-slate-200 hover:bg-slate-50"
                  >
                    Modifier
                  </button>
                )}
                {canDelete && (
                  <button
                    type="button"
                    onClick={() => handleDelete(guide)}
                    className="px-3 py-1.5 text-sm rounded-lg border border-red-200 text-red-600 hover:bg-red-50"
                  >
                    Supprimer
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
