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

    setLoading(true);
    try {
      const data = await createLienTelechargement({
        documentIds,
        validityHours,
        recipientEmail: sendEmail ? trimmedEmail : undefined,
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

              <p className="text-xs text-slate-500">
                Le lien permet de télécharger {count > 1 ? "les documents en archive" : "le document"}{" "}
                sans connexion, jusqu&apos;à expiration.
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
