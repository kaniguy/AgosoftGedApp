"use client";

import { useEffect, useState } from "react";
import {
  getConfigurationEmail,
  updateConfigurationEmail,
} from "../../../services/configurationEmail.service";
import { hasAnyPermission, PERMISSIONS } from "../../../utils/permissions";

const emptyForm = {
  email_backend: "django.core.mail.backends.smtp.EmailBackend",
  email_host: "",
  email_port: 587,
  email_use_tls: true,
  email_use_ssl: false,
  email_host_user: "",
  email_host_password: "",
  default_from_email: "",
};

export default function ConfigurationEmailPage() {
  const canView = hasAnyPermission([
    PERMISSIONS.VIEW_CONFIGURATION_EMAIL,
    PERMISSIONS.CHANGE_CONFIGURATION_EMAIL,
  ]);
  const canChange = hasAnyPermission([PERMISSIONS.CHANGE_CONFIGURATION_EMAIL]);

  const [form, setForm] = useState(emptyForm);
  const [hasPassword, setHasPassword] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState({ type: "", text: "" });

  useEffect(() => {
    if (!canView) {
      setLoading(false);
      return;
    }
    const load = async () => {
      try {
        const data = await getConfigurationEmail();
        setForm({
          email_backend: data.email_backend || emptyForm.email_backend,
          email_host: data.email_host || "",
          email_port: data.email_port || 587,
          email_use_tls: Boolean(data.email_use_tls),
          email_use_ssl: Boolean(data.email_use_ssl),
          email_host_user: data.email_host_user || "",
          email_host_password: "",
          default_from_email: data.default_from_email || "",
        });
        setHasPassword(Boolean(data.has_password));
      } catch (err) {
        setMessage({ type: "error", text: err.message || "Chargement impossible." });
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [canView]);

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setForm((prev) => {
      const next = {
        ...prev,
        [name]: type === "checkbox" ? checked : value,
      };
      if (name === "email_use_tls" && checked) next.email_use_ssl = false;
      if (name === "email_use_ssl" && checked) next.email_use_tls = false;
      return next;
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!canChange) return;
    try {
      setSaving(true);
      setMessage({ type: "", text: "" });
      const payload = {
        email_backend: form.email_backend,
        email_host: form.email_host.trim(),
        email_port: Number(form.email_port) || 587,
        email_use_tls: Boolean(form.email_use_tls),
        email_use_ssl: Boolean(form.email_use_ssl),
        email_host_user: form.email_host_user.trim(),
        default_from_email: form.default_from_email.trim(),
      };
      if (form.email_host_password.trim()) {
        payload.email_host_password = form.email_host_password.trim();
      }
      const data = await updateConfigurationEmail(payload);
      setForm((prev) => ({ ...prev, email_host_password: "" }));
      setHasPassword(Boolean(data.has_password));
      setMessage({ type: "success", text: "Configuration SMTP-mail enregistrée." });
    } catch (err) {
      setMessage({ type: "error", text: err.message || "Enregistrement impossible." });
    } finally {
      setSaving(false);
    }
  };

  if (!canView) {
    return (
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-8 text-center text-gray-600">
        Vous n&apos;avez pas la permission de consulter la configuration SMTP-mail.
      </div>
    );
  }

  if (loading) {
    return <div className="text-center py-12 text-gray-500">Chargement...</div>;
  }

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-800">Configuration SMTP-mail</h1>
        <p className="text-sm text-gray-500 mt-1">
          Paramètres SMTP utilisés pour l&apos;envoi des e-mails (Gmail, Outlook, Yahoo, etc.).
        </p>
      </div>

      {message.text && (
        <div
          className={`mb-4 p-4 rounded-lg text-sm border ${
            message.type === "success"
              ? "bg-emerald-50 border-emerald-200 text-emerald-800"
              : "bg-red-50 border-red-200 text-red-700"
          }`}
        >
          {message.text}
        </div>
      )}

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        <form
          onSubmit={handleSubmit}
          className="xl:col-span-2 bg-white rounded-lg shadow-sm border border-gray-200 p-6 space-y-5"
        >
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Backend</label>
            <select
              name="email_backend"
              value={form.email_backend}
              onChange={handleChange}
              disabled={!canChange}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-purple-500 focus:outline-none disabled:bg-gray-50"
            >
              <option value="django.core.mail.backends.smtp.EmailBackend">
                SMTP (production)
              </option>
              <option value="django.core.mail.backends.console.EmailBackend">
                Console (développement)
              </option>
            </select>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="sm:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">Serveur SMTP</label>
              <p className="text-xs text-gray-500 mb-1.5">
                Adresse du serveur de votre fournisseur (Gmail, Outlook, Yahoo…).
              </p>
              <input
                type="text"
                name="email_host"
                value={form.email_host}
                onChange={handleChange}
                disabled={!canChange}
                placeholder="ex. smtp.gmail.com, smtp-mail.outlook.com"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-purple-500 focus:outline-none disabled:bg-gray-50"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Port</label>
              <input
                type="number"
                name="email_port"
                value={form.email_port}
                onChange={handleChange}
                disabled={!canChange}
                min={1}
                max={65535}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-purple-500 focus:outline-none disabled:bg-gray-50"
              />
            </div>
          </div>

          <div className="flex flex-wrap gap-6">
            <label className="inline-flex items-center gap-2 text-sm text-gray-700">
              <input
                type="checkbox"
                name="email_use_tls"
                checked={form.email_use_tls}
                onChange={handleChange}
                disabled={!canChange}
                className="rounded border-gray-300 text-purple-600 focus:ring-purple-500"
              />
              Activer TLS
            </label>
            <label className="inline-flex items-center gap-2 text-sm text-gray-700">
              <input
                type="checkbox"
                name="email_use_ssl"
                checked={form.email_use_ssl}
                onChange={handleChange}
                disabled={!canChange}
                className="rounded border-gray-300 text-purple-600 focus:ring-purple-500"
              />
              Activer SSL
            </label>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Identifiant SMTP (adresse e-mail)
              </label>
              <p className="text-xs text-gray-500 mb-1.5">
                Compte utilisé pour se connecter au serveur SMTP (souvent votre adresse e-mail).
              </p>
              <input
                type="email"
                name="email_host_user"
                value={form.email_host_user}
                onChange={handleChange}
                disabled={!canChange}
                placeholder="ex. contact@entreprise.com"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-purple-500 focus:outline-none disabled:bg-gray-50"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Mot de passe SMTP
              </label>
              <input
                type="password"
                name="email_host_password"
                value={form.email_host_password}
                onChange={handleChange}
                disabled={!canChange}
                placeholder={hasPassword ? "•••••••••••••••• (laisser vide pour conserver)" : ""}
                autoComplete="new-password"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-purple-500 focus:outline-none disabled:bg-gray-50"
              />
              <p className="text-xs text-gray-400 mt-1">
                {hasPassword
                  ? "Un mot de passe est déjà enregistré. Saisissez-en un nouveau uniquement pour le remplacer."
                  : "Mot de passe du compte ou mot de passe d'application si la double authentification est active (Gmail, Yahoo, Microsoft…)."}
              </p>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Adresse d&apos;expédition
            </label>
            <input
              type="text"
              name="default_from_email"
              value={form.default_from_email}
              onChange={handleChange}
              disabled={!canChange}
              placeholder='GED <contact@entreprise.com>'
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-purple-500 focus:outline-none disabled:bg-gray-50"
            />
          </div>

          {canChange ? (
            <div className="pt-2">
              <button
                type="submit"
                disabled={saving}
                className="px-5 py-2.5 bg-purple-600 text-white text-sm font-medium rounded-lg hover:bg-purple-700 transition-colors disabled:opacity-50"
              >
                {saving ? "Enregistrement…" : "Enregistrer"}
              </button>
            </div>
          ) : (
            <p className="text-sm text-gray-500">
              Consultation seule — vous n&apos;avez pas la permission de modifier ces paramètres.
            </p>
          )}
        </form>

        <aside className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 h-fit xl:sticky xl:top-24">
          <h2 className="text-sm font-semibold text-gray-800 mb-3">
            Paramètres courants par fournisseur
          </h2>
          <ul className="space-y-3 text-sm text-gray-600">
            <li className="rounded-lg border border-gray-100 bg-gray-50 p-3">
              <p className="font-medium text-gray-800">Gmail</p>
              <p className="mt-1 text-xs leading-relaxed">
                Serveur <code className="text-purple-700">smtp.gmail.com</code>, port{" "}
                <strong>587</strong>, TLS activé, SSL désactivé.
              </p>
            </li>
            <li className="rounded-lg border border-gray-100 bg-gray-50 p-3">
              <p className="font-medium text-gray-800">Outlook / Hotmail</p>
              <p className="mt-1 text-xs leading-relaxed">
                Serveur <code className="text-purple-700">smtp-mail.outlook.com</code>, port{" "}
                <strong>587</strong>, TLS activé.
              </p>
            </li>
            <li className="rounded-lg border border-gray-100 bg-gray-50 p-3">
              <p className="font-medium text-gray-800">Microsoft 365</p>
              <p className="mt-1 text-xs leading-relaxed">
                Serveur <code className="text-purple-700">smtp.office365.com</code>, port{" "}
                <strong>587</strong>, TLS activé.
              </p>
            </li>
            <li className="rounded-lg border border-gray-100 bg-gray-50 p-3">
              <p className="font-medium text-gray-800">Yahoo</p>
              <p className="mt-1 text-xs leading-relaxed">
                Serveur <code className="text-purple-700">smtp.mail.yahoo.com</code>, port{" "}
                <strong>587</strong> (TLS) ou <strong>465</strong> (SSL).
              </p>
            </li>
          </ul>
          <p className="text-xs text-gray-400 mt-4 leading-relaxed">
            Ces valeurs sont indicatives. Vérifiez la documentation de votre fournisseur si
            l&apos;envoi échoue.
          </p>
        </aside>
      </div>
    </div>
  );
}
