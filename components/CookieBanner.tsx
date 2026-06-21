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
      <div className="max-w-4xl mx-auto bg-slate-900 border border-violet-500/40 rounded-2xl px-4 py-3 md:px-6 md:py-4 flex flex-col sm:flex-row items-center gap-3 shadow-2xl">
        <p className="text-slate-300 text-xs md:text-sm text-center sm:text-left flex-1">
          {lang === 'fr'
            ? <>🍪 Ce site utilise des cookies pour fonctionner (authentification, paiements, préférences). En continuant, vous acceptez notre <a href="/privacy" className="text-violet-400 hover:text-violet-300 underline">politique de confidentialité</a>.</>
            : <>🍪 This site uses cookies to function (authentication, payments, preferences). By continuing, you agree to our <a href="/privacy" className="text-violet-400 hover:text-violet-300 underline">privacy policy</a>.</>
          }
        </p>
        <button
          onClick={accept}
          className="shrink-0 bg-violet-600 hover:bg-violet-700 active:scale-95 text-white text-sm font-bold px-5 py-2.5 rounded-xl transition"
        >
          {lang === 'fr' ? 'J\'accepte' : 'Accept'}
        </button>
      </div>
    </div>
  );
}
