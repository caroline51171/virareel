'use client';

import { useState, useEffect, useRef } from 'react';
import { translations, Lang } from '@/lib/i18n';
import Generator from '@/components/Generator';
import Pricing from '@/components/Pricing';
import Referral from '@/components/Referral';
import History from '@/components/History';
import Contact from '@/components/Contact';
import FAQ from '@/components/FAQ';
import { SignInButton, UserButton, useAuth } from '@clerk/nextjs';
import CookieBanner from '@/components/CookieBanner';

const REGIONS_FR: Record<string, string> = {
  'qc': '🇨🇦 Québec',
  'fr': '🇫🇷 France',
  'be': '🇧🇪 Belgique',
  'other-fr': '🌍 Autre',
};

const REGIONS_EN: Record<string, string> = {
  'us': '🇺🇸 United States',
  'uk': '🇬🇧 United Kingdom',
  'au': '🇦🇺 Australia',
  'ca-en': '🇨🇦 Canada',
  'other-en': '🌍 Other',
};

function detectRegion(browserLang: string): string {
  const l = browserLang.toLowerCase();
  if (l === 'fr-ca' || l.startsWith('fr-ca')) return 'qc';
  if (l === 'fr-be' || l.startsWith('fr-be')) return 'be';
  if (l === 'fr-fr' || l === 'fr') return 'fr';
  if (l.startsWith('fr')) return 'other-fr';
  if (l === 'en-gb' || l.startsWith('en-gb')) return 'uk';
  if (l === 'en-au' || l.startsWith('en-au')) return 'au';
  if (l === 'en-ca' || l.startsWith('en-ca')) return 'ca-en';
  if (l.startsWith('en')) return 'us';
  return '';
}

export default function Home() {
  const [lang, setLang] = useState<Lang>('fr');
  const [region, setRegion] = useState('');
  const [regionOpen, setRegionOpen] = useState(false);
  const { isSignedIn } = useAuth();
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Forcer le retour en haut à chaque chargement (iOS restaure sinon la position précédente)
    if ('scrollRestoration' in history) history.scrollRestoration = 'manual';
    if (window.location.hash) {
      window.history.replaceState(null, '', window.location.pathname);
    }
    requestAnimationFrame(() => window.scrollTo(0, 0));

    const savedLang = localStorage.getItem('virareel-lang') as Lang | null;
    const savedRegion = localStorage.getItem('virareel-region');
    if (savedLang && savedRegion) {
      setLang(savedLang);
      setRegion(savedRegion);
    } else {
      const browserLang = navigator.language || 'fr';
      setLang(browserLang.startsWith('fr') ? 'fr' : 'en');
      setRegion(detectRegion(browserLang));
    }
  }, []);

  // Ferme le dropdown si on clique ailleurs
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setRegionOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const t = translations[lang];
  const regions = lang === 'fr' ? REGIONS_FR : REGIONS_EN;
  const currentRegionLabel = region ? regions[region] : (lang === 'fr' ? '🌍 Région' : '🌍 Region');

  return (
    <div className="min-h-screen bg-slate-950 font-sans">
      {/* Nav */}
      <nav className="fixed top-0 left-0 right-0 z-50 bg-slate-950/80 backdrop-blur border-b border-slate-800">
        <div className="max-w-6xl mx-auto pl-2 pr-4 md:px-4 py-3 flex items-center justify-between">
          <a href="#" className="text-lg md:text-xl font-black bg-gradient-to-r from-violet-400 to-pink-400 bg-clip-text text-transparent whitespace-nowrap shrink-0">
            {t.nav.logo}{'  '}
          </a>
          <div className="flex items-center gap-2 md:gap-3">
            <div className="hidden md:flex items-center gap-5">
              <a href="#pricing" className="text-slate-400 hover:text-white text-sm transition">{t.nav.pricing}</a>
              <a href="#referral" className="text-slate-400 hover:text-white text-sm transition">{t.nav.referral}</a>
            </div>

            {/* Sélecteur de région */}
            <div className="relative" ref={dropdownRef}>
              <button
                onClick={() => setRegionOpen(o => !o)}
                className="flex items-center gap-1 bg-slate-800 hover:bg-slate-700 border border-slate-600 text-white text-xs font-medium px-2.5 py-1.5 rounded-full transition"
                title={lang === 'fr' ? 'Changer la région' : 'Change region'}
              >
                <span>{currentRegionLabel.split(' ')[0]}</span>
                <span className="hidden sm:inline text-slate-300">{currentRegionLabel.split(' ').slice(1).join(' ')}</span>
                <span className="text-slate-500 text-xs">▾</span>
              </button>
              {regionOpen && (
                <div className="absolute right-0 top-10 bg-slate-800 border border-slate-600 rounded-xl shadow-2xl z-50 min-w-[160px] overflow-hidden">
                  <div className="px-3 py-2 text-slate-400 text-xs border-b border-slate-700">
                    {lang === 'fr' ? 'Audience cible' : 'Target audience'}
                  </div>
                  {Object.entries(regions).map(([key, label]) => (
                    <button
                      key={key}
                      onClick={() => { setRegion(key); setRegionOpen(false); localStorage.setItem('virareel-lang', lang); localStorage.setItem('virareel-region', key); }}
                      className={`w-full text-left px-3 py-2.5 text-sm transition hover:bg-slate-700 ${region === key ? 'text-violet-400 font-semibold' : 'text-white'}`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Toggle FR/EN */}
            <button
              onClick={() => {
                const newLang = lang === 'fr' ? 'en' : 'fr';
                const newRegion = detectRegion(newLang === 'fr' ? 'fr-FR' : 'en-US');
                setLang(newLang);
                setRegion(newRegion);
                localStorage.setItem('virareel-lang', newLang);
                localStorage.setItem('virareel-region', newRegion);
              }}
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
            {t.hero.title}
            <br />
            <span className="bg-gradient-to-r from-violet-400 via-pink-400 to-orange-400 bg-clip-text text-transparent whitespace-nowrap">
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
            {['📸 Instagram Reels', '🎵 TikTok', '👥 Facebook Reels', '▶️ YouTube Shorts'].map(p => (
              <div key={p} className="bg-slate-800/60 border border-slate-700 text-slate-300 text-xs md:text-sm px-3 py-1.5 md:px-4 md:py-2 rounded-full font-medium">
                {p}
              </div>
            ))}
          </div>

          <div className="mt-8 md:mt-10 flex flex-wrap justify-center gap-4 md:gap-6">
            {[
              lang === 'fr' ? '✓ 12 générations gratuites sans carte' : '✓ 12 free generations, no card required',
              lang === 'fr' ? '✓ 4 plateformes supportées' : '✓ 4 platforms supported',
              lang === 'fr' ? '✓ Résultats en quelques secondes' : '✓ Results in seconds',
            ].map(item => (
              <div key={item} className="text-slate-400 text-xs md:text-sm font-medium">
                {item}
              </div>
            ))}
          </div>
        </div>
      </section>

      <Generator t={t} lang={lang} region={region} />
      <History lang={lang} />
      <Pricing t={t} lang={lang} />
      <Referral t={t} />

      <FAQ lang={lang} />

      <Contact lang={lang} />

      <CookieBanner lang={lang} />

      <footer className="border-t border-slate-800 py-10 px-4 text-center">
        <div className="text-xl font-black bg-gradient-to-r from-violet-400 to-pink-400 bg-clip-text text-transparent mb-2">
          ViraReel AI
        </div>
        <p className="text-slate-500 text-sm mb-1">{t.footer.tagline}</p>
        <p className="text-slate-600 text-xs mb-3">{t.footer.rights}</p>
        <div className="flex items-center justify-center gap-4 mt-1">
          <a href="/cgv" className="text-slate-600 hover:text-slate-400 text-xs transition">
            {lang === 'fr' ? 'Conditions Générales de Vente' : 'Terms of Service'}
          </a>
          <span className="text-slate-700">·</span>
          <a href="/privacy" className="text-slate-600 hover:text-slate-400 text-xs transition">
            {lang === 'fr' ? 'Politique de Confidentialité' : 'Privacy Policy'}
          </a>
        </div>
      </footer>
    </div>
  );
}
