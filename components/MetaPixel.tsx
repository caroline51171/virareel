'use client';

import { useEffect } from 'react';
import { useUser } from '@clerk/nextjs';
import { CONSENT_EVENT, loadPixel, mesureAutorisee, trackPixel, Zone } from '@/lib/pixel';

// Monté dans le layout, donc présent sur TOUTES les pages (accueil, connexion,
// succès Stripe). Il ne décide rien lui-même : c'est le serveur qui dit dans quel
// régime de consentement se trouve la personne, et lib/pixel.ts qui tranche.
// Un compte cree il y a moins de 10 minutes est une inscription. Sans cette borne,
// une personne inscrite depuis des mois enverrait un Lead a sa prochaine visite.
const FENETRE_INSCRIPTION = 10 * 60 * 1000;
const LEAD_KEY = 'virareel-lead-inscription';

export default function MetaPixel() {
  const { user, isLoaded } = useUser();

  // Lead a l-INSCRIPTION, quelle que soit la porte d-entree (courriel + mot de passe
  // ou Google). Avant, Lead ne partait que de la fenetre du courriel du generateur :
  // quelqu-un qui arrivait par une pub et creait un compte directement - le meilleur
  // prospect des deux - n-etait jamais compte, et Meta optimisait sur une moitie
  // seulement des vrais interesses.
  useEffect(() => {
    if (!isLoaded || !user) return;
    if (Date.now() - new Date(user.createdAt ?? 0).getTime() > FENETRE_INSCRIPTION) return;
    try {
      if (localStorage.getItem(LEAD_KEY) === user.id) return;
      localStorage.setItem(LEAD_KEY, user.id);
    } catch {}

    // Le pixel peut ne pas encore etre charge (il attend la reponse de /api/zone et
    // le consentement) : trackPixel serait alors silencieux et le Lead perdu. On
    // reessaie quelques secondes, puis on abandonne - un refus reste un refus.
    let restant = 10;
    const envoyer = () => {
      if (window.fbq) {
        trackPixel('Lead', { email: user.primaryEmailAddress?.emailAddress });
        return;
      }
      if (--restant > 0) minuterie = window.setTimeout(envoyer, 500);
    };
    let minuterie = window.setTimeout(envoyer, 0);
    return () => window.clearTimeout(minuterie);
  }, [isLoaded, user]);

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
