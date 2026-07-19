'use client';

import { useSearchParams } from 'next/navigation';
import { Suspense } from 'react';

function SuccessContent() {
  const params = useSearchParams();
  const plan = params.get('plan') || 'creator';

  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center px-4">
      <div className="text-center max-w-md">
        <div className="text-8xl mb-6">🎉</div>
        <h1 className="text-3xl font-black text-white mb-4">
          Bienvenue dans ViraReel {plan === 'pro' ? 'Pro' : 'Creator'} !
        </h1>
        <p className="text-slate-400 mb-8">
          L&apos;abonnement est actif. Jusqu&apos;à {plan === 'pro' ? '600' : '160'} scripts par mois, dès maintenant !
        </p>
        <a
          href="/"
          className="bg-gradient-to-r from-violet-600 to-pink-600 text-white font-bold py-4 px-8 rounded-2xl inline-block"
        >
          🚀 Commencer à créer
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
