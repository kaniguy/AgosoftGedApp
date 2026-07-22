"use client";

import { useState } from "react";
import SignatureCreateModal from "./SignatureCreateModal";
import {
  createUserSignature,
  deleteUserSignature,
  setDefaultUserSignature,
  updateUserSignaturePassword,
  verifyUserSignaturePassword,
} from "../../../services/userSignature.service";

function LockIcon({ className = "w-3.5 h-3.5" }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
      />
    </svg>
  );
}

function EyeIcon({ open = false, className = "w-4 h-4" }) {
  if (open) {
    return (
      <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21"
        />
      </svg>
    );
  }
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
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
  );
}

function PasswordInput({
  value,
  onChange,
  placeholder,
  disabled = false,
  autoFocus = false,
  autoComplete = "off",
  onKeyDown,
}) {
  const [visible, setVisible] = useState(false);
  return (
    <div className="relative">
      <input
        type={visible ? "text" : "password"}
        value={value}
        onChange={onChange}
        onKeyDown={onKeyDown}
        autoFocus={autoFocus}
        disabled={disabled}
        placeholder={placeholder}
        autoComplete={autoComplete}
        className="w-full rounded-md border border-slate-300 px-3 py-2 pr-10 text-sm"
      />
      <button
        type="button"
        tabIndex={-1}
        disabled={disabled}
        onClick={() => setVisible((v) => !v)}
        className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-slate-700 disabled:opacity-40"
        title={visible ? "Masquer le mot de passe" : "Afficher le mot de passe"}
        aria-label={visible ? "Masquer le mot de passe" : "Afficher le mot de passe"}
      >
        <EyeIcon open={visible} />
      </button>
    </div>
  );
}

/**
 * Gestion des signatures du compte : liste, sélection, création, suppression.
 * Icône cadenas = définir / modifier le mot de passe ; signatures protégées à déverrouiller.
 */
export default function SignaturesManagePanel({
  signatures = [],
  selectedId = null,
  onSelect,
  onRefresh,
  username = "",
  onNotify,
}) {
  const [showModal, setShowModal] = useState(false);
  const [busy, setBusy] = useState(false);
  const [deletingId, setDeletingId] = useState(null);
  const [unlockTarget, setUnlockTarget] = useState(null);
  const [unlockPassword, setUnlockPassword] = useState("");
  const [unlockError, setUnlockError] = useState("");
  const [unlockBusy, setUnlockBusy] = useState(false);

  const [passwordTarget, setPasswordTarget] = useState(null);
  const [passwordValue, setPasswordValue] = useState("");
  const [passwordConfirm, setPasswordConfirm] = useState("");
  const [currentPassword, setCurrentPassword] = useState("");
  const [passwordError, setPasswordError] = useState("");
  const [passwordBusy, setPasswordBusy] = useState(false);

  const activateSignature = (sig) => {
    onSelect?.(sig.id, sig);
  };

  /** Toujours redemander le mot de passe à chaque clic sur une signature protégée. */
  const handleSelectClick = (sig) => {
    if (!sig?.has_password) {
      activateSignature(sig);
      return;
    }
    setUnlockTarget(sig);
    setUnlockPassword("");
    setUnlockError("");
  };

  const openPasswordModal = (sig, e) => {
    e?.stopPropagation?.();
    setPasswordTarget(sig);
    setPasswordValue("");
    setPasswordConfirm("");
    setCurrentPassword("");
    setPasswordError("");
  };

  const handlePasswordSave = async ({ clear = false } = {}) => {
    if (!passwordTarget) return;
    setPasswordBusy(true);
    setPasswordError("");
    try {
      if (passwordTarget.has_password && !currentPassword) {
        setPasswordError("Saisissez le mot de passe actuel.");
        return;
      }
      if (!clear) {
        if (passwordValue.length < 4) {
          setPasswordError("Le mot de passe doit contenir au moins 4 caractères.");
          return;
        }
        if (passwordValue !== passwordConfirm) {
          setPasswordError("Les mots de passe ne correspondent pas.");
          return;
        }
      }
      await updateUserSignaturePassword(passwordTarget.id, {
        password: clear ? "" : passwordValue,
        passwordConfirm: clear ? "" : passwordConfirm,
        currentPassword: passwordTarget.has_password ? currentPassword : "",
      });
      if (selectedId === passwordTarget.id) {
        onSelect?.(null, null);
      }
      onNotify?.(clear ? "Protection retirée" : "Mot de passe enregistré", "success");
      setPasswordTarget(null);
      await onRefresh?.();
    } catch (err) {
      setPasswordError(err.message || "Erreur lors de l'enregistrement");
    } finally {
      setPasswordBusy(false);
    }
  };

  const handleUnlockConfirm = async () => {
    if (!unlockTarget) return;
    setUnlockBusy(true);
    setUnlockError("");
    try {
      await verifyUserSignaturePassword(unlockTarget.id, unlockPassword);
      activateSignature(unlockTarget);
      setUnlockTarget(null);
      setUnlockPassword("");
      onNotify?.("Signature déverrouillée", "success");
    } catch (err) {
      setUnlockError(err.message || "Mot de passe incorrect.");
    } finally {
      setUnlockBusy(false);
    }
  };

  const handleCreated = async ({ file, password = "" }) => {
    setBusy(true);
    try {
      const created = await createUserSignature({
        file,
        label: username ? `Signature ${username}` : "",
        isDefault: signatures.length === 0,
        password,
        passwordConfirm: password,
      });
      await onRefresh?.();
      setShowModal(false);
      if (password) {
        onSelect?.(null, null);
        onNotify?.("Signature protégée créée — cliquez dessus et saisissez le mot de passe", "success");
      } else {
        onSelect?.(created.id, created);
        onNotify?.("Signature enregistrée sur votre compte", "success");
      }
    } catch (err) {
      onNotify?.(err.message || "Erreur lors de l'enregistrement", "error");
    } finally {
      setBusy(false);
    }
  };

  const handleDelete = async (sig) => {
    if (!window.confirm("Supprimer cette signature de votre compte ?")) return;
    setDeletingId(sig.id);
    try {
      await deleteUserSignature(sig.id);
      await onRefresh?.();
      if (selectedId === sig.id) onSelect?.(null, null);
      onNotify?.("Signature supprimée", "success");
    } catch (err) {
      onNotify?.(err.message || "Suppression impossible", "error");
    } finally {
      setDeletingId(null);
    }
  };

  const handleSetDefault = async (sig) => {
    try {
      await setDefaultUserSignature(sig.id);
      await onRefresh?.();
      onNotify?.("Signature par défaut mise à jour", "success");
    } catch (err) {
      onNotify?.(err.message || "Erreur", "error");
    }
  };

  return (
    <div className="flex flex-col h-full min-h-0">
      <div className="px-4 py-3 border-b border-slate-100 space-y-2 shrink-0">
        <p className="text-xs text-slate-500">
          Cliquez sur le cadenas pour protéger une signature. Une signature protégée demande le
          mot de passe à chaque sélection.
        </p>
        <button
          type="button"
          onClick={() => setShowModal(true)}
          className="w-full px-3 py-2 text-sm font-medium rounded-lg bg-sky-600 text-white hover:bg-sky-500"
        >
          + Nouvelle signature
        </button>
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto p-3 space-y-2">
        {signatures.length === 0 ? (
          <p className="text-sm text-slate-400 text-center py-8 px-2">
            Aucune signature. Créez-en une (dessin, texte ou image).
          </p>
        ) : (
          signatures.map((sig) => {
            const isSelected = selectedId === sig.id;
            return (
              <div
                key={sig.id}
                className={`rounded-lg border p-2 transition ${
                  isSelected
                    ? "border-sky-400 bg-sky-50 ring-1 ring-sky-300"
                    : "border-slate-200 bg-white hover:border-slate-300"
                }`}
              >
                <button
                  type="button"
                  onClick={() => handleSelectClick(sig)}
                  className="w-full flex items-center justify-center min-h-[72px] bg-slate-50 rounded-md border border-slate-100 relative"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={sig.image_url}
                    alt={sig.label || `Signature ${sig.id}`}
                    className={`max-h-16 max-w-full object-contain ${sig.has_password ? "opacity-70" : ""}`}
                  />
                  {sig.has_password && (
                    <span
                      className="absolute top-1 left-1 inline-flex items-center justify-center w-5 h-5 rounded bg-amber-600 text-white"
                      title="Protégée — mot de passe demandé à chaque sélection"
                    >
                      <LockIcon className="w-3 h-3" />
                    </span>
                  )}
                </button>
                <div className="mt-2 flex items-center justify-between gap-1">
                  <div className="min-w-0">
                    <p className="text-xs font-medium text-slate-700 truncate">
                      {sig.label || `Signature #${sig.id}`}
                    </p>
                    <div className="flex items-center gap-2">
                      {sig.is_default && (
                        <span className="text-[10px] text-emerald-700 font-medium">Par défaut</span>
                      )}
                      {sig.has_password ? (
                        <span className="text-[10px] text-amber-700 font-medium">Protégée</span>
                      ) : (
                        <span className="text-[10px] text-slate-400">Non protégée</span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-0.5 shrink-0">
                    <button
                      type="button"
                      title={
                        sig.has_password
                          ? "Modifier ou retirer le mot de passe"
                          : "Protéger par mot de passe"
                      }
                      onClick={(e) => openPasswordModal(sig, e)}
                      className={`p-1.5 rounded ${
                        sig.has_password
                          ? "text-amber-600 hover:text-amber-800 hover:bg-amber-50"
                          : "text-slate-400 hover:text-sky-700 hover:bg-sky-50"
                      }`}
                    >
                      <LockIcon />
                    </button>
                    {!sig.is_default && (
                      <button
                        type="button"
                        title="Définir par défaut"
                        onClick={() => handleSetDefault(sig)}
                        className="p-1.5 rounded text-slate-400 hover:text-emerald-700 hover:bg-emerald-50"
                      >
                        ★
                      </button>
                    )}
                    <button
                      type="button"
                      title="Supprimer"
                      disabled={deletingId === sig.id}
                      onClick={() => handleDelete(sig)}
                      className="p-1.5 rounded text-slate-400 hover:text-red-600 hover:bg-red-50 disabled:opacity-40"
                    >
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                        />
                      </svg>
                    </button>
                  </div>
                </div>
                {isSelected && (
                  <p className="mt-1 text-[10px] text-sky-700 font-medium text-center">
                    Active — cliquez sur le PDF pour placer
                  </p>
                )}
              </div>
            );
          })
        )}
      </div>

      <SignatureCreateModal
        open={showModal}
        onClose={() => setShowModal(false)}
        onCreated={handleCreated}
        username={username}
        busy={busy}
      />

      {passwordTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-sm rounded-xl bg-white shadow-xl border border-slate-200 p-4 space-y-3">
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center justify-center w-8 h-8 rounded-lg bg-amber-50 text-amber-700">
                <LockIcon className="w-4 h-4" />
              </span>
              <h3 className="text-sm font-semibold text-slate-800">
                {passwordTarget.has_password ? "Modifier le mot de passe" : "Protéger la signature"}
              </h3>
            </div>
            <p className="text-xs text-slate-500">
              {passwordTarget.has_password
                ? "Saisissez d'abord le mot de passe actuel, puis le nouveau (ou retirez la protection)."
                : "Ce mot de passe sera demandé avant de placer la signature sur un document."}
            </p>
            {passwordTarget.has_password && (
              <PasswordInput
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                autoFocus
                disabled={passwordBusy}
                placeholder="Mot de passe actuel"
                autoComplete="current-password"
              />
            )}
            <PasswordInput
              value={passwordValue}
              onChange={(e) => setPasswordValue(e.target.value)}
              autoFocus={!passwordTarget.has_password}
              disabled={passwordBusy}
              placeholder={passwordTarget.has_password ? "Nouveau mot de passe" : "Mot de passe"}
              autoComplete="new-password"
            />
            <PasswordInput
              value={passwordConfirm}
              onChange={(e) => setPasswordConfirm(e.target.value)}
              disabled={passwordBusy}
              placeholder="Confirmer"
              autoComplete="new-password"
            />
            {passwordError && <p className="text-xs text-red-600">{passwordError}</p>}
            <div className="flex flex-wrap justify-end gap-2">
              {passwordTarget.has_password && (
                <button
                  type="button"
                  disabled={passwordBusy || !currentPassword}
                  onClick={() => handlePasswordSave({ clear: true })}
                  className="mr-auto px-3 py-1.5 text-sm rounded-md text-amber-800 hover:bg-amber-50 disabled:opacity-50"
                >
                  Retirer
                </button>
              )}
              <button
                type="button"
                disabled={passwordBusy}
                onClick={() => setPasswordTarget(null)}
                className="px-3 py-1.5 text-sm rounded-md border border-slate-200 text-slate-600 hover:bg-slate-50"
              >
                Annuler
              </button>
              <button
                type="button"
                disabled={
                  passwordBusy ||
                  !passwordValue ||
                  (passwordTarget.has_password && !currentPassword)
                }
                onClick={() => handlePasswordSave()}
                className="px-3 py-1.5 text-sm rounded-md bg-sky-600 text-white hover:bg-sky-500 disabled:opacity-50"
              >
                {passwordBusy ? "Enregistrement…" : "Enregistrer"}
              </button>
            </div>
          </div>
        </div>
      )}

      {unlockTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-sm rounded-xl bg-white shadow-xl border border-slate-200 p-4 space-y-3">
            <h3 className="text-sm font-semibold text-slate-800">Déverrouiller la signature</h3>
            <p className="text-xs text-slate-500">
              Cette signature est protégée. Saisissez le mot de passe pour l&apos;utiliser.
            </p>
            <PasswordInput
              value={unlockPassword}
              onChange={(e) => setUnlockPassword(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleUnlockConfirm();
              }}
              autoFocus
              disabled={unlockBusy}
              placeholder="Mot de passe"
            />
            {unlockError && <p className="text-xs text-red-600">{unlockError}</p>}
            <div className="flex justify-end gap-2">
              <button
                type="button"
                disabled={unlockBusy}
                onClick={() => {
                  setUnlockTarget(null);
                  setUnlockPassword("");
                  setUnlockError("");
                }}
                className="px-3 py-1.5 text-sm rounded-md border border-slate-200 text-slate-600 hover:bg-slate-50"
              >
                Annuler
              </button>
              <button
                type="button"
                disabled={unlockBusy || !unlockPassword}
                onClick={handleUnlockConfirm}
                className="px-3 py-1.5 text-sm rounded-md bg-sky-600 text-white hover:bg-sky-500 disabled:opacity-50"
              >
                {unlockBusy ? "Vérification…" : "Déverrouiller"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
