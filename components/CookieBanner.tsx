'use client';

import { useState, useEffect } from 'react';
import Icon from './Icon';

const COOKIE_KEY = 'virareel-cookie-consent';

export default function CookieBanner({ lang }: { lang: string }) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!localStorage.getItem(COOKIE_KEY)) setVisible(true);
  }, []);

  const close = (value: string) => {
    localStorage.setItem(COOKIE_KEY, value);
    setVisible(false);
  };

  if (!visible) return null;

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 bg-slate-950/90 backdrop-blur-sm border-t border-white/10">
      <div className="max-w-5xl mx-auto px-4 py-2 flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4">
        <p className="flex-1 text-slate-400 text-[11px] md:text-xs flex items-center gap-1.5 leading-snug">
          <Icon name="cookie" size={14} />
          <span>
            {lang === 'fr'
              ? 'Nous utilisons des cookies pour améliorer votre expérience.'
              : 'We use cookies to improve your experience.'}{' '}
            <a href="/cgv" className="text-slate-400 hover:text-slate-300 underline underline-offset-2">
              {lang === 'fr' ? 'Conditions Générales de Vente' : 'Terms of Service'}
            </a>
            {' · '}
            <a href="/privacy" className="text-slate-400 hover:text-slate-300 underline underline-offset-2">
              {lang === 'fr' ? 'Politique de Confidentialité' : 'Privacy Policy'}
            </a>
          </span>
        </p>
        <div className="flex shrink-0 gap-2">
          <button
            onClick={() => close('0')}
            className="flex-1 sm:flex-none border border-white/15 text-slate-300 hover:bg-white/5 text-xs font-semibold px-4 py-1.5 rounded-lg transition whitespace-nowrap"
          >
            {lang === 'fr' ? 'Refuser' : 'Decline'}
          </button>
          <button
            onClick={() => close('1')}
            className="flex-1 sm:flex-none border border-white/15 text-slate-300 hover:bg-white/5 text-xs font-semibold px-4 py-1.5 rounded-lg transition whitespace-nowrap"
          >
            {lang === 'fr' ? 'J\'accepte tout' : 'Accept all'}
          </button>
        </div>
      </div>
    </div>
  );
}
