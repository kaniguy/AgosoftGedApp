"use client";

import { useState, useEffect, useRef } from "react";
import {
  getEntreprise,
  updateEntreprise,
  resetEntreprise,
  ENTREPRISE_LIMITS,
  DEFAULT_ENTREPRISE,
} from "../../../services/entreprise.service";
import { useCrudPermissions, MODELS } from "../../../utils/permissions";

const emptyForm = {
  libelle: "",
  slogan: "",
  description: "",
  email: "",
  telephone: "",
  logo: null,
};

function CharCounter({ value, max }) {
  return (
    <span className="text-xs text-gray-400">
      {(value || "").length}/{max}
    </span>
  );
}

export default function EntreprisePage() {
  const { canChange } = useCrudPermissions(MODELS.ENTREPRISE);
  const [form, setForm] = useState(emptyForm);
  const [logoPreview, setLogoPreview] = useState(null);
  const [removeLogo, setRemoveLogo] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [message, setMessage] = useState({ type: "", text: "" });
  const fileInputRef = useRef(null);

  useEffect(() => {
    const load = async () => {
      try {
        const data = await getEntreprise();
        setForm({
          libelle: data.libelle || "",
          slogan: data.slogan || "",
          description: data.description || "",
          email: data.email || "",
          telephone: data.telephone || "",
          logo: null,
        });
        setLogoPreview(data.logo || null);
      } catch (err) {
        setMessage({ type: "error", text: err.message || "Chargement impossible." });
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  const handleChange = (e) => {
    const { name, value } = e.target;
    const limits = {
      libelle: ENTREPRISE_LIMITS.libelle,
      description: ENTREPRISE_LIMITS.description,
      telephone: ENTREPRISE_LIMITS.telephone,
    };
    if (limits[name] && value.length > limits[name]) return;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleFileChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) {
      setMessage({ type: "error", text: "Le logo ne doit pas dépasser 2 Mo." });
      return;
    }
    if (!file.type.startsWith("image/")) {
      setMessage({ type: "error", text: "Veuillez sélectionner une image (PNG, JPG, SVG…)." });
      return;
    }
    setForm((prev) => ({ ...prev, logo: file }));
    setRemoveLogo(false);
    const reader = new FileReader();
    reader.onloadend = () => setLogoPreview(reader.result);
    reader.readAsDataURL(file);
  };

  const handleRemoveLogo = () => {
    setForm((prev) => ({ ...prev, logo: null }));
    setLogoPreview(null);
    setRemoveLogo(true);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!canChange) {
      setMessage({ type: "error", text: "Vous n'avez pas la permission de modifier l'entreprise." });
      return;
    }
    if (!form.libelle.trim()) {
      setMessage({ type: "error", text: "Le libellé est obligatoire." });
      return;
    }

    setSaving(true);
    setMessage({ type: "", text: "" });

    try {
      const fd = new FormData();
      fd.append("libelle", form.libelle.trim());
      fd.append("slogan", form.slogan.trim());
      fd.append("description", form.description.trim());
      fd.append("email", form.email.trim());
      fd.append("telephone", form.telephone.trim());
      if (form.logo) fd.append("logo", form.logo);
      if (removeLogo) fd.append("remove_logo", "true");

      const data = await updateEntreprise(fd);
      setForm((prev) => ({ ...prev, logo: null }));
      setLogoPreview(data.logo || null);
      setRemoveLogo(false);
      setMessage({ type: "success", text: "Informations de l'entreprise enregistrées." });
    } catch (err) {
      setMessage({ type: "error", text: err.message });
    } finally {
      setSaving(false);
    }
  };

  const handleReset = async () => {
    if (!canChange) return;

    const confirmed = window.confirm(
      "Réinitialiser l'identité visuelle aux valeurs par défaut ?\n\n" +
        `• Libellé : ${DEFAULT_ENTREPRISE.libelle}\n` +
        `• Slogan : ${DEFAULT_ENTREPRISE.slogan}\n` +
        "• Description, email et téléphone seront vidés\n" +
        "• Le logo personnalisé sera supprimé"
    );
    if (!confirmed) return;

    setResetting(true);
    setMessage({ type: "", text: "" });

    try {
      const data = await resetEntreprise();
      setForm({
        libelle: data.libelle || DEFAULT_ENTREPRISE.libelle,
        slogan: data.slogan ?? DEFAULT_ENTREPRISE.slogan,
        description: data.description || "",
        email: data.email || "",
        telephone: data.telephone || "",
        logo: null,
      });
      setLogoPreview(data.logo || null);
      setRemoveLogo(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
      setMessage({ type: "success", text: "Identité visuelle réinitialisée aux valeurs par défaut." });
    } catch (err) {
      setMessage({ type: "error", text: err.message });
    } finally {
      setResetting(false);
    }
  };

  if (loading) {
    return (
      <div className="text-center py-16 text-gray-500">
        <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600 mb-4" />
        <p>Chargement…</p>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-800">Entreprise</h1>
        <p className="text-sm text-gray-500 mt-1">
          Identité et coordonnées du projet affichées dans l&apos;application.
        </p>
      </div>

      {message.text && (
        <div
          className={`mb-6 px-4 py-3 rounded-lg text-sm ${
            message.type === "error"
              ? "bg-red-50 border border-red-200 text-red-700"
              : "bg-green-50 border border-green-200 text-green-700"
          }`}
        >
          {message.text}
        </div>
      )}

      <form onSubmit={handleSubmit} className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="px-6 py-5 border-b border-gray-100 bg-gradient-to-r from-purple-50 to-white">
          <h2 className="font-semibold text-gray-800">Identité visuelle</h2>
        </div>

        <div className="p-6 space-y-6">
          <div className="flex flex-col sm:flex-row gap-6 items-start">
            <div className="shrink-0">
              <p className="text-sm font-medium text-gray-700 mb-2">Logo</p>
              <div className="w-28 h-28 rounded-xl border-2 border-dashed border-purple-200 bg-purple-50/50 flex items-center justify-center overflow-hidden">
                {logoPreview ? (
                  <img src={logoPreview} alt="Logo" className="w-full h-full object-contain p-2" />
                ) : (
                  <svg className="w-10 h-10 text-purple-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                  </svg>
                )}
              </div>
              {canChange && (
                <div className="mt-3 flex flex-col gap-2">
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="text-xs px-3 py-1.5 bg-purple-600 text-white rounded-lg hover:bg-purple-700"
                  >
                    Choisir un logo
                  </button>
                  {logoPreview && (
                    <button
                      type="button"
                      onClick={handleRemoveLogo}
                      className="text-xs px-3 py-1.5 border border-gray-300 rounded-lg hover:bg-gray-50 text-gray-600"
                    >
                      Supprimer le logo
                    </button>
                  )}
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={handleFileChange}
                  />
                </div>
              )}
            </div>

            <div className="flex-1 space-y-4 w-full">
              <div>
                <div className="flex justify-between items-center mb-1">
                  <label htmlFor="libelle" className="text-sm font-medium text-gray-700">
                    Libellé du projet *
                  </label>
                  <CharCounter value={form.libelle} max={ENTREPRISE_LIMITS.libelle} />
                </div>
                <input
                  id="libelle"
                  name="libelle"
                  value={form.libelle}
                  onChange={handleChange}
                  disabled={!canChange}
                  required
                  maxLength={ENTREPRISE_LIMITS.libelle}
                  placeholder="Ex. AGOSOFT-GED"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-purple-500 focus:outline-none disabled:bg-gray-100"
                />
              </div>

              <div>
                <label htmlFor="slogan" className="block text-sm font-medium text-gray-700 mb-1">
                  Slogan / sous-titre
                </label>
                <input
                  id="slogan"
                  name="slogan"
                  value={form.slogan}
                  onChange={handleChange}
                  disabled={!canChange}
                  maxLength={255}
                  placeholder="Ex. Gestion Électronique de Documents"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-purple-500 focus:outline-none disabled:bg-gray-100"
                />
              </div>
            </div>
          </div>

          <div className="border-t border-gray-100 pt-6">
            <h3 className="text-sm font-semibold text-gray-800 mb-4">Coordonnées</h3>
            <div className="space-y-4">
              <div>
                <div className="flex justify-between items-center mb-1">
                  <label htmlFor="description" className="text-sm font-medium text-gray-700">
                    Description
                  </label>
                  <CharCounter value={form.description} max={ENTREPRISE_LIMITS.description} />
                </div>
                <textarea
                  id="description"
                  name="description"
                  value={form.description}
                  onChange={handleChange}
                  disabled={!canChange}
                  maxLength={ENTREPRISE_LIMITS.description}
                  rows={3}
                  placeholder="Présentation courte de l'organisation ou du projet"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-purple-500 focus:outline-none disabled:bg-gray-100 resize-none"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">
                    Email
                  </label>
                  <input
                    id="email"
                    name="email"
                    type="email"
                    value={form.email}
                    onChange={handleChange}
                    disabled={!canChange}
                    placeholder="contact@exemple.com"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-purple-500 focus:outline-none disabled:bg-gray-100"
                  />
                </div>
                <div>
                  <div className="flex justify-between items-center mb-1">
                    <label htmlFor="telephone" className="text-sm font-medium text-gray-700">
                      Téléphone
                    </label>
                    <CharCounter value={form.telephone} max={ENTREPRISE_LIMITS.telephone} />
                  </div>
                  <input
                    id="telephone"
                    name="telephone"
                    type="tel"
                    value={form.telephone}
                    onChange={handleChange}
                    disabled={!canChange}
                    maxLength={ENTREPRISE_LIMITS.telephone}
                    placeholder="+225 00 00 00 00 00"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-purple-500 focus:outline-none disabled:bg-gray-100"
                  />
                </div>
              </div>
            </div>
          </div>

          <div className="rounded-lg bg-slate-50 border border-slate-200 p-4">
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">Aperçu en-tête</p>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-blue-600 to-blue-800 flex items-center justify-center overflow-hidden shrink-0">
                {logoPreview ? (
                  <img src={logoPreview} alt="" className="w-full h-full object-contain p-1" />
                ) : (
                  <span className="text-white font-bold text-lg">
                    {(form.libelle || "A").charAt(0).toUpperCase()}
                  </span>
                )}
              </div>
              <div>
                <p className="font-bold text-slate-800">{form.libelle || "Libellé du projet"}</p>
                <p className="text-xs text-gray-500">{form.slogan || "Slogan"}</p>
              </div>
            </div>
          </div>
        </div>

        {canChange && (
          <div className="px-6 py-4 bg-gray-50 border-t border-gray-100 flex justify-end gap-3">
            <button
              type="button"
              onClick={handleReset}
              disabled={saving || resetting}
              className="px-5 py-2 border border-gray-300 bg-white hover:bg-gray-50 disabled:opacity-50 text-gray-700 rounded-lg text-sm font-medium"
            >
              {resetting ? "Réinitialisation…" : "Réinitialiser"}
            </button>
            <button
              type="submit"
              disabled={saving || resetting}
              className="px-5 py-2 bg-purple-600 hover:bg-purple-700 disabled:bg-purple-400 text-white rounded-lg text-sm font-medium"
            >
              {saving ? "Enregistrement…" : "Enregistrer"}
            </button>
          </div>
        )}

        {!canChange && (
          <div className="px-6 py-4 bg-amber-50 border-t border-amber-100 text-sm text-amber-800">
            Consultation seule — vous n&apos;avez pas la permission de modifier l&apos;entreprise.
          </div>
        )}
      </form>
    </div>
  );
}
