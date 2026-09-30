"use client";

import { useEffect, useMemo, useState } from "react";
import {
  getNotificationsConfig,
  updateRegleNotification,
  updateModeleEmail,
  previewModeleEmail,
  resetModeleEmail,
  updateConfigurationResume,
  envoyerResumeMaintenant,
  getJournalNotifications,
} from "../../../services/notifications.service";
import { hasAnyPermission, hasPermission, PERMISSIONS } from "../../../utils/permissions";

const TABS = [
  { id: "regles", label: "Règles d'envoi" },
  { id: "modeles", label: "Modèles d'e-mail" },
  { id: "resume", label: "Résumé périodique" },
  { id: "journal", label: "Journal" },
];

const EVENT_ORDER = [
  "soumission",
  "validation",
  "rejet",
  "resoumission",
  "identifiants",
  "resume_periodique",
];

function sortByEventOrder(items, key = "event_type") {
  const order = Object.fromEntries(EVENT_ORDER.map((code, index) => [code, index]));
  return [...items].sort(
    (a, b) => (order[a[key]] ?? 99) - (order[b[key]] ?? 99)
  );
}

const CIBLES = [
  {
    value: "createur",
    label: "Créateur du document",
    description:
      "Envoie l'e-mail à l'utilisateur qui a soumis sur le document. " +
      "Utilisez cette option pour informer l'auteur d'une validation ou d'un rejet.",
  },
  {
    value: "controleurs",
    label: "Contrôleurs éligibles (permissions + périmètre)",
    description:
      "Envoie l'e-mail à tous les utilisateurs actifs pouvant contrôler ce document : " +
      "permission « valider » ou « rejeter » (QC), accès à la localité du document " +
      "et au type documentaire. Utilisez cette option pour alerter les contrôleurs " +
      "lors d'une soumission ou d'une resoumission.",
  },
];

const STATUT_BADGES = {
  sent: "bg-emerald-100 text-emerald-800",
  failed: "bg-red-100 text-red-700",
  skipped: "bg-gray-100 text-gray-600",
  queued: "bg-yellow-100 text-yellow-800",
};

const inputClass =
  "w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-purple-500 focus:outline-none disabled:bg-gray-50";

function ToggleSwitch({ checked, disabled, onChange, label, labelPosition = "before" }) {
  const switchButton = (
    <button
      type="button"
      onClick={() => !disabled && onChange(!checked)}
      disabled={disabled}
      className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-offset-1 ${
        checked ? "bg-purple-600" : "bg-gray-300"
      } ${disabled ? "opacity-60 cursor-not-allowed" : ""}`}
      role="switch"
      aria-checked={checked}
      aria-label={typeof label === "string" ? label : undefined}
    >
      <span
        className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${
          checked ? "translate-x-6" : "translate-x-1"
        }`}
      />
    </button>
  );

  if (!label) return switchButton;

  return (
    <div className="flex items-center justify-between gap-4">
      {labelPosition === "before" && (
        <span className="text-sm text-gray-700 leading-snug">{label}</span>
      )}
      {switchButton}
      {labelPosition === "after" && (
        <span className="text-sm text-gray-700 leading-snug">{label}</span>
      )}
    </div>
  );
}

function getNextScheduledDate(resume) {
  if (!resume?.is_enabled) return null;

  const now = new Date();
  const [hours, minutes] = String(resume.heure_envoi || "08:00")
    .split(":")
    .map(Number);
  const candidate = new Date(now);
  candidate.setHours(hours || 0, minutes || 0, 0, 0);

  const lastSent = resume.dernier_envoi
    ? new Date(resume.dernier_envoi)
    : null;
  // Le créneau est « servi » seulement si un envoi a eu lieu à ou après
  // l'heure programmée ce jour-là : reprogrammer plus tard dans la journée
  // relance donc un envoi le jour même.
  const slotServed = (date) => lastSent && lastSent >= date;

  if (resume.frequence === "weekly") {
    const targetDay = Number(resume.jour_semaine || 0);
    const jsTargetDay = (targetDay + 1) % 7;
    const daysUntilTarget = (jsTargetDay - candidate.getDay() + 7) % 7;
    candidate.setDate(candidate.getDate() + daysUntilTarget);
    if (slotServed(candidate)) {
      candidate.setDate(candidate.getDate() + 7);
    }
    return candidate;
  }

  if (slotServed(candidate)) {
    candidate.setDate(candidate.getDate() + 1);
  }
  return candidate;
}

export default function NotificationsPage() {
  const canView = hasAnyPermission([
    PERMISSIONS.VIEW_REGLE_NOTIFICATION,
    PERMISSIONS.CHANGE_REGLE_NOTIFICATION,
  ]);
  const canChange = hasPermission(PERMISSIONS.CHANGE_REGLE_NOTIFICATION);

  const [tab, setTab] = useState("regles");
  const [config, setConfig] = useState(null);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState({ type: "", text: "" });

  useEffect(() => {
    if (!canView) {
      return;
    }
    getNotificationsConfig()
      .then(setConfig)
      .catch((err) =>
        setMessage({ type: "error", text: err.message || "Chargement impossible." })
      )
      .finally(() => setLoading(false));
  }, [canView]);

  const notify = (type, text) => {
    setMessage({ type, text });
    if (type === "success") {
      setTimeout(() => setMessage({ type: "", text: "" }), 4000);
    }
  };

  if (!canView) {
    return (
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-8 text-center text-gray-600">
        Vous n&apos;avez pas la permission de consulter le paramétrage des notifications.
      </div>
    );
  }

  if (loading) {
    return <div className="text-center py-12 text-gray-500">Chargement...</div>;
  }

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-800">Notifications du workflow</h1>
        <p className="text-sm text-gray-500 mt-1">
          E-mails automatiques (workflow qualité, identifiants de connexion, résumé périodique)
          — règles et contenus entièrement paramétrables.
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

      <div className="flex gap-2 mb-6 flex-wrap">
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              tab === t.id
                ? "bg-purple-600 text-white shadow"
                : "bg-white border border-gray-200 text-gray-600 hover:bg-purple-50"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {config && tab === "regles" && (
        <ReglesTab config={config} setConfig={setConfig} canChange={canChange} notify={notify} />
      )}
      {config && tab === "modeles" && (
        <ModelesTab config={config} setConfig={setConfig} canChange={canChange} notify={notify} />
      )}
      {config && tab === "resume" && (
        <ResumeTab config={config} setConfig={setConfig} canChange={canChange} notify={notify} />
      )}
      {tab === "journal" && <JournalTab />}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Onglet 1 : Règles d'envoi                                           */
/* ------------------------------------------------------------------ */

function ReglesTab({ config, setConfig, canChange, notify }) {
  const [savingId, setSavingId] = useState(null);
  const reglesImmediates = sortByEventOrder(
    config.regles.filter((r) => r.event_type !== "resume_periodique")
  );

  const saveRegle = async (regle, payload) => {
    try {
      setSavingId(regle.event_type);
      const data = await updateRegleNotification(regle.event_type, payload);
      setConfig((prev) => ({
        ...prev,
        regles: prev.regles.map((r) => (r.event_type === regle.event_type ? data : r)),
      }));
      notify("success", `Règle « ${data.event_type_label} » enregistrée.`);
    } catch (err) {
      notify("error", err.message || "Enregistrement impossible.");
    } finally {
      setSavingId(null);
    }
  };

  return (
    <div className="space-y-4">
      {reglesImmediates.map((regle) => (
        <div
          key={regle.event_type}
          className="bg-white rounded-lg shadow-sm border border-gray-200 p-5"
        >
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div>
              <h3 className="font-semibold text-gray-800">{regle.event_type_label}</h3>
              <p className="text-xs text-gray-500 mt-0.5">
                Modèle d&apos;e-mail : <code>{regle.modele_code || regle.event_type}</code>
              </p>
            </div>
            <ToggleSwitch
              checked={regle.is_enabled}
              disabled={!canChange || savingId === regle.event_type}
              onChange={(value) => saveRegle(regle, { is_enabled: value })}
              label={regle.is_enabled ? "Activée" : "Désactivée"}
              labelPosition="after"
            />
          </div>

          <div className="mt-4 space-y-4">
            {regle.event_type === "identifiants" ? (
              <p className="text-xs text-gray-500 leading-relaxed rounded-lg border border-gray-100 bg-gray-50 px-4 py-3">
                Destinataire : le compte créé (son adresse e-mail). Cet e-mail n&apos;est
                envoyé que si aucun mot de passe n&apos;a été saisi à la création, que le
                SMTP est configuré et que cette règle est activée.
              </p>
            ) : (
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">
                Destinataires
              </label>
              <select
                value={regle.recipient_target}
                disabled={!canChange}
                onChange={(e) => saveRegle(regle, { recipient_target: e.target.value })}
                className={inputClass}
              >
                {CIBLES.map((c) => (
                  <option key={c.value} value={c.value}>
                    {c.label}
                  </option>
                ))}
              </select>
              <p className="mt-1.5 text-xs text-gray-500 leading-relaxed">
                {CIBLES.find((c) => c.value === regle.recipient_target)?.description}
              </p>
            </div>
            )}

            {regle.event_type !== "identifiants" && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="rounded-lg border border-gray-100 bg-gray-50 px-4 py-3">
                  <ToggleSwitch
                    checked={regle.exclude_actor}
                    disabled={!canChange || savingId === regle.event_type}
                    onChange={(value) => saveRegle(regle, { exclude_actor: value })}
                    label="Ne pas notifier l'auteur de l'action"
                  />
                </div>
              </div>
            )}
          </div>

        </div>
      ))}

      <div className="bg-purple-50 border border-purple-200 rounded-lg p-4 text-xs text-purple-900 space-y-1.5">
        <p><strong>Aide sur les champs</strong></p>
        <p>
          <strong>Activée / Désactivée :</strong> coupe l&apos;envoi pour tout le monde.
          Si une règle est désactivée ici, aucun utilisateur ne recevra l&apos;e-mail.
          Ce réglage est le même que celui de « Gestion des accès → Notifications
          générales ».
        </p>
        <p>
          <strong>Destinataires — Créateur du document :</strong> l&apos;utilisateur
          qui a importé le document reçoit l&apos;e-mail (cas typique : validation ou
          rejet).
        </p>
        <p>
          <strong>Destinataires — Contrôleurs éligibles :</strong> tous les
          utilisateurs actifs disposant des permissions QC (valider ou rejeter), avec
          accès à la localité et au type documentaire concernés (cas typique :
          soumission ou resoumission).
        </p>
        <p>
          <strong>Ne pas notifier l&apos;auteur :</strong> retire des destinataires
          l&apos;utilisateur qui vient de soumettre, valider ou rejeter.
        </p>
        <p>
          <strong>Modèle d&apos;e-mail :</strong> contenu modifiable (sujet et corps)
          utilisé pour composer le message. Les variables{" "}
          <code>{"{{...}}"}</code> sont remplacées automatiquement (voir onglet
          Modèles d&apos;e-mail).
        </p>
        <p>
          <strong>Envoi du mot de passe :</strong> uniquement à la création d&apos;un
          compte <em>sans</em> mot de passe saisi. Si l&apos;administrateur renseigne
          un mot de passe, aucun e-mail n&apos;est envoyé, même si le SMTP et cette
          règle sont actifs.
        </p>
        <p>Les utilisateurs sans adresse e-mail sont ignorés et tracés dans le journal.</p>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Onglet 2 : Modèles d'e-mail                                         */
/* ------------------------------------------------------------------ */

function ModelesTab({ config, setConfig, canChange, notify }) {
  const orderedModeles = useMemo(
    () => sortByEventOrder(config.modeles, "code"),
    [config.modeles]
  );
  const [selectedCode, setSelectedCode] = useState(orderedModeles[0]?.code || "");
  const modele = useMemo(
    () => orderedModeles.find((m) => m.code === selectedCode) || null,
    [orderedModeles, selectedCode]
  );
  const [form, setForm] = useState(() => {
    const initial = orderedModeles[0];
    return initial
      ? {
          sujet: initial.sujet,
          corps_texte: initial.corps_texte,
          corps_html: initial.corps_html,
          is_active: initial.is_active,
        }
      : null;
  });
  const [saving, setSaving] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [preview, setPreview] = useState(null);
  const [previewMode, setPreviewMode] = useState(null);

  if (!modele || !form) return null;

  const save = async () => {
    try {
      setSaving(true);
      const data = await updateModeleEmail(modele.code, form);
      setConfig((prev) => ({
        ...prev,
        modeles: prev.modeles.map((m) => (m.code === modele.code ? data : m)),
      }));
      notify("success", `Modèle « ${data.nom} » enregistré.`);
    } catch (err) {
      notify("error", err.message || "Enregistrement impossible.");
    } finally {
      setSaving(false);
    }
  };

  const fetchPreview = async (mode) => {
    try {
      const data = await previewModeleEmail({
        sujet: form.sujet,
        corps_texte: form.corps_texte,
        corps_html: form.corps_html,
      });
      setPreview(data);
      setPreviewMode(mode);
    } catch (err) {
      notify("error", err.message || "Prévisualisation impossible.");
    }
  };

  const doPreviewText = () => fetchPreview("text");

  const doPreviewHtml = () => {
    if (!form.corps_html.trim()) {
      notify("error", "Le corps HTML est vide : rien à prévisualiser.");
      return;
    }
    fetchPreview("html");
  };

  const resetModele = async () => {
    if (
      !window.confirm(
        "Réinitialiser ce modèle aux valeurs par défaut ?\n\n" +
          "Le sujet et les corps texte/HTML seront restaurés. Cette action est immédiate."
      )
    ) {
      return;
    }
    try {
      setResetting(true);
      const data = await resetModeleEmail(modele.code);
      setForm({
        sujet: data.sujet,
        corps_texte: data.corps_texte,
        corps_html: data.corps_html,
        is_active: data.is_active,
      });
      setConfig((prev) => ({
        ...prev,
        modeles: prev.modeles.map((m) => (m.code === modele.code ? data : m)),
      }));
      setPreview(null);
      setPreviewMode(null);
      notify("success", `Modèle « ${data.nom} » réinitialisé.`);
    } catch (err) {
      notify("error", err.message || "Réinitialisation impossible.");
    } finally {
      setResetting(false);
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      <div className="space-y-2">
        {orderedModeles.map((m) => (
          <button
            key={m.code}
            onClick={() => {
              setSelectedCode(m.code);
              setForm({
                sujet: m.sujet,
                corps_texte: m.corps_texte,
                corps_html: m.corps_html,
                is_active: m.is_active,
              });
              setPreview(null);
              setPreviewMode(null);
            }}
            className={`w-full text-left px-4 py-3 rounded-lg border text-sm transition-colors ${
              m.code === selectedCode
                ? "border-purple-500 bg-purple-50 text-purple-800 font-medium"
                : "border-gray-200 bg-white text-gray-700 hover:bg-gray-50"
            }`}
          >
            {m.nom}
            {!m.is_active && (
              <span className="ml-2 text-xs text-red-500">(désactivé)</span>
            )}
          </button>
        ))}

        <div className="bg-white border border-gray-200 rounded-lg p-4 mt-4">
          <h4 className="text-xs font-semibold text-gray-600 uppercase mb-2">
            Variables disponibles
          </h4>
          <p className="text-xs text-gray-500 mb-3 leading-relaxed">
            Insérez ces balises dans le sujet ou le corps du message. Elles seront
            remplacées par la valeur réelle au moment de l&apos;envoi.
          </p>
          <ul className="space-y-2">
            {(config.variables || [])
              .filter((v) => !v.events?.length || v.events.includes(selectedCode))
              .map((v) => (
              <li key={v.nom} className="text-xs text-gray-600">
                <code className="bg-gray-100 px-1 py-0.5 rounded text-purple-700 font-medium">
                  {v.nom}
                </code>
                <p className="mt-0.5 text-gray-500 leading-relaxed">{v.description}</p>
              </li>
            ))}
          </ul>
        </div>
      </div>

      <div className="lg:col-span-2 bg-white rounded-lg shadow-sm border border-gray-200 p-6 space-y-4">
        <div className="flex items-center justify-between gap-4">
          <h3 className="font-semibold text-gray-800">{modele.nom}</h3>
          <ToggleSwitch
            checked={form.is_active}
            disabled={!canChange}
            onChange={(value) => setForm((f) => ({ ...f, is_active: value }))}
            label="Modèle actif"
            labelPosition="after"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Sujet</label>
          <p className="text-xs text-gray-500 mb-1.5">
            Ligne affichée dans la boîte de réception. Vous pouvez y utiliser les
            variables <code className="text-purple-700">{"{{document_label}}"}</code>,{" "}
            <code className="text-purple-700">{"{{document_type}}"}</code>, etc.
          </p>
          <input
            type="text"
            value={form.sujet}
            disabled={!canChange}
            onChange={(e) => setForm((f) => ({ ...f, sujet: e.target.value }))}
            className={inputClass}
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Corps (texte brut)
          </label>
          <p className="text-xs text-gray-500 mb-1.5">
            Version texte du message, lue par les clients sans HTML. Indispensable :
            c&apos;est la base utilisée si le corps HTML est vide.
          </p>
          <textarea
            rows={8}
            value={form.corps_texte}
            disabled={!canChange}
            onChange={(e) => setForm((f) => ({ ...f, corps_texte: e.target.value }))}
            className={`${inputClass} font-mono text-xs`}
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Corps HTML (optionnel — laisser vide pour n&apos;envoyer que le texte)
          </label>
          <p className="text-xs text-gray-500 mb-1.5">
            Version enrichie avec mise en forme (liens, couleurs). Si renseigné, les
            clients compatibles afficheront ce HTML ; sinon seul le texte brut sera
            envoyé.
          </p>
          <textarea
            rows={8}
            value={form.corps_html}
            disabled={!canChange}
            onChange={(e) => setForm((f) => ({ ...f, corps_html: e.target.value }))}
            className={`${inputClass} font-mono text-xs`}
          />
        </div>

        <div className="flex gap-3 flex-wrap">
          {canChange && (
            <button
              onClick={save}
              disabled={saving}
              className="px-5 py-2.5 bg-purple-600 text-white text-sm font-medium rounded-lg hover:bg-purple-700 transition-colors disabled:opacity-50"
            >
              {saving ? "Enregistrement…" : "Enregistrer le modèle"}
            </button>
          )}
          <button
            onClick={doPreviewText}
            className="px-5 py-2.5 bg-white border border-purple-300 text-purple-700 text-sm font-medium rounded-lg hover:bg-purple-50 transition-colors"
          >
            Prévisualiser le texte
          </button>
          <button
            onClick={doPreviewHtml}
            disabled={!form.corps_html.trim()}
            className="px-5 py-2.5 bg-white border border-purple-300 text-purple-700 text-sm font-medium rounded-lg hover:bg-purple-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Prévisualiser le HTML
          </button>
          {canChange && (
            <button
              onClick={resetModele}
              disabled={resetting}
              className="px-5 py-2.5 bg-white border border-gray-300 text-gray-700 text-sm font-medium rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50"
            >
              {resetting ? "Réinitialisation…" : "Réinitialiser le modèle"}
            </button>
          )}
        </div>

        {preview && (
          <div className="border border-gray-200 rounded-lg p-4 bg-gray-50">
            <h4 className="text-xs font-semibold text-gray-600 uppercase mb-2">
              Aperçu {previewMode === "html" ? "HTML" : "texte"} avec données d&apos;exemple
            </h4>
            <p className="text-sm font-semibold text-gray-800 mb-2">{preview.sujet}</p>
            {previewMode === "html" ? (
              preview.corps_html ? (
                <iframe
                  title="Aperçu HTML du modèle d'e-mail"
                  srcDoc={preview.corps_html}
                  sandbox=""
                  className="w-full min-h-[420px] border border-gray-200 rounded-lg bg-white"
                />
              ) : (
                <p className="text-xs text-gray-500">
                  Aucun contenu HTML après substitution des variables.
                </p>
              )
            ) : (
              <pre className="text-xs text-gray-700 whitespace-pre-wrap font-sans">
                {preview.corps_texte}
              </pre>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Onglet 3 : Résumé périodique                                        */
/* ------------------------------------------------------------------ */

function ResumeTab({ config, setConfig, canChange, notify }) {
  const [form, setForm] = useState({ ...config.resume });
  const [saving, setSaving] = useState(false);
  const [sending, setSending] = useState(false);
  const nextScheduledDate = getNextScheduledDate(form);

  const JOURS = ["Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi", "Samedi", "Dimanche"];

  const save = async () => {
    try {
      setSaving(true);
      const data = await updateConfigurationResume({
        is_enabled: form.is_enabled,
        frequence: form.frequence,
        heure_envoi: form.heure_envoi,
        jour_semaine: Number(form.jour_semaine),
        min_documents: Number(form.min_documents) || 1,
      });
      setForm({ ...data });
      setConfig((prev) => ({ ...prev, resume: data }));
      notify("success", "Configuration du résumé enregistrée.");
    } catch (err) {
      notify("error", err.message || "Enregistrement impossible.");
    } finally {
      setSaving(false);
    }
  };

  const sendNow = async () => {
    try {
      setSending(true);
      const result = await envoyerResumeMaintenant();
      const sentAt = new Date().toISOString();
      setForm((current) => ({ ...current, dernier_envoi: sentAt }));
      setConfig((current) => ({
        ...current,
        resume: { ...current.resume, dernier_envoi: sentAt },
      }));
      notify("success", result.detail || "Résumé mis en file d'envoi.");
    } catch (err) {
      notify("error", err.message || "Envoi impossible.");
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 space-y-5 max-w-2xl">
      <ToggleSwitch
        checked={form.is_enabled}
        disabled={!canChange}
        onChange={(value) => setForm((f) => ({ ...f, is_enabled: value }))}
        label="Activer le résumé périodique des documents en attente"
      />

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Fréquence</label>
          <select
            value={form.frequence}
            disabled={!canChange}
            onChange={(e) => setForm((f) => ({ ...f, frequence: e.target.value }))}
            className={inputClass}
          >
            <option value="daily">Quotidien</option>
            <option value="weekly">Hebdomadaire</option>
          </select>
        </div>
        {form.frequence === "weekly" && (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Jour</label>
            <select
              value={form.jour_semaine}
              disabled={!canChange}
              onChange={(e) => setForm((f) => ({ ...f, jour_semaine: e.target.value }))}
              className={inputClass}
            >
              {JOURS.map((jour, idx) => (
                <option key={jour} value={idx}>
                  {jour}
                </option>
              ))}
            </select>
          </div>
        )}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Heure d&apos;envoi</label>
          <input
            type="time"
            value={(form.heure_envoi || "08:00").slice(0, 5)}
            disabled={!canChange}
            onChange={(e) => setForm((f) => ({ ...f, heure_envoi: e.target.value }))}
            className={inputClass}
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Minimum de documents
          </label>
          <input
            type="number"
            min={1}
            value={form.min_documents}
            disabled={!canChange}
            onChange={(e) => setForm((f) => ({ ...f, min_documents: e.target.value }))}
            className={inputClass}
          />
        </div>
      </div>

      <div className="pt-4 border-t border-gray-100 text-xs text-gray-500 space-y-1.5">
        <p>
          <strong>Activer :</strong> autorise l&apos;envoi automatique. Ce bouton
          n&apos;installe pas la tâche Windows.
        </p>
        <p>
          <strong>Fréquence :</strong> quotidien = au maximum une fois par jour ;
          hebdomadaire = une fois le jour choisi.
        </p>
        <p>
          <strong>Heure d&apos;envoi :</strong> le résumé part au premier passage de
          la commande après cette heure.
        </p>
        <p>
          <strong>Minimum de documents :</strong> aucun e-mail n&apos;est envoyé à un
          contrôleur si son périmètre contient moins de documents en attente que ce seuil.
        </p>
        <p>
          <strong>Dernier envoi :</strong>{" "}
          {form.dernier_envoi
            ? new Date(form.dernier_envoi).toLocaleString("fr-FR")
            : "jamais"}
          . Le créneau du jour n&apos;est renvoyé que si vous reprogrammez une
          heure plus tardive.
        </p>
       
      </div>

      <div className="rounded-lg border border-purple-200 bg-purple-50 px-4 py-3">
        <p className="text-xs font-medium text-purple-900">
          Prochain envoi automatique
        </p>
        <p className="mt-1 text-sm font-semibold text-purple-800">
          {nextScheduledDate
            ? nextScheduledDate.toLocaleString("fr-FR", {
                dateStyle: "full",
                timeStyle: "short",
              })
            : "Désactivé"}
        </p>
        <p className="mt-1 text-xs text-purple-700">
          Date indicative : la tâche Windows doit être active. L&apos;envoi se fait
          au premier passage de la commande après cette date.
        </p>
      </div>

      {canChange && (
        <div className="flex gap-3 flex-wrap pt-1">
          <button
            onClick={save}
            disabled={saving}
            className="px-5 py-2.5 bg-purple-600 text-white text-sm font-medium rounded-lg hover:bg-purple-700 transition-colors disabled:opacity-50"
          >
            {saving ? "Enregistrement…" : "Enregistrer"}
          </button>
          <button
            onClick={sendNow}
            disabled={sending}
            className="px-5 py-2.5 bg-white border border-purple-300 text-purple-700 text-sm font-medium rounded-lg hover:bg-purple-50 transition-colors disabled:opacity-50"
          >
            {sending ? "Envoi…" : "Envoyer maintenant (test)"}
          </button>
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Onglet 4 : Journal                                                  */
/* ------------------------------------------------------------------ */

function JournalTab() {
  const [rows, setRows] = useState([]);
  const [total, setTotal] = useState(0);
  const [offset, setOffset] = useState(0);
  const [filters, setFilters] = useState({ eventType: "", statut: "", q: "" });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const limit = 25;

  useEffect(() => {
    getJournalNotifications({ ...filters, offset, limit })
      .then((data) => {
        setRows(data.results || []);
        setTotal(data.total || 0);
        setError("");
      })
      .catch((err) => setError(err.message || "Chargement impossible."))
      .finally(() => setLoading(false));
  }, [filters, offset]);

  return (
    <div className="space-y-4">
      <div className="flex gap-3 flex-wrap">
        <select
          value={filters.eventType}
          onChange={(e) => {
            setOffset(0);
            setFilters((f) => ({ ...f, eventType: e.target.value }));
          }}
          className="px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white"
        >
          <option value="">Tous les événements</option>
          <option value="soumission">Soumission</option>
          <option value="validation">Validation</option>
          <option value="rejet">Rejet</option>
          <option value="resoumission">Resoumission</option>
          <option value="identifiants">Mot de passe / identifiants</option>
          <option value="resume_periodique">Résumé périodique</option>
        </select>
        <select
          value={filters.statut}
          onChange={(e) => {
            setOffset(0);
            setFilters((f) => ({ ...f, statut: e.target.value }));
          }}
          className="px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white"
        >
          <option value="">Tous les statuts</option>
          <option value="sent">Envoyé</option>
          <option value="failed">Échec</option>
          <option value="skipped">Ignoré</option>
          <option value="queued">En file</option>
        </select>
        <input
          type="text"
          placeholder="Rechercher (e-mail, document, sujet)…"
          value={filters.q}
          onChange={(e) => {
            setOffset(0);
            setFilters((f) => ({ ...f, q: e.target.value }));
          }}
          className="px-3 py-2 border border-gray-300 rounded-lg text-sm flex-1 min-w-[220px]"
        />
      </div>

      {error && (
        <div className="p-4 rounded-lg text-sm bg-red-50 border border-red-200 text-red-700">
          {error}
        </div>
      )}

      <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs text-gray-500 uppercase border-b border-gray-200">
              <th className="px-4 py-3">Date</th>
              <th className="px-4 py-3">Événement</th>
              <th className="px-4 py-3">Document</th>
              <th className="px-4 py-3">Destinataire</th>
              <th className="px-4 py-3">Statut</th>
              <th className="px-4 py-3">Détail</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-gray-400">
                  Chargement…
                </td>
              </tr>
            ) : rows.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-gray-400">
                  Aucune notification enregistrée.
                </td>
              </tr>
            ) : (
              rows.map((row) => (
                <tr key={row.id} className="border-b border-gray-100 hover:bg-gray-50">
                  <td className="px-4 py-3 whitespace-nowrap text-gray-600">
                    {new Date(row.created_at).toLocaleString("fr-FR")}
                  </td>
                  <td className="px-4 py-3 text-gray-700">{row.event_type_label}</td>
                  <td className="px-4 py-3 text-gray-700">{row.document_label || "—"}</td>
                  <td className="px-4 py-3">
                    <div className="text-gray-800">{row.recipient_nom || "—"}</div>
                    <div className="text-xs text-gray-400">{row.recipient_email}</div>
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`px-2 py-1 rounded-full text-xs font-medium ${
                        STATUT_BADGES[row.statut] || "bg-gray-100 text-gray-600"
                      }`}
                    >
                      {row.statut_label}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-xs text-gray-500 max-w-[280px]">
                    {row.statut === "skipped"
                      ? row.skip_reason
                      : row.statut === "failed"
                      ? row.error_message
                      : row.sujet}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {total > limit && (
        <div className="flex items-center justify-between text-sm text-gray-600">
          <span>
            {offset + 1}–{Math.min(offset + limit, total)} sur {total}
          </span>
          <div className="flex gap-2">
            <button
              disabled={offset === 0}
              onClick={() => setOffset((o) => Math.max(0, o - limit))}
              className="px-3 py-1.5 border border-gray-300 rounded-lg disabled:opacity-40 hover:bg-gray-50"
            >
              Précédent
            </button>
            <button
              disabled={offset + limit >= total}
              onClick={() => setOffset((o) => o + limit)}
              className="px-3 py-1.5 border border-gray-300 rounded-lg disabled:opacity-40 hover:bg-gray-50"
            >
              Suivant
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
