// SOURCE UNIQUE de la règle « a-t-on le droit de mesurer cette personne ? ».
//
// Pourquoi ce fichier existe : jusqu'ici la réponse à la bannière vivait UNIQUEMENT
// dans le `localStorage` du navigateur. Tant que tous les événements partaient du
// navigateur, ça suffisait. Dès qu'une route serveur envoie un événement elle-même
// (Prospect depuis /api/capture-email, Paiement initié depuis /api/checkout), le
// serveur doit pouvoir répondre à la même question — sinon on enverrait à Meta
// quelqu'un qui a cliqué « Refuser », exactement ce que la Loi 25 interdit.
//
// D'où le cookie : la bannière écrit sa réponse à un endroit que les deux côtés
// lisent. Le `localStorage` reste, il ne change pas de rôle.
//
// ⚠️ Ce fichier doit rester SANS AUCUN import (comme lib/limits.ts) : c'est ce qui
// permet au navigateur et au serveur de lire les mêmes règles sans se coordonner.

export type Zone = 'consentement' | 'refus';

// Réponse à la bannière. '1' = accepté, '0' = refusé, null = pas encore répondu.
export type Reponse = '1' | '0' | null;

// Lu par le serveur dans les cookies de la requête, écrit par la bannière.
// Volontairement PAS `HttpOnly` : c'est le navigateur qui l'écrit.
export const CONSENT_COOKIE = 'virareel-consent';
export const CONSENT_COOKIE_MAX_AGE = 60 * 60 * 24 * 365; // 1 an

const EEE = [
  'AT', 'BE', 'BG', 'HR', 'CY', 'CZ', 'DK', 'EE', 'FI', 'FR', 'DE', 'GR', 'HU', 'IE',
  'IT', 'LV', 'LT', 'LU', 'MT', 'NL', 'PL', 'PT', 'RO', 'SK', 'SI', 'ES', 'SE',
  'IS', 'LI', 'NO',
];
const STRICT = new Set([...EEE, 'GB', 'CH', 'CA']);

// Langues des pays stricts : filet quand le pays est inconnu (proxy, VPN, réseau privé).
const LANGUES_STRICTES = /^(fr|de|it|nl|da|sv|nb|nn|no|fi|is|pl|cs|sk|sl|hu|ro|bg|hr|el|et|lv|lt|mt|pt|es|ga|en-gb|en-ca|en-ie)/i;

// Quel régime s'applique à cette connexion ? En cas de doute (pays inconnu), on
// choisit TOUJOURS le strict : mieux vaut ne pas mesurer un Américain que pister
// un Européen sans son accord.
export function zoneDepuisEnTetes(pays: string | null, langue: string | null): Zone {
  const code = (pays || '').toUpperCase();
  if (code) return STRICT.has(code) ? 'consentement' : 'refus';
  return LANGUES_STRICTES.test((langue || '').trim()) ? 'consentement' : 'refus';
}

// LA décision, écrite une seule fois. Le miroir exact de `mesureAutorisee()` dans
// lib/pixel.ts — les deux doivent répondre pareil, sinon le navigateur et le serveur
// se contrediraient sur la même personne.
//
// `gpc` = signal « ne me pistez pas » du navigateur. Côté serveur il arrive dans
// l'en-tête `Sec-GPC: 1` ; côté navigateur c'est `navigator.globalPrivacyControl`.
// La Californie et une vingtaine d'États obligent à le respecter — on le traite
// comme un refus, partout.
export function mesureAutoriseeAvec(reponse: Reponse, zone: Zone, gpc: boolean): boolean {
  if (gpc) return false;
  if (reponse === '0') return false;
  if (reponse === '1') return true;
  // Personne n'a encore répondu : seule la zone « refus » (US) démarre d'elle-même.
  return zone === 'refus';
}

// Raccourci serveur : tout lire depuis la requête d'un client. À n'utiliser QUE sur
// une requête venue du navigateur de la personne — un webhook Stripe, lui, n'a ni
// ses cookies ni ses en-têtes (voir lib/capi.ts).
export function mesureAutoriseeServeur(req: {
  headers: { get(nom: string): string | null };
  cookies: { get(nom: string): { value: string } | undefined };
}): boolean {
  const brut = req.cookies.get(CONSENT_COOKIE)?.value;
  const reponse: Reponse = brut === '1' || brut === '0' ? brut : null;
  const zone = zoneDepuisEnTetes(
    req.headers.get('x-vercel-ip-country'),
    req.headers.get('accept-language'),
  );
  return mesureAutoriseeAvec(reponse, zone, req.headers.get('sec-gpc') === '1');
}
