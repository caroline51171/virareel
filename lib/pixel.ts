// Pixel Meta (Facebook / Instagram) — « ViraReel AI », identifiant 1785155322920407.
//
// DEUX RÉGIMES, décidés par le serveur (voir app/api/zone/route.ts) :
//
//   'consentement' — Canada/Québec, Europe, UK, Suisse. RIEN ne part avant
//                    « J'accepte tout ». Loi 25 et RGPD l'exigent.
//   'refus'        — États-Unis et le reste. La mesure démarre au chargement et
//                    s'arrête NET si la personne clique « Refuser ».
//
// La bannière s'affiche partout, dans les deux cas : seul le moment où la mesure
// commence change. Un « Refuser » vaut refus définitif dans les deux régimes.
//
// Signal GPC : les navigateurs des personnes qui ont activé « ne me pistez pas »
// envoient `navigator.globalPrivacyControl`. La Californie et une vingtaine d'États
// obligent à le respecter — on le traite exactement comme un refus, partout.
//
// Événements suivis : PageView · Lead (courriel donné) · InitiateCheckout (clic sur
// un forfait, jamais un changement de forfait) · Purchase (montant réel + CAD).
// Chacun part DEUX fois — navigateur et serveur — avec le MÊME identifiant, pour que
// Meta n'en compte qu'un (voir app/api/capi/route.ts).

export const META_PIXEL_ID = '1785155322920407';
export const CONSENT_KEY = 'virareel-cookie-consent';
// Émis par la bannière : le pixel démarre ou s'arrête sans recharger la page.
export const CONSENT_EVENT = 'virareel:consentement';

export type Zone = 'consentement' | 'refus';

type Fbq = ((...args: unknown[]) => void) & {
  queue?: unknown[]; loaded?: boolean; version?: string; push?: unknown;
  callMethod?: (...a: unknown[]) => void;
};

declare global {
  interface Window { fbq?: Fbq; _fbq?: Fbq }
  interface Navigator { globalPrivacyControl?: boolean }
}

// Coupe-circuit : une fois à `true`, plus rien ne part, ni navigateur ni serveur.
let refuse = false;

function reponseBanniere(): '1' | '0' | null {
  try {
    const v = localStorage.getItem(CONSENT_KEY);
    return v === '1' || v === '0' ? v : null;
  } catch {
    return null;
  }
}

export function gpcActif(): boolean {
  return typeof navigator !== 'undefined' && navigator.globalPrivacyControl === true;
}

// A-t-on le droit de mesurer cette personne, maintenant ?
export function mesureAutorisee(zone: Zone | null): boolean {
  if (refuse || gpcActif()) return false;
  const rep = reponseBanniere();
  if (rep === '0') return false;
  if (rep === '1') return true;
  // Personne n'a encore répondu : seule la zone « refus » (US) démarre d'elle-même.
  return zone === 'refus';
}

// Le chargeur officiel de Meta, puis init + PageView (dédupliqué avec le serveur).
export function loadPixel(): void {
  if (typeof window === 'undefined' || refuse || window.fbq) return;
  const f = window as Window & typeof globalThis;
  const n: Fbq = function (...args: unknown[]) {
    n.callMethod ? n.callMethod(...args) : n.queue!.push(args);
  } as Fbq;
  n.queue = [];
  n.loaded = true;
  n.version = '2.0';
  n.push = n;
  f.fbq = n;
  f._fbq = n;
  const s = document.createElement('script');
  s.async = true;
  s.src = 'https://connect.facebook.net/en_US/fbevents.js';
  document.head.appendChild(s);
  n('init', META_PIXEL_ID);
  trackPixel('PageView');
}

// « Refuser » : on ne se contente pas de cacher la bannière. Meta reçoit l'ordre de
// révocation, ses deux cookies sont effacés, et le coupe-circuit ferme aussi la
// porte du serveur — sinon le refus ne vaudrait rien pour quelqu'un qui a déjà
// chargé le pixel (le cas normal aux États-Unis).
export function revoquerPixel(): void {
  refuse = true;
  if (typeof window === 'undefined') return;
  try {
    window.fbq?.('consent', 'revoke');
  } catch {}
  for (const c of ['_fbp', '_fbc']) {
    document.cookie = `${c}=; Max-Age=0; path=/`;
    document.cookie = `${c}=; Max-Age=0; path=/; domain=.${location.hostname.replace(/^www\./, '')}`;
  }
}

function lireCookie(nom: string): string | undefined {
  if (typeof document === 'undefined') return undefined;
  return document.cookie.split('; ').find(c => c.startsWith(nom + '='))?.split('=')[1];
}

interface Options {
  value?: number;
  currency?: string;
  // Courriel en clair transmis à NOTRE serveur seulement, qui n'en envoie que
  // l'empreinte à Meta. Jamais mis dans l'appel du navigateur.
  email?: string;
  [k: string]: unknown;
}

// Silencieux si le pixel n'est pas chargé (refus, ou consentement pas encore donné) :
// suivre quelqu'un qui a dit non serait exactement ce qu'on veut éviter.
export function trackPixel(event: string, opts: Options = {}): void {
  if (typeof window === 'undefined' || refuse || !window.fbq) return;

  const { email, ...params } = opts;
  // Le même identifiant des deux côtés = Meta ne compte l'événement qu'une fois.
  const eventId = (globalThis.crypto?.randomUUID?.() ?? String(Date.now() + Math.random()));

  window.fbq('track', event, params, { eventID: eventId });

  // Jumeau serveur. `keepalive` pour qu'il parte même si la page change tout de suite
  // après (c'est exactement le cas du clic vers Stripe).
  try {
    fetch('/api/capi', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      keepalive: true,
      body: JSON.stringify({
        event,
        eventId,
        url: location.href,
        value: params.value,
        currency: params.currency,
        email,
        fbp: lireCookie('_fbp'),
        fbc: lireCookie('_fbc'),
      }),
    }).catch(() => {});
  } catch {}
}
