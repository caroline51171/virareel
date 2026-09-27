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
];

export function isAdminEmail(email: string | undefined | null): boolean {
  return !!email && ADMIN_EMAILS.includes(email.toLowerCase());
}

export function isBetaEmail(email: string | undefined | null): boolean {
  return !!email && BETA_EMAILS.includes(email.toLowerCase());
}

// Courriels de TEST (robots Alex/Audi, essais de paiement) : masqués des stats de
// /admin, sans rien effacer dans Clerk, Resend ou Stripe. Retirer une ligne = l'adresse
// réapparaît. Aucun effet sur les accès (limites, /admin) : seulement sur l'affichage.
export const TEST_EMAILS = [
  'harlequinjanie@emalupe.com',
  'vra5ebe2cc7@emalupe.com',
  'test.vendredi.early+vra@emalupe.com',
  'vr261owwhk@emalupe.com',
  'vrlead182b3433@emalupe.com',
  'vr270idees15798@emalupe.com',
  'vr300idees22665@emalupe.com',
  'vr300idees26394@emalupe.com',
  'viratest3101788357208@emalupe.com',
  'yeyigaj138@airhemp.com',
  'ywpqr7+2z08n5xdtk69w@sharklasers.com',
  'test.vendredi.matin+vra@emalupe.com',
  'test.vendredi.1028+vra@emalupe.com',
  'alex-solo-test-11sep@emalupe.com',
  'alex-essais-11sep@emalupe.com',
];

// Tous les alias « + » de Caroline (+testpay, +testpay2…, +contact, et les futurs)
// servent aux tests.
export function isTestEmail(email: string | undefined | null): boolean {
  if (!email) return false;
  const e = email.toLowerCase().trim();
  return TEST_EMAILS.includes(e) || /^caroline51171\+[^@]*@gmail\.com$/.test(e);
}

/** Hors des stats de /admin : Caroline elle-même OU une adresse de test. */
export function isHorsStats(email: string | undefined | null): boolean {
  return isAdminEmail(email) || isTestEmail(email);
}

/** Générations illimitées : admin OU bêta testeuse. */
export function isUnlimitedEmail(email: string | undefined | null): boolean {
  return isAdminEmail(email) || isBetaEmail(email);
}
