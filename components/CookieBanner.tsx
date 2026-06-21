'use client';

import { useState, useEffect } from 'react';

const COOKIE_KEY = 'virareel-cookie-consent';

export default function CookieBanner({ lang }: { lang: string }) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!localStorage.getItem(COOKIE_KEY)) setVisible(true);
  }, []);

  const accept = () => {
    localStorage.setItem(COOKIE_KEY, '1');
    setVisible(false);
  };

  if (!visible) return null;

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 p-3 md:p-4">
      <div className="max-w-4xl mx-auto bg-slate-900 border border-violet-500/40 rounded-2xl px-4 py-4 md:px-6 md:py-5 flex flex-col sm:flex-row items-center gap-4 shadow-2xl">
        <div className="flex-1 text-center sm:text-left">
          <p className="text-slate-300 text-xs md:text-sm mb-2">
            {lang === 'fr'
              ? '🍪 Nous utilisons des cookies pour améliorer votre expérience.'
              : '🍪 We use cookies to improve your experience.'}
          </p>
          <div className="flex flex-wrap justify-center sm:justify-start gap-3">
            <a href="/cgv" className="text-violet-400 hover:text-violet-300 underline text-xs md:text-sm">
              {lang === 'fr' ? 'Conditions Générales de Vente' : 'Terms of Service'}
            </a>
            <span className="text-slate-600 text-xs">·</span>
            <a href="/privacy" className="text-violet-400 hover:text-violet-300 underline text-xs md:text-sm">
              {lang === 'fr' ? 'Politique de Confidentialité' : 'Privacy Policy'}
            </a>
          </div>
        </div>
        <button
          onClick={accept}
          className="shrink-0 bg-violet-600 hover:bg-violet-700 active:scale-95 text-white text-sm font-bold px-5 py-2.5 rounded-xl transition whitespace-nowrap"
        >
          {lang === 'fr' ? 'J\'accepte tout' : 'Accept all'}
        </button>
      </div>
    </div>
  );
}
