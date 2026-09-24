// D'OÙ VIENT CETTE PERSONNE ? — la « source » d'une inscription, pour l'onglet Performance d'/admin.
//
// Règle d'attribution (v1) : PREMIER passage marqué. Quand quelqu'un arrive avec des
// paramètres de campagne (utm_*, ou le `fbclid` que Meta ajoute à chaque clic de pub),
// on les garde dans un cookie de 90 jours, et on ne l'écrase JAMAIS ensuite. À
// l'inscription, ce cookie est recopié sur le compte Clerk : c'est lui qui suit la
// personne jusqu'au paiement. Pas de modèle multi-touch.
//
// Une visite directe (sans paramètre) n'écrit rien : la personne apparaît « sans UTM ».
//
// ⚠️ CONSENTEMENT : c'est de la mesure publicitaire. Même règle que le pixel Meta
// (lib/consentement.ts) : le cookie n'est écrit qu'avec l'accord de la personne là où
// la loi l'exige, et il est effacé par « Refuser » (lib/pixel.ts, revoquerPixel).
// Côté serveur, il n'est lu qu'après la même vérification (lib/journal.ts).
//
// Aucun import : lu par le navigateur ET par le serveur, et testé sans réseau.

export const ORIGINE_COOKIE = 'virareel-origine';
export const ORIGINE_MAX_AGE = 60 * 60 * 24 * 90; // 90 jours, comme le cookie _fbc de Meta

export interface Origine {
  utm_source?: string;
  utm_medium?: string;
  utm_campaign?: string;
  utm_content?: string;
  fbclid?: string;
  /** Première page vue, sans les paramètres (ex. « / » ou « /en »). */
  landing_path?: string;
  /** Moment de l'arrivée, ISO. */
  t?: string;
}

const UTM = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content'] as const;

// Un cookie est limité à ~4 Ko : on borne chaque valeur. Le fbclid de Meta fait
// environ 60 à 200 caractères.
function borner(v: string | null | undefined, max: number): string | undefined {
  const s = (v ?? '').trim();
  return s ? s.slice(0, max) : undefined;
}

/** Les paramètres de campagne d'une adresse, ou null s'il n'y en a aucun. */
export function origineDepuisUrl(href: string, maintenant = new Date()): Origine | null {
  let url: URL;
  try {
    url = new URL(href);
  } catch {
    return null;
  }
  const o: Origine = {};
  for (const cle of UTM) {
    const v = borner(url.searchParams.get(cle), 100);
    if (v) o[cle] = v;
  }
  const fbclid = borner(url.searchParams.get('fbclid'), 300);
  if (fbclid) o.fbclid = fbclid;
  if (Object.keys(o).length === 0) return null;
  o.landing_path = borner(url.pathname, 200) || '/';
  o.t = maintenant.toISOString();
  return o;
}

export function encoderOrigine(o: Origine): string {
  return encodeURIComponent(JSON.stringify(o));
}

/**
 * Relit un cookie (ou une métadonnée Clerk). Tout ce qui n'est pas une chaîne connue
 * est jeté : le cookie n'est pas signé, n'importe qui peut l'écrire, donc on ne lui
 * fait confiance que pour des étiquettes affichées dans l'admin, rien d'autre.
 */
export function decoderOrigine(brut: unknown): Origine | null {
  let v: unknown = brut;
  if (typeof brut === 'string') {
    try {
      v = JSON.parse(decodeURIComponent(brut));
    } catch {
      return null;
    }
  }
  if (!v || typeof v !== 'object') return null;
  const src = v as Record<string, unknown>;
  const o: Origine = {};
  for (const cle of [...UTM, 'fbclid', 'landing_path', 't'] as const) {
    const val = src[cle];
    if (typeof val === 'string' && val.trim()) o[cle] = val.trim().slice(0, cle === 'fbclid' ? 300 : 200);
  }
  return Object.keys(o).length ? o : null;
}
