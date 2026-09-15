// ─── Historique des forfaits d'un client ───────────────────────────────────────
//
// Stripe ne garde pas un historique simple des changements de forfait (ses
// evenements s'effacent apres 30 jours). Le webhook note donc lui-meme chaque
// etape dans `privateMetadata.historiqueForfaits` du compte Clerk : l'achat, chaque
// changement au portail, l'annulation (retour a `free`). Relu par /admin.
//
// Commence le 2026-09-15 : les comptes d'avant n'ont pas d'historique.
//
// Aucun import : fonction pure, testee (historiqueForfaits.test.ts).

export interface EtapeForfait {
  plan: string;   // cle interne : solo | creator | pro | free
  date: string;   // ISO
}

// Lit ce que Clerk a stocke : une donnee abimee est ignoree plutot que de planter.
export function lireHistorique(historique: unknown): EtapeForfait[] {
  return Array.isArray(historique)
    ? historique.filter((e): e is EtapeForfait =>
        !!e && typeof e.plan === 'string' && typeof e.date === 'string')
    : [];
}

// Ajoute une etape, sauf si le client est deja sur ce forfait (Stripe envoie
// plusieurs evenements pour un meme achat : on ne note le forfait qu'une fois).
export function ajouterEtape(historique: unknown, plan: string, date: string): EtapeForfait[] {
  const liste = lireHistorique(historique);
  if (liste[liste.length - 1]?.plan === plan) return liste;
  return [...liste, { plan, date }];
}

// Nom AFFICHE : `pro` s'affiche « Agency ».
const NOMS: Record<string, string> = { solo: 'Solo', creator: 'Creator', pro: 'Agency', free: 'Free' };

export function nomDuForfait(plan: string): string {
  return NOMS[plan] ?? plan;
}
