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

// 1er jour du mois suivant, en UTC, au format 'AAAA-MM-JJ'.
export function prochaineRemiseAZero(now: Date = new Date()): string {
  const suivant = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1));
  return suivant.toISOString().split('T')[0];
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
  now: Date = new Date()
): QuotaAJour {
  const used = Number.isFinite(stored) && stored > 0 ? stored : 0;

  // Abonné d'avant ce correctif : aucune date en mémoire. On ne lui offre PAS un
  // mois gratuit au passage (on ignore ce qu'il a déjà consommé ce mois-ci) — on se
  // contente de lui poser une date, et son prochain renouvellement sera normal.
  if (!resetDate) {
    return { generationsUsed: used, resetDate: prochaineRemiseAZero(now), remisAZero: true };
  }

  if (aujourdhuiISO(now) >= resetDate) {
    return { generationsUsed: 0, resetDate: prochaineRemiseAZero(now), remisAZero: true };
  }

  return { generationsUsed: used, resetDate, remisAZero: false };
}
