// Petit client de l'API Clerk (instance de TEST) pour l'audit.
//
// Le parcours « connexion » a besoin d'un compte gratuit NEUF : un compte réutilisé
// garderait son compteur de générations d'une exécution à l'autre, et le test ne
// voudrait plus rien dire. On crée donc le compte avant le parcours et on le
// supprime après.
//
// Adresses en `+clerk_test@example.com` : ce sont les adresses de test reconnues par
// Clerk — aucun courriel réel n'est envoyé.

const API = 'https://api.clerk.com/v1';

// Préfixe commun à tous les comptes fabriqués par l'audit. Sert aussi de filtre de
// ménage : rien d'autre ne sera jamais supprimé.
const PREFIXE = 'virareel-audit-';

function secret(): string {
  const sk = process.env.CLERK_SECRET_KEY;
  if (!sk) throw new Error('CLERK_SECRET_KEY absente : .env.local non chargé ?');
  if (!sk.startsWith('sk_test_')) throw new Error('Clé Clerk de production : l\'audit refuse.');
  return sk;
}

async function clerkFetch(chemin: string, init: RequestInit = {}): Promise<Response> {
  const res = await fetch(`${API}${chemin}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${secret()}`,
      'Content-Type': 'application/json',
      ...(init.headers || {}),
    },
  });
  if (!res.ok) {
    throw new Error(`Clerk ${init.method || 'GET'} ${chemin} → ${res.status} ${await res.text()}`);
  }
  return res;
}

export interface CompteTest {
  id: string;
  courriel: string;
}

// Crée un compte gratuit neuf. `etiquette` sert seulement à s'y retrouver dans le
// tableau de bord Clerk si un ménage manuel devenait nécessaire.
export async function creerCompteTest(etiquette: string): Promise<CompteTest> {
  const courriel = `${PREFIXE}${etiquette}-${Date.now()}+clerk_test@example.com`;
  const res = await clerkFetch('/users', {
    method: 'POST',
    body: JSON.stringify({
      email_address: [courriel],
      // Connexion par jeton (ticket) : aucun mot de passe n'est nécessaire.
      skip_password_requirement: true,
    }),
  });
  const user = await res.json() as { id: string };
  return { id: user.id, courriel };
}

// Compteur de générations RÉELLEMENT enregistré sur le compte, tel que le site
// l'écrit dans Clerk (`privateMetadata.generationsUsed`).
//
// Clerk met un court instant à rendre visible ce qu'il vient d'écrire. L'audit
// enchaîne les générations bien plus vite qu'une personne : sans cette attente, la
// requête suivante relit une valeur périmée et le site offre un essai de trop.
// On attend donc que l'écriture soit visible, puis on renvoie ce qu'on a vu — c'est
// au test d'affirmer que le chiffre est le bon.
export async function compteurDuCompte(id: string, attendu: number): Promise<number> {
  let vu = 0;
  for (let i = 0; i < 40; i++) {
    const res = await clerkFetch(`/users/${id}`);
    const u = await res.json() as { private_metadata?: { generationsUsed?: number } };
    vu = u.private_metadata?.generationsUsed ?? 0;
    if (vu >= attendu) return vu;
    await new Promise(r => setTimeout(r, 500));
  }
  return vu;
}

export async function supprimerCompteTest(id: string): Promise<void> {
  await clerkFetch(`/users/${id}`, { method: 'DELETE' }).catch(() => { /* déjà supprimé */ });
}

// Ménage des comptes laissés par une exécution interrompue (Ctrl+C, panne de courant).
// Filtre STRICT sur le préfixe de l'audit : un vrai compte client ne peut pas être touché.
export async function menageComptesTest(): Promise<number> {
  const res = await clerkFetch(`/users?query=${encodeURIComponent(PREFIXE)}&limit=100`);
  const users = await res.json() as Array<{ id: string; email_addresses: Array<{ email_address: string }> }>;
  let supprimes = 0;
  for (const u of users) {
    const courriel = u.email_addresses?.[0]?.email_address || '';
    if (courriel.startsWith(PREFIXE) && courriel.endsWith('+clerk_test@example.com')) {
      await supprimerCompteTest(u.id);
      supprimes++;
    }
  }
  return supprimes;
}
