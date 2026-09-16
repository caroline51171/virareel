// ─── Achat : l'identité du client voyage du clic jusqu'au webhook Stripe ───────
//
// L'Achat part du webhook Stripe (fiable même si la page de succès ne charge pas),
// mais le webhook ne connaît rien du client : ni son IP, ni son navigateur, ni les
// cookies du pixel. Meta n'avait que le courriel → qualité d'appariement 3,2/10.
//
// /api/checkout, lui, est appelé PAR LE NAVIGATEUR du client au clic sur un forfait :
// il copie ces valeurs dans les métadonnées de la session Stripe, que le webhook relit.
//
// Et le CONSENTEMENT voyage avec : avant, le webhook envoyait l'Achat à Meta même pour
// quelqu'un qui avait cliqué « Refuser » (il ne pouvait pas le savoir). Désormais
// `mesure: '0'` → rien n'est envoyé. Une session créée avant ce changement n'a pas la
// clé : on garde alors l'ancien comportement.
//
// Aucun import : fonctions pures, testées (capiAchat.test.ts).

export interface IdentiteClient {
  clientIp?: string;
  clientUserAgent?: string;
  fbp?: string;
  fbc?: string;
}

// Stripe : 500 caractères max par valeur de métadonnée.
const court = (v?: string) => (v ? v.slice(0, 500) : undefined);

export function metadataAchat(identite: IdentiteClient, mesureAutorisee: boolean): Record<string, string> {
  if (!mesureAutorisee) return { mesure: '0' };
  const m: Record<string, string> = { mesure: '1' };
  const ip = court(identite.clientIp);
  const ua = court(identite.clientUserAgent);
  const fbp = court(identite.fbp);
  const fbc = court(identite.fbc);
  if (ip) m.capi_ip = ip;
  if (ua) m.capi_ua = ua;
  if (fbp) m.capi_fbp = fbp;
  if (fbc) m.capi_fbc = fbc;
  return m;
}

export function achatDepuisMetadata(meta: Record<string, string> | null | undefined): {
  envoyer: boolean;
  identite: IdentiteClient;
} {
  const m = meta || {};
  return {
    envoyer: m.mesure !== '0',
    identite: {
      clientIp: m.capi_ip || undefined,
      clientUserAgent: m.capi_ua || undefined,
      fbp: m.capi_fbp || undefined,
      fbc: m.capi_fbc || undefined,
    },
  };
}
