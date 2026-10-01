// Ouvre le portail client Stripe — SOURCE UNIQUE, côté navigateur.
// Utilisée par les boutons de l'espace client (components/History.tsx) et par le
// menu de la photo de profil (components/MenuCompte.tsx).
// 'gerer' = accueil du portail ; 'resilier' = directement l'écran d'annulation
// (bouton exigé au Québec, LPC art. 187.28 — voir app/api/portal).
export type ActionPortail = 'gerer' | 'resilier';

// Renvoie false si le portail n'a pas pu s'ouvrir (l'alerte est déjà affichée).
export async function ouvrirPortail(action: ActionPortail, lang: 'fr' | 'en'): Promise<boolean> {
  try {
    const res = await fetch('/api/portal', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action }),
    });
    const { url } = await res.json();
    if (url) { window.location.href = url; return true; }
  } catch {}
  alert(lang === 'fr' ? 'Le portail est indisponible pour le moment. Réessayez dans un instant.' : 'The portal is unavailable right now. Please try again in a moment.');
  return false;
}
