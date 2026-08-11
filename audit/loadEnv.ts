import fs from 'fs';
import path from 'path';

// Le `.env.local` du site n'est lu que par Next. Playwright, lui, en a besoin pour
// parler directement à l'API Clerk : créer le compte de test avant le parcours
// « connexion », fabriquer le jeton de connexion, puis supprimer le compte.
//
// Lu à la main plutôt qu'avec `dotenv` : une dépendance de moins, et surtout un
// SEUL fichier de vérité pour les clés (celui du site). Rien n'est écrit ici.
export function loadEnvLocal(): void {
  const file = path.join(__dirname, '..', '.env.local');
  if (!fs.existsSync(file)) return;

  for (const ligne of fs.readFileSync(file, 'utf8').split(/\r?\n/)) {
    const m = ligne.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)$/);
    if (!m) continue;
    const valeur = m[2].trim().replace(/^["']|["']$/g, '');
    // Une variable déjà définie dans le terminal gagne (même règle que Next).
    if (process.env[m[1]] === undefined) process.env[m[1]] = valeur;
  }

  // @clerk/testing cherche `CLERK_PUBLISHABLE_KEY` ; le site, lui, la nomme avec le
  // préfixe NEXT_PUBLIC_. On recopie plutôt que de dupliquer la clé dans un 2e fichier.
  if (!process.env.CLERK_PUBLISHABLE_KEY && process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY) {
    process.env.CLERK_PUBLISHABLE_KEY = process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY;
  }
}

// Garde-fou : l'audit ne doit JAMAIS toucher l'instance Clerk de production.
export function assertClerkTestKeys(): void {
  const pk = process.env.CLERK_PUBLISHABLE_KEY || '';
  const sk = process.env.CLERK_SECRET_KEY || '';
  if (!pk.startsWith('pk_test_') || !sk.startsWith('sk_test_')) {
    throw new Error(
      'Clés Clerk de PRODUCTION détectées (pk_live/sk_live) : l\'audit refuse de créer '
      + 'des comptes sur l\'instance réelle. Vérifier .env.local.',
    );
  }
}
