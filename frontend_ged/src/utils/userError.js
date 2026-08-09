/** Messages affichables à l'utilisateur (sans détails techniques). */

export const USER_ERRORS = {
  network:
    "Connexion au serveur impossible. Veuillez réessayer dans quelques instants.",
  unexpected: "Une erreur inattendue est survenue. Veuillez réessayer.",
  auth: "Identifiant ou mot de passe incorrect.",
};

const TECHNICAL_PATTERNS = [
  /serveur api injoignable/i,
  /backend django injoignable/i,
  /failed to fetch/i,
  /networkerror/i,
  /econnrefused/i,
  /python manage\.py runserver/i,
  /npm run dev/i,
  /vérifiez que django/i,
  /démarrez le backend/i,
  /http:\/\/127\.0\.0\.1/i,
  /localhost:\d+/i,
];

/**
 * Retourne un message sûr pour l'interface, ou le message d'origine s'il est déjà métier.
 */
export function toUserMessage(
  error,
  fallback = USER_ERRORS.unexpected
) {
  const raw =
    typeof error === "string"
      ? error
      : error?.message || error?.detail || fallback;

  if (!raw || TECHNICAL_PATTERNS.some((pattern) => pattern.test(raw))) {
    return fallback;
  }

  return raw;
}
