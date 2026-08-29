// Quelle langue afficher, vue du navigateur — SOURCE UNIQUE.
//
// Même règle partout : le choix manuel FR/EN mémorisé l'emporte, sinon la langue du
// navigateur. Utilisée par les fenêtres Clerk et par la politique de confidentialité,
// qui vivent hors de HomeClient et n'ont donc pas accès à son état.

export type Langue = 'fr' | 'en';

export const LANGUE_KEY = 'virareel-lang';

export function langueChoisie(): Langue {
  if (typeof window === 'undefined') return 'fr';
  try {
    const memorise = localStorage.getItem(LANGUE_KEY);
    if (memorise === 'fr' || memorise === 'en') return memorise;
  } catch {}
  return (navigator.language || 'fr').toLowerCase().startsWith('fr') ? 'fr' : 'en';
}
