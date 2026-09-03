'use client';

import { useSearchParams } from 'next/navigation';
import { Suspense, useEffect } from 'react';
import { CURRENCY } from '@/lib/pricing';
import { trackPixel } from '@/lib/pixel';

function SuccessContent() {
  const params = useSearchParams();
  const plan = params.get('plan') || 'creator';
  // Montant RÉELLEMENT facturé, transmis par Stripe via l'adresse de retour : il tient
  // compte du prix fondateur et du forfait annuel, qu'on ne pourrait pas deviner ici.
  const montant = Number(params.get('v'));
  // Id de la session Stripe : partagé avec l'Achat que le webhook envoie déjà côté
  // serveur (fiable même si cette page ne charge jamais). Même id des deux côtés =
  // Meta ne compte qu'un seul achat.
  const sid = params.get('sid') || undefined;
  useEffect(() => {
    trackPixel('Purchase', {
      value: montant > 0 ? montant : undefined,
      currency: CURRENCY,
      content_name: plan,
      eventId: sid,
    });
  }, [montant, plan, sid]);

  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center px-4">
      <div className="text-center max-w-md">
        <div className="mb-6 flex justify-center">
          <svg width="80" height="80" viewBox="0 0 80 80">
            <defs>
              <radialGradient id="mist" cx="50%" cy="50%" r="50%">
                <stop offset="0" stopColor="#8b5cf6" stopOpacity="0.28" />
                <stop offset="1" stopColor="#8b5cf6" stopOpacity="0.06" />
              </radialGradient>
              <filter id="glow" x="-50%" y="-50%" width="200%" height="200%">
                <feGaussianBlur stdDeviation="2.5" />
              </filter>
              <filter id="soft" x="-50%" y="-50%" width="200%" height="200%">
                <feGaussianBlur stdDeviation="0.8" />
              </filter>
            </defs>
            <circle cx="40" cy="40" r="40" fill="url(#mist)" />
            <path d="M23 23 L40 57 L57 23" fill="none" stroke="#c4b5fd" strokeWidth="6.5" strokeLinecap="round" strokeLinejoin="round" opacity="0.25" filter="url(#glow)" />
            <path d="M23 23 L40 57 L57 23" fill="none" stroke="#e9d5ff" strokeWidth="6" strokeLinecap="round" strokeLinejoin="round" opacity="0.4" filter="url(#soft)" />
          </svg>
        </div>
        <h1 className="text-3xl font-black text-white mb-4">
          Bienvenue dans ViraReel&nbsp;AI {plan === 'pro' ? 'Agency' : plan === 'solo' ? 'Solo' : 'Creator'} !
        </h1>
        <p className="text-slate-400 mb-8">
          L&apos;abonnement est actif. Jusqu&apos;à {plan === 'pro' ? '1000' : plan === 'solo' ? '60' : '160'} scripts par mois, dès maintenant !
        </p>
        <a
          href="/"
          className="bg-gradient-to-r from-violet-600 to-pink-600 text-white font-bold py-4 px-8 rounded-2xl inline-flex items-center gap-2"
        >
          Commencer à créer
        </a>
      </div>
    </div>
  );
}

export default function SuccessPage() {
  return (
    <Suspense>
      <SuccessContent />
    </Suspense>
  );
}
