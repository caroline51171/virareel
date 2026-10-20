'use client';

import { useEffect } from 'react';

// Compte UNE visite par session d'onglet (voir lib/visites.ts) : aucun témoin, juste un
// drapeau sessionStorage qui disparaît à la fermeture de l'onglet. Monté une fois dans
// le layout, il ne se relance pas quand on change de page dans le site.
export default function CompteurVisites() {
  useEffect(() => {
    if (window.location.pathname.startsWith('/admin')) return;
    try {
      if (sessionStorage.getItem('vr_visite')) return;
      sessionStorage.setItem('vr_visite', '1');
    } catch {
      // Stockage bloqué (navigation privée stricte) : on compte quand même.
    }
    const params = new URLSearchParams(window.location.search);
    const corps = JSON.stringify({
      ref: document.referrer,
      utm: params.get('utm_source') ?? '',
      fb: params.has('fbclid'),
    });
    try {
      const envoye = navigator.sendBeacon?.('/api/visite', new Blob([corps], { type: 'application/json' }));
      if (!envoye) fetch('/api/visite', { method: 'POST', body: corps, keepalive: true }).catch(() => {});
    } catch {
      // Jamais d'erreur visible pour une statistique.
    }
  }, []);
  return null;
}
