// ─── SOURCE UNIQUE du renouvellement MENSUEL du quota d'un abonné ─────────────
//
// Le problème corrigé ici (trouvé le 2026-08-29) : la remise à zéro du compteur
// vivait UNIQUEMENT dans le webhook Stripe, sur `invoice.paid` avec
// `billing_reason === 'subscription_cycle'`. Cette facture tombe à chaque cycle de
// FACTURATION — donc chaque mois en mensuel, mais **une seule fois par an en
// annuel**. Un abonné annuel recevait donc son quota pour l'année entière au lieu
// de chaque mois, alors que les cartes de prix annoncent « X générations/mois ».
//
// Le quota est MENSUEL pour tout le monde ; seule la FACTURE peut être annuelle.
// Les deux notions sont séparées ici une bonne fois : la facture ne décide plus du
// renouvellement, c'est le calendrier qui le décide.
//
// Aucun cron, aucune infrastructure en plus : la remise à zéro est PARESSEUSE.
// `resetDate` était déjà écrite à l'inscription mais n'était jamais relue pour
// décider quoi que ce soit — c'est elle qu'on lit maintenant, à chaque fois que le
// quota est consulté (generate, transcreate, user/stats). La date est en UTC comme
// tout ce qui tourne sur Vercel ; un même jour donne donc toujours la même réponse,
// ce qui garantit que la vérification AVANT génération et le décompte APRÈS
// arrivent au même résultat sans se coordonner.

export interface QuotaAJour {
  generationsUsed: number;
  resetDate: string;
  // Vrai quand ce calcul vient de rouvrir un nouveau mois : les routes qui écrivent
  // dans Clerk doivent alors persister `resetDate`, sinon la remise à zéro se
  // referait à chaque requête et le plafond ne s'appliquerait jamais.
  remisAZero: boolean;
}

// Nombre de jours du mois (annee, mois 0-11) — gere les annees bissextiles.
function joursDansLeMois(annee: number, mois: number): number {
  return new Date(Date.UTC(annee, mois + 1, 0)).getUTCDate();
}

// PROCHAINE remise a zero, en UTC, au format 'AAAA-MM-JJ'.
//
// `jourAncrage` = le jour du mois ou le quota se recharge, copie de la date
// d'anniversaire de l'abonnement chez Stripe (`billing_cycle_anchor`). Defaut 1
// pour rester compatible avec un compte qui n'en a pas encore.
//
// Regle du 31 : un mois trop court est ramene a son dernier jour, MAIS l'ancrage
// n'est jamais perdu — abonne le 31 janvier : 28 fevrier, puis 31 mars, 30 avril,
// 31 mai. C'est exactement la regle que Stripe applique a ses factures, donc le
// quota se recharge le jour meme de la facture, sans decalage a expliquer.
export function prochaineRemiseAZero(now: Date = new Date(), jourAncrage = 1): string {
  const jour = Math.min(Math.max(Math.trunc(jourAncrage) || 1, 1), 31);
  const annee = now.getUTCFullYear();
  const mois = now.getUTCMonth();

  // D'abord ce mois-ci : sert au cas ou l'ancrage tombe encore plus loin que
  // today (ex. remise a zero du 15 pour un ancrage au 28).
  const ceMois = Date.UTC(annee, mois, Math.min(jour, joursDansLeMois(annee, mois)));
  if (ceMois > Date.UTC(annee, mois, now.getUTCDate())) {
    return new Date(ceMois).toISOString().split('T')[0];
  }

  const suivant = new Date(Date.UTC(annee, mois + 1, 1));
  const a2 = suivant.getUTCFullYear();
  const m2 = suivant.getUTCMonth();
  return new Date(Date.UTC(a2, m2, Math.min(jour, joursDansLeMois(a2, m2))))
    .toISOString().split('T')[0];
}

export function aujourdhuiISO(now: Date = new Date()): string {
  return now.toISOString().split('T')[0];
}

// Quota réellement disponible aujourd'hui pour un abonné PAYANT.
// À n'appeler que pour les forfaits payants : le plafond d'un compte gratuit est
// un plafond À VIE (lib/limits.ts, FREE_ACCOUNT_LIMIT), il ne se renouvelle jamais.
export function quotaAJour(
  stored: number,
  resetDate: string | undefined | null,
  now: Date = new Date(),
  jourAncrage = 1
): QuotaAJour {
  const used = Number.isFinite(stored) && stored > 0 ? stored : 0;

  // Abonné d'avant ce correctif : aucune date en mémoire. On ne lui offre PAS un
  // mois gratuit au passage (on ignore ce qu'il a déjà consommé ce mois-ci) — on se
  // contente de lui poser une date, et son prochain renouvellement sera normal.
  if (!resetDate) {
    return { generationsUsed: used, resetDate: prochaineRemiseAZero(now, jourAncrage), remisAZero: true };
  }

  if (aujourdhuiISO(now) >= resetDate) {
    return { generationsUsed: 0, resetDate: prochaineRemiseAZero(now, jourAncrage), remisAZero: true };
  }

  return { generationsUsed: used, resetDate, remisAZero: false };
}

// Date de renouvellement, ecrite pour etre lue par un humain — le MOIS EN LETTRES,
// jamais en chiffres : « 28/04 » se lit « 4 aout » aux Etats-Unis et « 28 avril »
// en Europe. La clientele de ViraReel est des deux cotes de l'Atlantique.
// `iso` = 'AAAA-MM-JJ' (le format de resetDate). Renvoie '' si la date manque.
export function dateLisible(iso: string | null | undefined, lang: string): string {
  if (!iso) return '';
  const [a, m, j] = iso.split('-').map(Number);
  if (!a || !m || !j) return '';
  // midi UTC : a minuit, un fuseau negatif reculerait l'affichage d'une journee.
  const d = new Date(Date.UTC(a, m - 1, j, 12));
  return d.toLocaleDateString(lang === 'fr' ? 'fr-CA' : 'en-US', {
    day: 'numeric', month: 'long', timeZone: 'UTC',
  });
}
