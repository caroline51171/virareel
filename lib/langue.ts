// Quelle langue afficher, vue du navigateur — SOURCE UNIQUE.
//
// Même règle partout : le choix manuel FR/EN mémorisé l'emporte, sinon la langue du
// navigateur. Utilisée par les fenêtres Clerk et par la politique de confidentialité,
// qui vivent hors de HomeClient et n'ont donc pas accès à son état.

export type Langue = 'fr' | 'en';

export const LANGUE_KEY = 'virareel-lang';

// Prévient ce qui vit hors de HomeClient (fenêtres Clerk) d'un changement FR/EN fait
// avec le bouton. Sans lui, la fenêtre de connexion gardait la langue du chargement :
// un visiteur passé en anglais s'inscrivait en français (vu par Jean le 09-27).
export const LANGUE_EVENT = 'virareel-langue';

export function memoriserLangue(l: Langue): void {
  try { localStorage.setItem(LANGUE_KEY, l); } catch {}
  window.dispatchEvent(new Event(LANGUE_EVENT));
}

export function langueChoisie(): Langue {
  if (typeof window === 'undefined') return 'fr';
  // Sur /en (lien des pubs anglaises), l'URL fait foi, même avec un navigateur en français.
  if (location.pathname === '/en' || location.pathname.startsWith('/en/')) return 'en';
  try {
    const memorise = localStorage.getItem(LANGUE_KEY);
    if (memorise === 'fr' || memorise === 'en') return memorise;
  } catch {}
  return (navigator.language || 'fr').toLowerCase().startsWith('fr') ? 'fr' : 'en';
}
