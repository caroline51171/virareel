'use client';

import { useSearchParams } from 'next/navigation';
import { Suspense } from 'react';
import Icon from '@/components/Icon';

function SuccessContent() {
  const params = useSearchParams();
  const plan = params.get('plan') || 'creator';

  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center px-4">
      <div className="text-center max-w-md">
        {/* L'emoji faisait 8xl : l'icone garde une taille normalisee (24)
            et c'est la pastille qui donne la presence visuelle. */}
        <div className="mb-6 flex justify-center">
          <span className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-violet-500/15 text-violet-300">
            <Icon name="party-popper" size={24} />
          </span>
        </div>
        <h1 className="text-3xl font-black text-white mb-4">
          Bienvenue dans ViraReel {plan === 'pro' ? 'Agency' : plan === 'solo' ? 'Solo' : 'Creator'} !
        </h1>
        <p className="text-slate-400 mb-8">
          L&apos;abonnement est actif. Jusqu&apos;à {plan === 'pro' ? '1000' : plan === 'solo' ? '60' : '160'} scripts par mois, dès maintenant !
        </p>
        <a
          href="/"
          className="bg-gradient-to-r from-violet-600 to-pink-600 text-white font-bold py-4 px-8 rounded-2xl inline-flex items-center gap-2"
        >
          <Icon name="rocket" size={20} />
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
