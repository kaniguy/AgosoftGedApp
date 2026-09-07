"use client";

import { useEffect, useState } from "react";
import {
  getPreferencesNotification,
  updatePreferencesNotification,
} from "../../../services/notifications.service";

const PREFERENCES = [
  {
    key: "notif_soumission",
    label: "Document soumis au contrôle qualité",
    description: "Recevoir un e-mail quand un document de mon périmètre est soumis.",
  },
  {
    key: "notif_validation",
    label: "Mon document est validé",
    description: "Recevoir un e-mail quand un de mes documents est validé.",
  },
  {
    key: "notif_rejet",
    label: "Mon document est rejeté",
    description: "Recevoir un e-mail avec le motif quand un de mes documents est rejeté.",
  },
  {
    key: "notif_resoumission",
    label: "Document corrigé et resoumis",
    description: "Recevoir un e-mail quand un document rejeté est corrigé puis resoumis.",
  },
  {
    key: "notif_identifiants",
    label: "Identifiants de connexion",
    description:
      "Recevoir un e-mail lorsqu'un mot de passe est généré pour votre compte. Sans effet si l'administrateur a déjà saisi un mot de passe à la création.",
  },
  {
    key: "resume_periodique",
    label: "Résumé périodique",
    description: "Recevoir le récapitulatif des documents en attente de contrôle.",
  },
];

export default function MesNotificationsPage() {
  const [prefs, setPrefs] = useState(null);
  const [loading, setLoading] = useState(true);
  const [savingKey, setSavingKey] = useState(null);
  const [message, setMessage] = useState({ type: "", text: "" });

  useEffect(() => {
    getPreferencesNotification()
      .then(setPrefs)
      .catch((err) =>
        setMessage({ type: "error", text: err.message || "Chargement impossible." })
      )
      .finally(() => setLoading(false));
  }, []);

  const toggle = async (key, value) => {
    try {
      setSavingKey(key);
      const data = await updatePreferencesNotification({ [key]: value });
      setPrefs(data);
      setMessage({ type: "success", text: "Préférence enregistrée." });
      setTimeout(() => setMessage({ type: "", text: "" }), 3000);
    } catch (err) {
      setMessage({ type: "error", text: err.message || "Enregistrement impossible." });
    } finally {
      setSavingKey(null);
    }
  };

  if (loading) {
    return <div className="text-center py-12 text-gray-500">Chargement...</div>;
  }

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-800">Mes notifications</h1>
        <p className="text-sm text-gray-500 mt-1">
          Choisissez les e-mails que vous souhaitez recevoir sur votre adresse personnelle.
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

      {prefs && (
        <>
          <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4">
            {PREFERENCES.map((item) => (
              <div
                key={item.key}
                className="bg-white rounded-lg shadow-sm border border-gray-200 p-5 flex items-start justify-between gap-4"
              >
                <div className="min-w-0">
                  <p className="text-sm font-medium text-gray-800">{item.label}</p>
                  <p className="text-xs text-gray-500 mt-1 leading-relaxed">{item.description}</p>
                </div>
                <button
                  onClick={() => toggle(item.key, !prefs[item.key])}
                  disabled={savingKey === item.key}
                  className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-offset-1 ${
                    prefs[item.key] ? "bg-purple-600" : "bg-gray-300"
                  } ${savingKey === item.key ? "opacity-60" : ""}`}
                  role="switch"
                  aria-checked={prefs[item.key]}
                  aria-label={item.label}
                >
                  <span
                    className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${
                      prefs[item.key] ? "translate-x-6" : "translate-x-1"
                    }`}
                  />
                </button>
              </div>
            ))}
          </div>

          <footer className="mt-8 pt-6 border-t border-gray-200 grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <h2 className="text-sm font-semibold text-gray-800 mb-2">À propos</h2>
              <p className="text-xs text-gray-500 leading-relaxed">
                Ces préférences s&apos;appliquent uniquement à votre compte. Elles filtrent
                les e-mails que vous recevez, sans modifier le comportement global du système.
              </p>
            </div>
            <div>
              <h2 className="text-sm font-semibold text-gray-800 mb-2">Adresse e-mail</h2>
              <p className="text-xs text-gray-500 leading-relaxed">
                Les e-mails sont envoyés à l&apos;adresse renseignée dans votre profil. Pensez
                à la vérifier dans « Mon profil » si vous ne recevez rien.
              </p>
            </div>
          </footer>
        </>
      )}
    </div>
  );
}
