export const PASSWORD_HELP =
  "8 caractères minimum, dont au moins une majuscule, une minuscule et un chiffre.";

export function passwordComplexityIssues(password = "") {
  const issues = [];
  if (password.length < 8) issues.push("8 caractères");
  if (!/[A-Z]/.test(password)) issues.push("une majuscule");
  if (!/[a-z]/.test(password)) issues.push("une minuscule");
  if (!/\d/.test(password)) issues.push("un chiffre");
  return issues;
}

export function isPasswordComplex(password) {
  return passwordComplexityIssues(password).length === 0;
}

export function passwordComplexityMessage(password) {
  const issues = passwordComplexityIssues(password);
  if (!issues.length) return "";
  return `Le mot de passe doit contenir ${issues.join(", ")}.`;
}
