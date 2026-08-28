// SOURCE UNIQUE des accès illimités (comme lib/pricing.ts et lib/limits.ts).
// Ajouter une testeuse = UNE ligne dans BETA_EMAILS, rien d'autre à toucher.
//
// ADMIN  : illimité + tableau de bord /admin + coût NON compté (c'est Caroline).
// BÊTA   : illimité, PAS d'accès à /admin, et coût BIEN compté pour le voir dans /admin.
//
// Aucun import ici : ce fichier est lu côté serveur ET côté navigateur.

export const ADMIN_EMAILS = [
  'caroline51171@gmail.com',
  'caroline51171@hotmail.fr',
];

export const BETA_EMAILS = [
  'simplementchantal06@gmail.com',
  // Testeur temporaire (2026-08-27) — retirer cette ligne quand les tests sont finis.
  'harlequinjanie@emalupe.com',
];

export function isAdminEmail(email: string | undefined | null): boolean {
  return !!email && ADMIN_EMAILS.includes(email.toLowerCase());
}

export function isBetaEmail(email: string | undefined | null): boolean {
  return !!email && BETA_EMAILS.includes(email.toLowerCase());
}

/** Générations illimitées : admin OU bêta testeuse. */
export function isUnlimitedEmail(email: string | undefined | null): boolean {
  return isAdminEmail(email) || isBetaEmail(email);
}
