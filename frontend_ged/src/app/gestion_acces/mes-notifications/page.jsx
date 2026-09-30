"use client";

import { useEffect, useState } from "react";
import {
  getNotificationsGenerales,
  updateNotificationsGenerales,
} from "../../../services/notifications.service";
import { isSuperuserFromStorage } from "../../../constants/modules";

const NOTIFICATIONS = [
  {
    key: "soumission",
    label: "Document soumis au contrôle qualité",
    description: "Envoyer un e-mail quand un document est soumis au contrôle qualité.",
  },
  {
    key: "validation",
    label: "Document validé",
    description: "Envoyer un e-mail quand un document est validé.",
  },
  {
    key: "rejet",
    label: "Document rejeté",
    description: "Envoyer un e-mail, avec le motif, quand un document est rejeté.",
  },
  {
    key: "resoumission",
    label: "Document corrigé et resoumis",
    description: "Envoyer un e-mail quand un document rejeté est corrigé puis resoumis.",
  },
  {
    key: "identifiants",
    label: "Identifiants de connexion",
    description:
      "Envoyer un e-mail lorsqu'un mot de passe est généré pour un nouveau compte. Sans effet si l'administrateur a saisi un mot de passe à la création.",
  },
  {
    key: "resume_periodique",
    label: "Résumé périodique",
    description: "Envoyer aux contrôleurs le récapitulatif des documents en attente de contrôle.",
  },
];

export default function NotificationsGeneralesPage() {
  const [isSuperuser] = useState(() => isSuperuserFromStorage());
  const [etats, setEtats] = useState(null);
  const [loading, setLoading] = useState(isSuperuser);
  const [savingKey, setSavingKey] = useState(null);
  const [message, setMessage] = useState({ type: "", text: "" });

  useEffect(() => {
    if (!isSuperuser) return;
    getNotificationsGenerales()
      .then(setEtats)
      .catch((err) =>
        setMessage({ type: "error", text: err.message || "Chargement impossible." })
      )
      .finally(() => setLoading(false));
  }, [isSuperuser]);

  const toggle = async (key, value) => {
    try {
      setSavingKey(key);
      const data = await updateNotificationsGenerales({ [key]: value });
      setEtats(data);
      setMessage({ type: "success", text: "Configuration enregistrée pour tous les utilisateurs." });
      setTimeout(() => setMessage({ type: "", text: "" }), 3000);
    } catch (err) {
      setMessage({ type: "error", text: err.message || "Enregistrement impossible." });
    } finally {
      setSavingKey(null);
    }
  };

  if (!isSuperuser) {
    return (
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-8 text-center text-gray-600">
        Seul un superutilisateur peut gérer les notifications générales.
      </div>
    );
  }

  if (loading) {
    return <div className="text-center py-12 text-gray-500">Chargement...</div>;
  }

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-800">Notifications générales</h1>
        <p className="text-sm text-gray-500 mt-1">
          Activez ou désactivez chaque e-mail pour l&apos;ensemble des utilisateurs de l&apos;application.
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

      {etats && (
        <>
          <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4">
            {NOTIFICATIONS.map((item) => (
              <div
                key={item.key}
                className="bg-white rounded-lg shadow-sm border border-gray-200 p-5 flex items-start justify-between gap-4"
              >
                <div className="min-w-0">
                  <p className="text-sm font-medium text-gray-800">{item.label}</p>
                  <p className="text-xs text-gray-500 mt-1 leading-relaxed">{item.description}</p>
                </div>
                <button
                  onClick={() => toggle(item.key, !etats[item.key])}
                  disabled={savingKey === item.key}
                  className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-offset-1 ${
                    etats[item.key] ? "bg-purple-600" : "bg-gray-300"
                  } ${savingKey === item.key ? "opacity-60" : ""}`}
                  role="switch"
                  aria-checked={Boolean(etats[item.key])}
                  aria-label={item.label}
                >
                  <span
                    className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${
                      etats[item.key] ? "translate-x-6" : "translate-x-1"
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
                Cette configuration s&apos;applique à tous les utilisateurs : un e-mail désactivé
                ici n&apos;est plus envoyé à personne. Elle est synchronisée avec les règles
                d&apos;envoi de « Paramétrage → Notifications », où se règlent aussi les
                destinataires, les modèles d&apos;e-mail et l&apos;horaire du résumé périodique.
              </p>
            </div>
            <div>
              <h2 className="text-sm font-semibold text-gray-800 mb-2">Adresse e-mail</h2>
              <p className="text-xs text-gray-500 leading-relaxed">
                Les e-mails sont envoyés à l&apos;adresse renseignée dans le profil de chaque
                utilisateur. Les comptes sans adresse sont ignorés et tracés dans le journal.
              </p>
            </div>
          </footer>
        </>
      )}
    </div>
  );
}
