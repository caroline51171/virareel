// Pixel Meta (Facebook / Instagram) — « ViraReel AI », identifiant 1626458592332640.
//
// Il ne se charge JAMAIS tout seul : la bannière de cookies décide. Tant que la
// personne n'a pas dit oui, aucune requête ne part vers Facebook. C'est la loi 25
// au Québec, et sans ça notre propre bannière deviendrait mensongère.
//
// Les événements suivis (décidés avec Caroline) :
//   PageView         — chaque page
//   Lead             — courriel donné dans la fenêtre des 6 essais bonus
//   InitiateCheckout — clic sur un forfait (avant la page de paiement Stripe)
//   Purchase         — page de succès, avec le montant réellement facturé, en CAD

export const META_PIXEL_ID = '1626458592332640';
export const CONSENT_KEY = 'virareel-cookie-consent';
// Émis par la bannière quand la personne accepte : le pixel démarre sans recharger.
export const CONSENT_EVENT = 'virareel:consentement';

type Fbq = ((...args: unknown[]) => void) & { queue?: unknown[]; loaded?: boolean; version?: string; push?: unknown; callMethod?: (...a: unknown[]) => void };

declare global {
  interface Window { fbq?: Fbq; _fbq?: Fbq }
}

export function consentGiven(): boolean {
  try {
    return localStorage.getItem(CONSENT_KEY) === '1';
  } catch {
    return false;
  }
}

// Le chargeur officiel de Meta, recopié tel quel, puis init + PageView.
export function loadPixel(): void {
  if (typeof window === 'undefined' || window.fbq) return;
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
  n('track', 'PageView');
}

// Silencieux si le pixel n'est pas chargé (consentement refusé) : suivre quelqu'un
// qui a dit non serait exactement ce qu'on veut éviter.
export function trackPixel(event: string, params?: Record<string, unknown>): void {
  if (typeof window === 'undefined' || !window.fbq) return;
  window.fbq('track', event, params);
}
