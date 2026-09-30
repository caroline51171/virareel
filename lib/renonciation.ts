// Renonciation au contrat dans les 14 jours — bouton « Renoncer au contrat ici ».
//
// Obligatoire depuis le 19 juin 2026 (directive 2023/2673, art. 11 bis ; en France,
// ordonnance 2026-2 du 5 janv. 2026, libellé exact « Renoncer au contrat ici »).
// Link (vendeur officiel) ne fournit pas cette fonction : c'est la nôtre, validée par
// Jean le 2026-09-29. Page : app/renoncer ; traitement : app/api/renonciation.
//
// Règles :
//  · consommateurs de l'EEE et du Royaume-Uni (pays de FACTURATION, lib/consentement.ts) ;
//  · 14 jours à compter du PREMIER paiement de l'abonnement — un renouvellement ne
//    relance pas le délai ;
//  · remboursement COMPLET (aucune renonciation au délai n'a été recueillie) et
//    abonnement annulé sur-le-champ ;
//  · accusé de réception par courriel, avec la date et l'heure, dans TOUS les cas —
//    même quand on ne rembourse pas (hors délai, hors zone, aucun abonnement).

export const DELAI_JOURS = 14;

// Le délai court jusqu'à la FIN du 14e jour qui suit le jour du paiement. On compte en
// jours UTC, en arrondissant en faveur du client : mieux vaut rembourser quelques
// heures de trop qu'en refuser une légitime.
export function dansLeDelai(premierPaiement: Date, maintenant: Date): boolean {
  const jourDuPaiement = Date.UTC(
    premierPaiement.getUTCFullYear(), premierPaiement.getUTCMonth(), premierPaiement.getUTCDate(),
  );
  const finDuDelai = jourDuPaiement + (DELAI_JOURS + 1) * 24 * 60 * 60 * 1000;
  return maintenant.getTime() < finDuDelai;
}

// Ce qu'on a fait de la demande. Une seule issue par demande, même si la personne a
// plusieurs abonnements (la plus favorable l'emporte, voir `issueGlobale`).
export type Issue =
  | 'rembourse'          // dans le délai, EEE/R.-U. : remboursé en entier + annulé
  | 'a_traiter'          // devait être remboursé mais Stripe a échoué, ou pays inconnu → Caroline
  | 'hors_delai'         // plus de 14 jours depuis le 1er paiement
  | 'hors_zone'          // facturé hors EEE/R.-U.
  | 'aucun_abonnement';  // rien d'actif à cette adresse

const ORDRE: Issue[] = ['rembourse', 'a_traiter', 'hors_delai', 'hors_zone', 'aucun_abonnement'];

export function issueGlobale(issues: Issue[]): Issue {
  for (const i of ORDRE) if (issues.includes(i)) return i;
  return 'aucun_abonnement';
}

export function dateHeure(date: Date, lang: 'fr' | 'en'): string {
  const f = new Intl.DateTimeFormat(lang === 'fr' ? 'fr-FR' : 'en-GB', {
    dateStyle: 'long', timeStyle: 'short', timeZone: 'UTC',
  });
  return `${f.format(date)} (UTC)`;
}

function echapper(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

const LIEN_LINK = 'https://support.link.com/questions/requesting-a-refund-for-a-sold-through-link-payment';

// Accusé de réception : le « support durable » exigé par la loi. Il reprend ce que la
// personne a envoyé (nom, courriel, date et heure), puis dit ce qui a été fait.
export function courrielAccuse(p: {
  nom: string;
  courriel: string;
  date: Date;
  issue: Issue;
  lang: 'fr' | 'en';
}): { sujet: string; html: string } {
  const fr = p.lang === 'fr';
  const quand = dateHeure(p.date, p.lang);

  const suite: Record<Issue, string> = fr ? {
    rembourse: 'Votre abonnement est annulé et le paiement vous est remboursé en entier. Link, notre vendeur officiel, vous enverra aussi sa propre confirmation. Le montant apparaît sur votre relevé sous 5 à 10 jours ouvrables, selon votre banque.',
    a_traiter: 'Votre demande est bien enregistrée. Nous la traitons personnellement et vous serez remboursé en entier au plus tard 14 jours après la date ci-dessus.',
    hors_delai: 'Le délai de 14 jours suivant votre premier paiement est dépassé : votre abonnement n’a pas été modifié. Pour le résilier, utilisez « Gérer mon abonnement » dans votre compte ViraReel AI. Pour toute autre demande de remboursement, voir l’assistance de Link : ' + LIEN_LINK,
    hors_zone: 'Ce droit de renonciation de 14 jours s’applique aux consommateurs de l’Union européenne, de l’Espace économique européen et du Royaume-Uni. Votre abonnement n’a pas été modifié. Pour le résilier, utilisez « Gérer mon abonnement » dans votre compte ViraReel AI. Pour une demande de remboursement, voir l’assistance de Link : ' + LIEN_LINK,
    aucun_abonnement: 'Nous n’avons trouvé aucun abonnement actif associé à cette adresse. Si vous avez payé avec une autre adresse courriel, refaites la demande avec celle-ci, ou répondez à ce courriel.',
  } : {
    rembourse: 'Your subscription is cancelled and your payment is refunded in full. Link, our merchant of record, will also send you its own confirmation. The amount appears on your statement within 5 to 10 business days, depending on your bank.',
    a_traiter: 'Your request has been recorded. We are handling it personally and you will be refunded in full no later than 14 days after the date above.',
    hors_delai: 'The 14-day period following your first payment has ended, so your subscription has not been changed. To cancel it, use “Manage my subscription” in your ViraReel AI account. For any other refund request, see Link support: ' + LIEN_LINK,
    hors_zone: 'This 14-day right of withdrawal applies to consumers in the European Union, the European Economic Area and the United Kingdom. Your subscription has not been changed. To cancel it, use “Manage my subscription” in your ViraReel AI account. For a refund request, see Link support: ' + LIEN_LINK,
    aucun_abonnement: 'We found no active subscription for this email address. If you paid with a different email address, please send the request again with that one, or reply to this email.',
  };

  const sujet = fr
    ? 'Accusé de réception — renonciation au contrat ViraReel AI'
    : 'Acknowledgement of receipt — withdrawal from your ViraReel AI contract';

  const html = `
    <p>${fr ? 'Bonjour' : 'Hello'} ${echapper(p.nom)},</p>
    <p>${fr
      ? 'Nous accusons réception de votre demande de renonciation à votre contrat d’abonnement ViraReel AI.'
      : 'We acknowledge receipt of your request to withdraw from your ViraReel AI subscription contract.'}</p>
    <p>
      <strong>${fr ? 'Reçue le' : 'Received on'} :</strong> ${echapper(quand)}<br>
      <strong>${fr ? 'Nom' : 'Name'} :</strong> ${echapper(p.nom)}<br>
      <strong>${fr ? 'Courriel indiqué' : 'Email provided'} :</strong> ${echapper(p.courriel)}
    </p>
    <p>${echapper(suite[p.issue]).replace(/(https:\/\/[^\s]+)/g, '<a href="$1">$1</a>')}</p>
    <p>${fr ? 'Merci,' : 'Thank you,'}<br>ViraReel AI — hello@virareelai.com</p>
  `;
  return { sujet, html };
}
