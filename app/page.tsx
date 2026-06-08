'use client';

import { useState, useEffect } from 'react';
import { translations, Lang } from '@/lib/i18n';
import Generator from '@/components/Generator';
import Pricing from '@/components/Pricing';
import Referral from '@/components/Referral';
import { SignInButton, UserButton, useAuth } from '@clerk/nextjs';

export default function Home() {
  const [lang, setLang] = useState<Lang>('fr');
  const { isSignedIn } = useAuth();

  useEffect(() => {
    // Détecte la langue du navigateur automatiquement
    const browserLang = navigator.language || 'fr';
    setLang(browserLang.startsWith('fr') ? 'fr' : 'en');
  }, []);
  const t = translations[lang];

  return (
    <div className="min-h-screen bg-slate-950 font-sans">
      {/* Nav */}
      <nav className="fixed top-0 left-0 right-0 z-50 bg-slate-950/80 backdrop-blur border-b border-slate-800">
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between">
          <a href="#" className="text-xl font-black bg-gradient-to-r from-violet-400 to-pink-400 bg-clip-text text-transparent">
            {t.nav.logo}
          </a>
          <div className="flex items-center gap-6">
            <div className="hidden md:flex items-center gap-5">
              <a href="#generator" className="text-slate-400 hover:text-white text-sm transition">{t.nav.pricing}</a>
              <a href="#pricing" className="text-slate-400 hover:text-white text-sm transition">{t.nav.dashboard}</a>
              <a href="#referral" className="text-slate-400 hover:text-white text-sm transition">{t.nav.referral}</a>
            </div>
            <button
              onClick={() => setLang(l => l === 'fr' ? 'en' : 'fr')}
              className="flex items-center gap-1.5 bg-slate-800 hover:bg-slate-700 border border-slate-600 text-white text-sm font-bold px-3 py-1.5 rounded-full transition"
            >
              <span>{lang === 'fr' ? '🇫🇷' : '🇬🇧'}</span>
              <span>{lang === 'fr' ? 'FR' : 'EN'}</span>
              <span className="text-slate-400 font-normal">→</span>
              <span>{lang === 'fr' ? 'EN' : 'FR'}</span>
            </button>
            {!isSignedIn ? (
              <SignInButton mode="modal">
                <button className="bg-violet-600 hover:bg-violet-700 text-white text-sm font-bold px-4 py-1.5 rounded-full transition">
                  {lang === 'fr' ? 'Connexion' : 'Sign in'}
                </button>
              </SignInButton>
            ) : (
              <UserButton />
            )}
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="pt-24 pb-14 md:pt-28 md:pb-20 px-4 bg-gradient-to-b from-slate-950 via-violet-950/20 to-slate-950">
        <div className="max-w-4xl mx-auto text-center">
          <div className="inline-flex items-center gap-2 bg-violet-600/20 border border-violet-500/30 text-violet-300 text-xs md:text-sm font-medium px-3 py-1.5 md:px-4 md:py-2 rounded-full mb-6 md:mb-8">
            {t.hero.badge}
          </div>

          <h1 className="text-3xl sm:text-5xl md:text-7xl font-black text-white leading-tight mb-5 md:mb-6">
            {t.hero.title}{' '}
            <span className="bg-gradient-to-r from-violet-400 via-pink-400 to-orange-400 bg-clip-text text-transparent">
              {t.hero.titleGradient}
            </span>
            <br />
            {t.hero.titleEnd}
          </h1>

          <p className="text-slate-400 text-base md:text-xl max-w-2xl mx-auto mb-8 md:mb-10 leading-relaxed">
            {t.hero.subtitle}
          </p>

          <div className="flex flex-col items-center gap-3">
            <a
              href="#generator"
              className="w-full max-w-sm bg-gradient-to-r from-violet-600 to-pink-600 hover:from-violet-700 hover:to-pink-700 active:scale-95 text-white font-black text-base md:text-lg px-8 py-4 rounded-2xl transition shadow-2xl shadow-violet-500/25 min-h-[52px] flex items-center justify-center"
            >
              {t.hero.cta}
            </a>
            <p className="text-slate-500 text-xs md:text-sm">{t.hero.ctaSub}</p>
          </div>

          <div className="flex justify-center gap-3 mt-10 flex-wrap">
            {['📸 Instagram Reels', '🎵 TikTok', '👥 Facebook Reels'].map(p => (
              <div key={p} className="bg-slate-800/60 border border-slate-700 text-slate-300 text-xs md:text-sm px-3 py-1.5 md:px-4 md:py-2 rounded-full font-medium">
                {p}
              </div>
            ))}
          </div>

          <div className="mt-8 md:mt-10 flex flex-wrap justify-center gap-6 md:gap-8 text-center">
            {[
              { n: '10 000+', label: lang === 'fr' ? 'Reels générés' : 'Reels generated' },
              { n: '4.9★', label: lang === 'fr' ? 'Note moyenne' : 'Average rating' },
              { n: '2 500+', label: lang === 'fr' ? 'Créateurs actifs' : 'Active creators' },
            ].map(s => (
              <div key={s.n}>
                <div className="text-xl md:text-2xl font-black text-white">{s.n}</div>
                <div className="text-slate-500 text-xs md:text-sm">{s.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <Generator t={t} lang={lang} />
      <Pricing t={t} lang={lang} />
      <Referral t={t} />

      <footer className="border-t border-slate-800 py-10 px-4 text-center">
        <div className="text-xl font-black bg-gradient-to-r from-violet-400 to-pink-400 bg-clip-text text-transparent mb-2">
          ViraReel
        </div>
        <p className="text-slate-500 text-sm mb-1">{t.footer.tagline}</p>
        <p className="text-slate-600 text-xs">{t.footer.rights}</p>
      </footer>
    </div>
  );
}
