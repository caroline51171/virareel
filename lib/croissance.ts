// Regroupement des événements datés en périodes, pour la courbe de croissance d'/admin.
//
// But : juger l'effet d'une campagne publicitaire dans le temps. Les dates viennent de
// Clerk (inscriptions), Resend (courriels captés) et Stripe (abonnements) — aucun suivi
// à ajouter, ces trois services horodatent déjà leurs enregistrements. L'historique
// remonte donc au début du SaaS, pas au jour où on affiche la courbe.
//
// ⚠️ Tout est calculé sur le fuseau America/Toronto, comme lib/anonStats.ts. En UTC,
// une inscription du soin de 20 h à Montréal tomberait le lendemain et fausserait le
// découpage par jour.
//
// Fichier PUR (aucun import) : c'est ce qui permet de le tester sans réseau.

export type Granularite = 'jour' | 'semaine' | 'mois';

export interface Point {
  /** Clé de la période : 'YYYY-MM-DD' (jour, ou lundi de la semaine) ou 'YYYY-MM' (mois). */
  periode: string;
  count: number;
}

const FUSEAU = 'America/Toronto';

function jourToronto(d: Date): string {
  return d.toLocaleDateString('en-CA', { timeZone: FUSEAU }); // YYYY-MM-DD
}

// Midi UTC : assez loin de minuit pour qu'aucun décalage de fuseau ne fasse
// basculer le jour pendant les calculs.
function midi(jour: string): Date {
  return new Date(`${jour}T12:00:00Z`);
}

/** Lundi de la semaine contenant ce jour, au même format. */
function lundiDe(jour: string): string {
  const d = midi(jour);
  const depuisLundi = (d.getUTCDay() + 6) % 7; // 0 = lundi
  d.setUTCDate(d.getUTCDate() - depuisLundi);
  return d.toISOString().slice(0, 10);
}

/** La clé de période dans laquelle tombe cette date. */
export function cleDe(date: Date, granularite: Granularite): string {
  const jour = jourToronto(date);
  if (granularite === 'jour') return jour;
  if (granularite === 'semaine') return lundiDe(jour);
  return jour.slice(0, 7); // YYYY-MM
}

/** Les `nb` dernières clés de période, de la plus ancienne à la plus récente. */
export function periodes(nb: number, granularite: Granularite, maintenant = new Date()): string[] {
  const cles: string[] = [];
  const ancre = midi(jourToronto(maintenant));

  for (let i = nb - 1; i >= 0; i--) {
    const d = new Date(ancre);
    if (granularite === 'jour') d.setUTCDate(d.getUTCDate() - i);
    else if (granularite === 'semaine') d.setUTCDate(d.getUTCDate() - i * 7);
    else d.setUTCMonth(d.getUTCMonth() - i, 1); // le 1er : évite qu'un 31 saute un mois court
    cles.push(cleDe(d, granularite));
  }
  return cles;
}

/**
 * Compte les dates par période. Les périodes sans aucun événement valent 0 — sans ça
 * la courbe sauterait les jours creux et donnerait une fausse impression de régularité.
 * Ce qui tombe hors de la fenêtre est ignoré.
 */
export function regrouper(
  datesISO: (string | null | undefined)[],
  granularite: Granularite,
  nb: number,
  maintenant = new Date(),
): Point[] {
  const cles = periodes(nb, granularite, maintenant);
  const compte = new Map(cles.map(c => [c, 0]));

  for (const iso of datesISO) {
    if (!iso) continue;
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) continue;
    const cle = cleDe(d, granularite);
    const actuel = compte.get(cle);
    if (actuel !== undefined) compte.set(cle, actuel + 1);
  }

  return cles.map(periode => ({ periode, count: compte.get(periode) ?? 0 }));
}
