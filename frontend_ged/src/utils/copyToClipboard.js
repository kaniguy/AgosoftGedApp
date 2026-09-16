/**
 * Copie du texte dans le presse-papiers.
 * navigator.clipboard n'est disponible qu'en contexte sécurisé (HTTPS / localhost).
 * En HTTP (IP LAN, port Caddy, etc.) on retombe sur execCommand.
 */
export async function copyToClipboard(text) {
  const value = String(text ?? "");
  if (!value) {
    throw new Error("Aucun texte à copier.");
  }

  if (
    typeof navigator !== "undefined" &&
    window.isSecureContext &&
    navigator.clipboard?.writeText
  ) {
    try {
      await navigator.clipboard.writeText(value);
      return;
    } catch {
      // Continuer vers le repli (permission refusée, iframe, etc.)
    }
  }

  const textarea = document.createElement("textarea");
  textarea.value = value;
  textarea.setAttribute("readonly", "");
  textarea.setAttribute("aria-hidden", "true");
  textarea.style.position = "fixed";
  textarea.style.top = "0";
  textarea.style.left = "-9999px";
  textarea.style.opacity = "0";
  document.body.appendChild(textarea);
  textarea.focus();
  textarea.select();
  textarea.setSelectionRange(0, value.length);

  let copied = false;
  try {
    copied = document.execCommand("copy");
  } finally {
    document.body.removeChild(textarea);
  }

  if (!copied) {
    throw new Error("Copie impossible.");
  }
}
