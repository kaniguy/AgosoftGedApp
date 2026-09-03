"use client";

import { useState } from "react";
import {
  VALIDITY_HOUR_OPTIONS,
  createLienTelechargement,
  sendLienTelechargementEmail,
} from "../../services/liensTelechargement.service";

function formatRecipientsLabel(value) {
  if (!value) return "";
  if (Array.isArray(value)) return value.join(" ; ");
  return String(value);
}

export default function LienTelechargementModal({ documentIds, onClose, onNotify }) {
  const [validityHours, setValidityHours] = useState(12);
  const [recipientEmail, setRecipientEmail] = useState("");
  const [oneTime, setOneTime] = useState(true);
  const [linkPassword, setLinkPassword] = useState("");
  const [showLinkPassword, setShowLinkPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [generatedLink, setGeneratedLink] = useState(null);
  const [emailSentTo, setEmailSentTo] = useState(null);
  const [copied, setCopied] = useState(false);
  const [resendEmail, setResendEmail] = useState("");
  const [resending, setResending] = useState(false);

  const count = documentIds?.length || 0;
  const trimmedEmail = recipientEmail.trim();

  const handleGenerate = async ({ sendEmail = false } = {}) => {
    if (!count) return;
    if (sendEmail && !trimmedEmail) {
      onNotify?.("Saisissez au moins une adresse e-mail.", "error");
      return;
    }
    if (linkPassword.trim() && linkPassword.trim().length < 4) {
      onNotify?.("Le mot de passe du lien doit contenir au moins 4 caractères.", "error");
      return;
    }

    setLoading(true);
    try {
      const data = await createLienTelechargement({
        documentIds,
        validityHours,
        recipientEmail: sendEmail ? trimmedEmail : undefined,
        oneTime,
        password: linkPassword.trim(),
      });
      setGeneratedLink(data);
      if (data.email_sent_to) {
        const label = formatRecipientsLabel(data.email_sent_to);
        setEmailSentTo(label);
        onNotify?.(`Lien envoyé à ${label}.`, "success");
      } else {
        onNotify?.("Lien de téléchargement généré.", "success");
      }
    } catch (err) {
      onNotify?.(err.message || "Impossible de générer le lien.", "error");
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    const email = resendEmail.trim();
    if (!email || !generatedLink?.id) return;
    setResending(true);
    try {
      const data = await sendLienTelechargementEmail(generatedLink.id, email);
      const label = formatRecipientsLabel(data.email_sent_to || email);
      setEmailSentTo(label);
      onNotify?.(`Lien envoyé à ${label}.`, "success");
      setResendEmail("");
    } catch (err) {
      onNotify?.(err.message || "Impossible d'envoyer l'e-mail.", "error");
    } finally {
      setResending(false);
    }
  };

  const handleCopy = async () => {
    if (!generatedLink?.download_url) return;
    try {
      await navigator.clipboard.writeText(generatedLink.download_url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      onNotify?.("Copie impossible.", "error");
    }
  };

  return (
    <div className="fixed inset-0 z-[300] flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
      <div className="w-full max-w-lg rounded-2xl bg-white shadow-2xl border border-slate-200 overflow-hidden">
        <div className="px-5 py-4 bg-gradient-to-r from-cyan-600 to-sky-600 text-white flex items-center justify-between">
          <div>
            <h3 className="text-base font-semibold">Lien de téléchargement temporaire</h3>
            <p className="text-xs text-cyan-100 mt-0.5">
              {count} document{count > 1 ? "s" : ""} sélectionné{count > 1 ? "s" : ""}
              {count > 1 ? " (archive RAR/ZIP)" : ""}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-white/20 transition"
            aria-label="Fermer"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="p-5 space-y-4">
          {!generatedLink ? (
            <>
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wide text-slate-500 mb-2">
                  Validité du lien
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {VALIDITY_HOUR_OPTIONS.map((opt) => (
                    <label
                      key={opt.value}
                      className={`flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl border cursor-pointer transition ${
                        validityHours === opt.value
                          ? "border-cyan-400 bg-cyan-50 text-cyan-800 ring-2 ring-cyan-100"
                          : "border-slate-200 hover:border-cyan-200 hover:bg-slate-50"
                      }`}
                    >
                      <input
                        type="radio"
                        name="validity"
                        value={opt.value}
                        checked={validityHours === opt.value}
                        onChange={() => setValidityHours(opt.value)}
                        className="sr-only"
                      />
                      <span className="text-sm font-medium">{opt.label}</span>
                    </label>
                  ))}
                </div>
              </div>

              <div>
                <label
                  htmlFor="lien-recipient-email"
                  className="block text-xs font-semibold uppercase tracking-wide text-slate-500 mb-1.5"
                >
                  Destinataires (e-mail)
                </label>
                <input
                  id="lien-recipient-email"
                  type="text"
                  inputMode="email"
                  value={recipientEmail}
                  onChange={(e) => setRecipientEmail(e.target.value)}
                  placeholder="ex1@domaine.com ; ex2@domaine.com"
                  className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-cyan-200 focus:border-cyan-400"
                  autoComplete="email"
                />
                <p className="mt-1.5 text-xs text-slate-400">
                  Plusieurs adresses : séparez-les par un point-virgule <span className="font-medium text-slate-500">;</span>{" "}
                  (ou une virgule).
                </p>
              </div>

              <label className="flex items-start gap-3 rounded-xl border border-slate-200 px-3 py-2.5 cursor-pointer hover:bg-slate-50">
                <input
                  type="checkbox"
                  checked={oneTime}
                  onChange={(e) => setOneTime(e.target.checked)}
                  className="mt-0.5 rounded border-slate-300 text-cyan-600 focus:ring-cyan-500"
                />
                <span>
                  <span className="block text-sm font-medium text-slate-800">Usage unique</span>
                  <span className="block text-xs text-slate-500 mt-0.5">
                    Le lien se désactive automatiquement après le premier téléchargement réussi (recommandé).
                  </span>
                </span>
              </label>

              <div>
                <label
                  htmlFor="lien-password"
                  className="block text-xs font-semibold uppercase tracking-wide text-slate-500 mb-1.5"
                >
                  Mot de passe du lien (optionnel)
                </label>
                <div className="relative">
                  <input
                    id="lien-password"
                    type={showLinkPassword ? "text" : "password"}
                    value={linkPassword}
                    onChange={(e) => setLinkPassword(e.target.value)}
                    placeholder="Laisser vide = accès libre avec le lien"
                    className="w-full rounded-xl border border-slate-200 px-3 py-2.5 pr-10 text-sm text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-cyan-200 focus:border-cyan-400"
                    autoComplete="new-password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowLinkPassword((v) => !v)}
                    className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-600 focus:outline-none"
                    title={showLinkPassword ? "Masquer" : "Afficher"}
                    aria-label={
                      showLinkPassword ? "Masquer le mot de passe" : "Afficher le mot de passe"
                    }
                    tabIndex={-1}
                  >
                    {showLinkPassword ? (
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l18 18"
                        />
                      </svg>
                    ) : (
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                        />
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"
                        />
                      </svg>
                    )}
                  </button>
                </div>
              </div>

              <p className="text-xs text-slate-500">
                Le lien permet de télécharger {count > 1 ? "les documents en archive" : "le document"}{" "}, jusqu&apos;à expiration
                {oneTime ? " (un seul téléchargement)" : ""}.
              </p>

              <div className="flex flex-col sm:flex-row gap-2 pt-1">
                <button
                  type="button"
                  onClick={onClose}
                  className="sm:flex-1 py-2.5 rounded-xl border border-slate-200 text-slate-700 text-sm font-medium hover:bg-slate-50"
                >
                  Annuler
                </button>
                <button
                  type="button"
                  onClick={() => handleGenerate({ sendEmail: false })}
                  disabled={loading}
                  className="sm:flex-1 py-2.5 rounded-xl border border-cyan-200 bg-cyan-50 text-cyan-800 text-sm font-semibold hover:bg-cyan-100 disabled:opacity-60"
                >
                  {loading ? "Génération…" : "Générer le lien"}
                </button>
                <button
                  type="button"
                  onClick={() => handleGenerate({ sendEmail: true })}
                  disabled={loading || !trimmedEmail}
                  className="sm:flex-1 py-2.5 rounded-xl bg-gradient-to-r from-cyan-600 to-sky-600 text-white text-sm font-semibold disabled:opacity-60"
                >
                  {loading ? "Préparation…" : "Envoyer par e-mail"}
                </button>
              </div>
            </>
          ) : (
            <>
              {emailSentTo && (
                <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2.5 text-sm text-emerald-800">
                  <p>
                    Lien envoyé à <span className="font-medium">{emailSentTo}</span>
                  </p>
                  <p className="mt-1 text-xs text-slate-500">
                    Pensez à vérifier le dossier spam.
                  </p>
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wide text-slate-500 mb-1.5">
                  Lien à partager
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    readOnly
                    value={generatedLink.download_url}
                    className="flex-1 min-w-0 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700"
                  />
                  <button
                    type="button"
                    onClick={handleCopy}
                    className="px-4 py-2 rounded-xl border border-cyan-200 bg-cyan-50 text-cyan-800 text-sm font-medium hover:bg-cyan-100 shrink-0"
                  >
                    {copied ? "Copié !" : "Copier"}
                  </button>
                </div>
              </div>

              <div className="text-xs text-slate-500 space-y-1">
                <p>
                  Expire le{" "}
                  <span className="font-medium text-slate-700">
                    {new Date(generatedLink.expires_at).toLocaleString("fr-FR")}
                  </span>
                </p>
                <p>Statut : {generatedLink.status_label}</p>
              </div>

              <div className="pt-1 border-t border-slate-100">
                <label
                  htmlFor="lien-resend-email"
                  className="block text-xs font-semibold uppercase tracking-wide text-slate-500 mb-1.5"
                >
                  Envoyer à d&apos;autres destinataires
                </label>
                <div className="flex gap-2">
                  <input
                    id="lien-resend-email"
                    type="text"
                    inputMode="email"
                    value={resendEmail}
                    onChange={(e) => setResendEmail(e.target.value)}
                    placeholder="autre@domaine.com ; autre2@domaine.com"
                    className="flex-1 min-w-0 rounded-xl border border-slate-200 px-3 py-2 text-sm"
                  />
                  <button
                    type="button"
                    onClick={handleResend}
                    disabled={resending || !resendEmail.trim()}
                    className="px-4 py-2 rounded-xl bg-slate-800 text-white text-sm font-medium hover:bg-slate-900 disabled:opacity-50 shrink-0"
                  >
                    {resending ? "…" : "Envoyer"}
                  </button>
                </div>
              </div>

              <button
                type="button"
                onClick={onClose}
                className="w-full py-2.5 rounded-xl border border-slate-200 text-slate-700 text-sm font-medium hover:bg-slate-50"
              >
                Fermer
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
