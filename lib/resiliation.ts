// Courriel de confirmation de RÉSILIATION (bouton « Résilier mon abonnement »).
//
// La loi québécoise (LPC art. 187.28, en vigueur le 12 sept. 2026) n'exige que le
// bouton ; Jean (bot légal, 2026-09-30) recommande quand même une confirmation écrite,
// par prudence : un règlement peut l'ajouter, et elle prouve la demande en cas de litige.
// Stripe n'envoie aucun courriel de ce genre : c'est le webhook qui l'envoie.

// Même format que l'accusé de renonciation (lib/renonciation.ts). Copié plutôt
// qu'importé : un import entre fichiers de lib/ casserait `node --test`.
function dateHeure(date: Date, lang: 'fr' | 'en'): string {
  const f = new Intl.DateTimeFormat(lang === 'fr' ? 'fr-FR' : 'en-GB', {
    dateStyle: 'long', timeStyle: 'short', timeZone: 'UTC',
  });
  return `${f.format(date)} (UTC)`;
}

// Résiliation programmée = fin de période (`cancel_at_period_end`) ou date fixe
// (`cancel_at`). Selon la version de l'API, le portail pose l'un ou l'autre.
interface EtatAnnulation {
  cancel_at_period_end?: boolean | null;
  cancel_at?: number | null;
}

function programmee(e: EtatAnnulation): boolean {
  return !!e.cancel_at_period_end || e.cancel_at != null;
}

// Vrai seulement au PASSAGE « pas de résiliation → résiliation programmée » : les
// autres mises à jour (changement de forfait, renouvellement, ou la personne qui
// revient sur sa résiliation) n'envoient rien.
export function vientDEtreResilie(
  actuel: EtatAnnulation,
  precedent: Partial<EtatAnnulation> | undefined,
): boolean {
  if (!precedent || !programmee(actuel)) return false;
  if (!('cancel_at_period_end' in precedent) && !('cancel_at' in precedent)) return false;
  const avant: EtatAnnulation = {
    cancel_at_period_end: 'cancel_at_period_end' in precedent ? precedent.cancel_at_period_end : actuel.cancel_at_period_end,
    cancel_at: 'cancel_at' in precedent ? precedent.cancel_at : actuel.cancel_at,
  };
  return !programmee(avant);
}

// 'pro' = Agency (clé interne historique, voir lib/pricing.ts).
const NOMS: Record<string, string> = { solo: 'Solo', creator: 'Creator', pro: 'Agency' };

export function nomForfait(checkoutKey: string | null | undefined): string {
  return (checkoutKey && NOMS[checkoutKey]) || '';
}

// Contenu minimal demandé par Jean : date de la demande, date de fin du service,
// forfait visé, aucun prélèvement futur.
export function courrielResiliation(p: {
  forfait: string;
  demandeLe: Date;
  finAcces: Date;
  lang: 'fr' | 'en';
}): { sujet: string; html: string } {
  const fr = p.lang === 'fr';
  const forfait = p.forfait ? ` ${p.forfait}` : '';
  const sujet = fr
    ? 'Confirmation de résiliation — ViraReel AI'
    : 'Cancellation confirmation — ViraReel AI';
  const html = `
    <p>${fr ? 'Bonjour,' : 'Hello,'}</p>
    <p>${fr
      ? `Votre abonnement ViraReel AI${forfait} a été résilié le ${dateHeure(p.demandeLe, 'fr')}.`
      : `Your ViraReel AI${forfait} subscription was cancelled on ${dateHeure(p.demandeLe, 'en')}.`}</p>
    <p>${fr
      ? `Votre accès reste actif jusqu’au ${dateHeure(p.finAcces, 'fr')}. Aucun autre paiement ne sera prélevé.`
      : `Your access remains active until ${dateHeure(p.finAcces, 'en')}. No further payments will be charged.`}</p>
    <p>${fr
      ? 'Vous avez changé d’avis ? « Gérer mon abonnement », dans votre compte ViraReel AI, permet de reprendre l’abonnement avant cette date.'
      : 'Changed your mind? “Manage my subscription” in your ViraReel AI account lets you resume your subscription before that date.'}</p>
    <p>${fr ? 'Merci,' : 'Thank you,'}<br>ViraReel AI — hello@virareelai.com</p>
  `;
  return { sujet, html };
}
