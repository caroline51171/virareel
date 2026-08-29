'use client';

import { useEffect } from 'react';
import { CONSENT_EVENT, loadPixel, mesureAutorisee, Zone } from '@/lib/pixel';

// Monté dans le layout, donc présent sur TOUTES les pages (accueil, connexion,
// succès Stripe). Il ne décide rien lui-même : c'est le serveur qui dit dans quel
// régime de consentement se trouve la personne, et lib/pixel.ts qui tranche.
export default function MetaPixel() {
  useEffect(() => {
    let vivant = true;
    let zone: Zone | null = null;

    const decider = () => {
      if (vivant && mesureAutorisee(zone)) loadPixel();
    };

    // La zone vient du serveur (pays de la connexion) : le navigateur ne peut pas
    // la deviner honnêtement, et une erreur ici ferait pister un Européen.
    fetch('/api/zone')
      .then(r => r.json())
      .then((d: { zone: Zone }) => { zone = d.zone; decider(); })
      // Serveur injoignable → on ne mesure pas. Le régime strict est le défaut sûr.
      .catch(() => {});

    // Un « J'accepte » en cours de visite démarre le pixel sans recharger.
    window.addEventListener(CONSENT_EVENT, decider);
    return () => { vivant = false; window.removeEventListener(CONSENT_EVENT, decider); };
  }, []);

  return null;
}
