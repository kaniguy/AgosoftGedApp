"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { getApiUrl, getHeaders, apiFetch, hasClientSession } from "../../services/api";
import { syncUserStorage } from "../../services/profile.service";
import { getStoredUser } from "../../utils/permissions";
import { PASSWORD_HELP, passwordComplexityMessage } from "../../utils/passwordPolicy";

export default function FirstLoginPasswordModal() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const isPublic = pathname === "/auth/login" || pathname?.startsWith("/telechargement/");

  useEffect(() => {
    if (isPublic || !hasClientSession()) {
      setOpen(false);
      return;
    }
    const user = getStoredUser();
    setOpen(Boolean(user?.suggest_password_change));
  }, [pathname, isPublic]);

  useEffect(() => {
    const sync = () => {
      if (isPublic || !hasClientSession()) return;
      setOpen(Boolean(getStoredUser()?.suggest_password_change));
    };
    window.addEventListener("user-profile-updated", sync);
    return () => window.removeEventListener("user-profile-updated", sync);
  }, [isPublic]);

  const closePrompt = (userData) => {
    if (userData) syncUserStorage({ ...getStoredUser(), ...userData, suggest_password_change: false });
    else {
      const current = getStoredUser() || {};
      syncUserStorage({ ...current, suggest_password_change: false });
    }
    setOpen(false);
    setNewPassword("");
    setConfirmPassword("");
    setError("");
  };

  const callPrompt = async (payload) => {
    const res = await apiFetch(`${getApiUrl()}/api/auth/password-prompt/`, {
      method: "POST",
      headers: getHeaders(),
      body: JSON.stringify(payload),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(data.detail || "Impossible de mettre à jour le mot de passe.");
    }
    return data;
  };

  const handleSkip = async () => {
    setBusy(true);
    setError("");
    try {
      const data = await callPrompt({ action: "dismiss" });
      closePrompt(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  const handleChange = async (e) => {
    e.preventDefault();
    const complexity = passwordComplexityMessage(newPassword);
    if (complexity) {
      setError(complexity);
      return;
    }
    if (newPassword !== confirmPassword) {
      setError("Les mots de passe ne correspondent pas.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      const data = await callPrompt({
        action: "change",
        new_password: newPassword,
        confirm_password: confirmPassword,
      });
      closePrompt(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-slate-900/40 px-4">
      <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
        <h2 className="text-lg font-semibold text-slate-800">Changer votre mot de passe ?</h2>
        <p className="mt-2 text-sm text-slate-500">
          Bienvenue dans la GED : vous pouvez choisir un mot de passe pour vous connecter.
        </p>
        <p className="mt-1 text-xs text-slate-400">{PASSWORD_HELP}</p>

        <form className="mt-4 space-y-3" onSubmit={handleChange}>
          <input
            type="password"
            autoComplete="new-password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            placeholder="Nouveau mot de passe"
            className="w-full rounded-lg border px-3 py-2 text-sm"
            disabled={busy}
          />
          <input
            type="password"
            autoComplete="new-password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            placeholder="Confirmer"
            className="w-full rounded-lg border px-3 py-2 text-sm"
            disabled={busy}
          />
          {error && <p className="text-sm text-red-600">{error}</p>}
          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={handleSkip}
              disabled={busy}
              className="rounded-lg px-4 py-2 text-sm text-slate-600 hover:bg-slate-50 disabled:opacity-50"
            >
              Plus tard
            </button>
            <button
              type="submit"
              disabled={busy || !newPassword}
              className="rounded-lg bg-purple-600 px-4 py-2 text-sm font-medium text-white hover:bg-purple-700 disabled:opacity-50"
            >
              {busy ? "Enregistrement…" : "Enregistrer"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
