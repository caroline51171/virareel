// ─── Remboursement → fin d'abonnement (sauf double facturation) ───────────────
//
// Règle des CGV (§5, 2026-08-30) : « Un remboursement met fin à l'abonnement :
// l'accès au service et le quota cessent au moment où le remboursement est
// accordé. » Le webhook écoute `charge.refunded` et doit décider : couper ou pas.
//
// Le seul cas où l'on ne coupe PAS : la DOUBLE FACTURATION. On rembourse alors une
// charge EN TROP — la période en cours reste payée par une autre charge, le client
// garde son accès. Le test qui distingue les deux cas n'est pas une devinette :
// on regarde si la charge remboursée est celle qui règle la facture de la PÉRIODE
// en cours de l'abonnement actif (voir `factureDePeriode`). Oui → la période n'est plus payée → on coupe. Non (charge
// en double, ou charge d'une vieille période) → on ne touche à rien.
//
// Un remboursement PARTIEL ne coupe jamais (`charge.refunded` reste false chez
// Stripe tant que la charge n'est pas remboursée en entier) : rembourser une
// partie n'annule pas le paiement de la période.
//
// La coupure elle-même passe par `stripe.subscriptions.cancel()` : Stripe renvoie
// alors `customer.subscription.deleted`, et c'est le bloc EXISTANT du webhook qui
// remet le compte en gratuit. Un seul chemin de rétrogradation, pas deux.

// ─── Quelle facture paie la PÉRIODE en cours ? ─────────────────────────────────
//
// Pas forcément la dernière. Un changement de forfait au portail (prorata
// `always_invoice`) crée sur-le-champ une facture d'AJUSTEMENT (`subscription_update`) :
// elle devient la dernière facture de l'abonnement. Avant, c'est elle qu'on
// regardait — le remboursement de la charge de la période ne la « réglait » donc
// jamais, et un abonné ayant changé de forfait gardait son accès après remboursement.
//
// La facture de période = la plus récente créée à la souscription ou au
// renouvellement. Les ajustements (et tout le reste) sont ignorés.
export interface FactureResumee {
  id: string;
  billing_reason?: string | null;
}

const FACTURES_DE_PERIODE = ['subscription_create', 'subscription_cycle'];

// `factures` dans l'ordre renvoyé par Stripe : la plus récente en premier.
export function factureDePeriode(factures: FactureResumee[]): string | null {
  return factures.find(f => FACTURES_DE_PERIODE.includes(f.billing_reason ?? ''))?.id ?? null;
}

// Forme minimale d'un paiement de facture (InvoicePayment.payment chez Stripe) :
// il référence SOIT une charge, SOIT un payment_intent, jamais les deux.
export interface PaiementDeFacture {
  charge?: string | { id: string } | null;
  payment_intent?: string | { id: string } | null;
}

function idDe(ref: string | { id: string } | null | undefined): string | null {
  if (!ref) return null;
  return typeof ref === 'string' ? ref : ref.id;
}

// La charge remboursée règle-t-elle cette facture ?
export function factureRegleeParCharge(
  paiements: PaiementDeFacture[],
  chargeId: string,
  paymentIntentId: string | null
): boolean {
  return paiements.some(p => {
    const parCharge = idDe(p.charge);
    if (parCharge && parCharge === chargeId) return true;
    const parIntent = idDe(p.payment_intent);
    return parIntent !== null && parIntent === paymentIntentId;
  });
}
