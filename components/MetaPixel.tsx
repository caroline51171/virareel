'use client';

import { useEffect } from 'react';
import { CONSENT_EVENT, consentGiven, loadPixel } from '@/lib/pixel';

// Monté dans le layout, donc présent sur TOUTES les pages (accueil, connexion,
// succès Stripe). Il ne charge rien tant que la bannière n'a pas eu un « oui ».
export default function MetaPixel() {
  useEffect(() => {
    if (consentGiven()) loadPixel();
    const accepte = () => loadPixel();
    window.addEventListener(CONSENT_EVENT, accepte);
    return () => window.removeEventListener(CONSENT_EVENT, accepte);
  }, []);
  return null;
}
