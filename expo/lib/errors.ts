/** Maps backend/auth errors to friendly French messages. */
export function friendlyError(e: unknown): string {
  const msg =
    typeof e === "object" && e !== null && "message" in e ? String((e as { message: unknown }).message) : String(e);

  if (/Email not confirmed/i.test(msg)) return "Ton email n'est pas encore confirmé. Vérifie ta boîte mail.";
  if (/Invalid login credentials/i.test(msg)) return "Email ou mot de passe incorrect.";
  if (/User already registered|already been registered/i.test(msg)) return "Un compte existe déjà avec cet email.";
  if (/Password should be at least|at least 6/i.test(msg)) return "Le mot de passe doit faire au moins 6 caractères.";
  if (/Unable to validate email|invalid format|valid email/i.test(msg)) return "Adresse email invalide.";
  if (/rate limit|too many/i.test(msg)) return "Trop de tentatives. Réessaie dans un instant.";
  if (/row-level security|violates row-level|not authorized|permission denied/i.test(msg))
    return "Tu n'as pas les droits pour cette action.";
  if (/invalid input syntax/i.test(msg)) return "Le serveur a refusé cet envoi. Réessaie.";
  if (/duplicate key|already exists/i.test(msg)) return "Cet élément existe déjà.";
  if (/network|fetch|timeout|Failed to/i.test(msg)) return "Problème de connexion. Vérifie ton réseau.";
  return msg || "Une erreur est survenue.";
}
