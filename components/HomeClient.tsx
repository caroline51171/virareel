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
import Icon, { type IconName } from '@/components/Icon';
import { EMAIL_GATE_LIMIT, ANON_LIMIT } from '@/lib/limits';

// Les emoji drapeaux ne s'affichent pas sur Windows : on garde un code texte.
const REGIONS_FR: Record<string, { code: string; name: string }> = {
  'qc': { code: 'QC', name: 'Québec' },
  'fr': { code: 'FR', name: 'France' },
  'be': { code: 'BE', name: 'Belgique' },
  'other-fr': { code: 'Autre', name: 'Autre' },
};

const REGIONS_EN: Record<string, { code: string; name: string }> = {
  'us': { code: 'US', name: 'United States' },
  'uk': { code: 'UK', name: 'United Kingdom' },
  'au': { code: 'AU', name: 'Australia' },
  'ca-en': { code: 'CA', name: 'Canada' },
  'other-en': { code: 'Other', name: 'Other' },
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

// `initialLang` fixe la langue rendue côté serveur (ce que Google indexe pour cette URL).
// `autoDetect` = true sur la page racine « / » (on garde la détection navigateur/localStorage).
// `autoDetect` = false sur les pages localisées comme « /en » (la langue de l'URL fait foi).
export default function HomeClient({
  initialLang = 'fr',
  autoDetect = true,
}: {
  initialLang?: Lang;
  autoDetect?: boolean;
}) {
  const [lang, setLang] = useState<Lang>(initialLang);
  const [region, setRegion] = useState('');
  const [regionOpen, setRegionOpen] = useState(false);
  const [founder, setFounder] = useState<{ remaining: number; total: number; open: boolean } | null>(null);
  const [showCtaHint, setShowCtaHint] = useState(false);
  const { isSignedIn } = useAuth();

  // Main qui pointe le bouton « accéder au générateur » — 1re visite seulement
  useEffect(() => {
    if (!localStorage.getItem('virareel-cta-hint')) setShowCtaHint(true);
  }, []);
  const dismissCtaHint = () => {
    localStorage.setItem('virareel-cta-hint', '1');
    setShowCtaHint(false);
  };
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Essais restants sous le bouton du hero. La page est mise en cache et servie IDENTIQUE à
  // tout le monde (donc rapide) : le texte par défaut reste dans le HTML, et le vrai chiffre
  // le remplace une fraction de seconde plus tard, seulement pour qui a déjà entamé ses essais.
  const [anonLeft, setAnonLeft] = useState<{ remaining: number; emailGiven: boolean } | null>(null);
  // Au vrai zéro, le lien sous le bouton ouvre la fenêtre paywall du générateur : on incrémente
  // ce compteur, le générateur écoute. Un compteur (pas un booléen) pour pouvoir la rouvrir.
  const [paywallSignal, setPaywallSignal] = useState(0);
  useEffect(() => {
    if (isSignedIn) { setAnonLeft(null); return; }
    fetch('/api/anon-status')
      .then(r => r.json())
      .then(d => setAnonLeft({ remaining: d.remaining, emailGiven: d.emailGiven }))
      .catch(() => {});
  }, [isSignedIn]);

  // `pricing` = on ajoute un lien vers les forfaits, réservé au VRAI zéro (les 6 du courriel
  // sont eux aussi utilisés). Tant que le courriel n'a pas été donné, on annonce le bonus.
  const ctaSub: { text: string; pricing?: boolean } = (() => {
    // Rien reçu, ou compteur intact : on garde le texte de la page statique, aucun clignotement.
    if (!anonLeft || anonLeft.remaining === EMAIL_GATE_LIMIT) {
      return { text: translations[lang].hero.ctaSub };
    }
    const n = anonLeft.remaining;
    if (n > 0) {
      return {
        text: lang === 'fr'
          ? `${n} essai${n > 1 ? 's' : ''} gratuit${n > 1 ? 's' : ''} restant${n > 1 ? 's' : ''} — Sans courriel ni carte de crédit`
          : `${n} free trial${n > 1 ? 's' : ''} left — No email, no credit card`,
      };
    }
    if (!anonLeft.emailGiven) {
      const bonus = ANON_LIMIT - EMAIL_GATE_LIMIT;
      return {
        text: lang === 'fr'
          ? `${bonus} essais bonus — Avec votre courriel, sans carte de crédit`
          : `${bonus} bonus trials — Just your email, no credit card`,
      };
    }
    return {
      text: lang === 'fr' ? 'Vos essais gratuits sont utilisés.' : 'You’ve used your free trials.',
      pricing: true,
    };
  })();

  // Offre fondateur : pilote la barre d'annonce en haut + le décalage nav/hero
  useEffect(() => {
    fetch('/api/founder-status').then(r => r.json()).then(setFounder).catch(() => {});
  }, []);
  const founderOpen = founder?.open === true;

  useEffect(() => {
    // Forcer le retour en haut à chaque chargement (iOS restaure sinon la position précédente)
    if ('scrollRestoration' in history) history.scrollRestoration = 'manual';
    if (window.location.hash) {
      window.history.replaceState(null, '', window.location.pathname);
    }
    requestAnimationFrame(() => window.scrollTo(0, 0));

    const savedLang = localStorage.getItem('virareel-lang') as Lang | null;
    const savedRegion = localStorage.getItem('virareel-region');

    if (!autoDetect) {
      // Page localisée (ex. /en) : la langue de l'URL est prioritaire, on garde initialLang.
      if (savedRegion && savedLang === initialLang) {
        setRegion(savedRegion);
      } else {
        setRegion(detectRegion(initialLang === 'fr' ? 'fr-FR' : 'en-US'));
      }
    } else if (savedLang && savedRegion) {
      setLang(savedLang);
      setRegion(savedRegion);
    } else {
      const browserLang = navigator.language || 'fr';
      setLang(browserLang.startsWith('fr') ? 'fr' : 'en');
      setRegion(detectRegion(browserLang));
    }
  }, [autoDetect, initialLang]);

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
  const currentRegion = region
    ? regions[region]
    : { code: '', name: lang === 'fr' ? 'Région' : 'Region' };

  return (
    <div className="min-h-screen bg-slate-950 font-sans">
      {/* Barre d'annonce OFFRE FONDATEUR — tout en haut, cliquable → forfaits.
          N'apparaît que si l'offre est ouverte ; le nav et le hero se décalent en conséquence. */}
      {founderOpen && founder && (
        <a
          href="#pricing"
          className="fixed top-0 left-0 right-0 z-[60] h-9 flex items-center justify-center gap-1.5 px-2 bg-slate-800/70 text-amber-300 text-[9px] sm:text-xs font-bold text-center whitespace-nowrap overflow-hidden border-b border-amber-400/60 shadow-lg hover:brightness-110 transition"
        >
          <span className="border border-amber-400/60 text-amber-300 rounded-md px-1.5 py-0.5 text-[10px] sm:text-xs font-black tracking-wide shrink-0">PROMO</span>
          <span className="truncate">
            <span className="hidden sm:inline">{t.pricing.founder.launch} · </span>
            {t.pricing.founder.bar} · {t.pricing.founder.barSpots} · {t.pricing.founder.seeBelow}
          </span>
        </a>
      )}

      {/* Nav */}
      <nav className={`fixed ${founderOpen ? 'top-9' : 'top-0'} left-0 right-0 z-50 bg-slate-950/80 backdrop-blur border-b border-slate-800`}>
        {/* Marges SYMÉTRIQUES sous md (`px-3`) : avec `pl-2 pr-4` le logo était collé deux fois
            plus près du bord gauche que le bouton Connexion ne l'était du bord droit — la barre
            se lisait « de travers » sans qu'on sache pourquoi. */}
        <div className="max-w-6xl mx-auto px-3 md:px-4 py-3 flex items-center justify-between">
          {/* mr-3 : l'écart avec la pastille de région (QC) est une MARGE, pas un espace de texte.
              Un espace écrit à la fin du logo — ce qu'on avait fait au départ — est supprimé par le
              navigateur dès qu'un détail bouge dans la barre : il ne survit pas. */}
          <a href="#" className="text-xl md:text-2xl font-black bg-gradient-to-r from-violet-400 to-pink-400 bg-clip-text text-transparent whitespace-nowrap shrink-0 mr-2 md:mr-4">
            {t.nav.logo}
          </a>
          {/* `gap-1.5` sous md : avec le logo agrandi, chaque pixel repris ici part dans l'espace
              logo↔pastille (le conteneur est en justify-between). Mesuré, pas estimé. */}
          <div className="flex items-center gap-1.5 md:gap-3">
            <div className="hidden md:flex items-center gap-5">
              <a href="#pricing" className="text-slate-400 hover:text-white text-sm transition">{t.nav.pricing}</a>
            </div>

            {/* Sélecteur de région */}
            <div className="relative" ref={dropdownRef}>
              <button
                onClick={() => setRegionOpen(o => !o)}
                className="flex items-center gap-1 bg-slate-800 hover:bg-slate-700 border border-slate-600 text-white text-xs font-medium px-2 sm:px-2.5 py-1.5 rounded-full transition"
                title={lang === 'fr' ? 'Changer la région' : 'Change region'}
              >
                {/* Sur mobile la place manque dans le nav : le code pays porte seul
                    l'information (il a remplacé le drapeau), le Globe revient dès `sm`. */}
                <span className="hidden sm:inline-flex"><Icon name="globe" size={16} /></span>
                <span>{currentRegion.code}</span>
                {currentRegion.name !== currentRegion.code && (
                  <span className="hidden sm:inline text-slate-300">{currentRegion.name}</span>
                )}
                {/* Masqué sous `sm` comme le Globe : c'est ce qui fait tenir « Connexion »
                    dans la barre sur téléphone. La pastille reste évidemment cliquable. */}
                <span className="hidden sm:inline-flex text-slate-500"><Icon name="chevron-down" size={14} /></span>
              </button>
              {regionOpen && (
                <div className="absolute right-0 top-10 bg-slate-800 border border-slate-600 rounded-xl shadow-2xl z-50 min-w-[160px] overflow-hidden">
                  <div className="px-3 py-2 text-slate-400 text-xs border-b border-slate-700">
                    {lang === 'fr' ? 'Audience cible' : 'Target audience'}
                  </div>
                  {Object.entries(regions).map(([key, r]) => (
                    <button
                      key={key}
                      onClick={() => { setRegion(key); setRegionOpen(false); localStorage.setItem('virareel-lang', lang); localStorage.setItem('virareel-region', key); }}
                      className={`w-full text-left px-3 py-2.5 text-sm transition hover:bg-slate-700 ${region === key ? 'text-violet-400 font-semibold' : 'text-white'}`}
                    >
                      {r.code !== r.name && <span className="font-mono text-xs text-slate-400 mr-2">{r.code}</span>}
                      {r.name}
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
              className="flex items-center gap-1 sm:gap-1.5 bg-slate-800 hover:bg-slate-700 border border-slate-600 text-white text-sm font-bold px-2 sm:px-3 py-1.5 rounded-full transition"
            >
              {/* Comme le Globe du sélecteur de région : l'icône disparaît sous `sm`, où la
                  barre est pleine. « FR → EN » suffit à comprendre le bouton. */}
              <span className="hidden sm:inline-flex"><Icon name="languages" size={16} /></span>
              <span>{lang === 'fr' ? 'FR' : 'EN'}</span>
              <span className="text-slate-400 font-normal">→</span>
              <span>{lang === 'fr' ? 'EN' : 'FR'}</span>
            </button>

            {!isSignedIn ? (
              <SignInButton mode="modal">
                <button className="bg-transparent border border-violet-500 text-violet-300 hover:bg-violet-500/10 text-sm font-bold px-3 sm:px-4 py-1.5 rounded-full transition">
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
      <section className={`${founderOpen ? 'pt-28 md:pt-[108px]' : 'pt-24 md:pt-20'} pb-14 md:pb-20 px-4 bg-gradient-to-b from-slate-950 via-violet-950/20 to-slate-950`}>
        <div className="max-w-4xl mx-auto text-center">
          <div className="inline-flex items-center gap-2 bg-violet-600/20 border border-violet-500/30 text-violet-300 text-xs md:text-sm font-medium px-3 py-1.5 md:px-4 md:py-2 rounded-full mb-6 md:mb-8">
            {t.hero.badge}
          </div>

          <h1 className="text-3xl sm:text-4xl md:text-5xl font-black text-white leading-tight mb-5 md:mb-6">
            {t.hero.title}
            <br />
            <span className="bg-gradient-to-r from-violet-400 to-pink-400 bg-clip-text text-transparent whitespace-nowrap">
              {t.hero.titleGradient}
            </span>
            <br />
            {t.hero.titleEnd}
          </h1>

          <p className="text-slate-400 text-base md:text-xl max-w-2xl mx-auto mb-8 md:mb-8 leading-relaxed">
            {t.hero.subtitle}
          </p>

          <div className="flex flex-col items-center gap-3">
            <div className="relative w-full max-w-sm">
              {showCtaHint && (
                <span
                  aria-hidden
                  className="pointer-events-none absolute -top-8 right-1 z-10 select-none animate-point-bounce"
                >
                  <span
                    className="inline-block drop-shadow-[0_2px_4px_rgba(0,0,0,0.45)] text-white"
                    style={{ transform: 'scaleX(-1) rotate(-40deg)' }}
                  >
                    <Icon name="arrow-down" size={24} />
                  </span>
                </span>
              )}
              <a
                href="#generator"
                onClick={dismissCtaHint}
                className="w-full bg-violet-600 hover:bg-violet-700 active:scale-95 text-white font-black text-base md:text-lg px-8 py-4 rounded-2xl transition shadow-2xl shadow-violet-500/25 min-h-[52px] flex items-center justify-center"
              >
                {t.hero.cta}
              </a>
            </div>
            <p className="text-slate-500 text-xs md:text-sm">
              {ctaSub.text}
              {ctaSub.pricing && (
                <>
                  {' '}
                  {/* Ouvre LA fenêtre paywall du générateur (texte unique) au lieu de laisser
                      le visiteur seul devant la grille de prix. */}
                  <button
                    type="button"
                    onClick={() => setPaywallSignal(s => s + 1)}
                    className="text-violet-400 hover:text-violet-300 underline underline-offset-2 cursor-pointer"
                  >
                    {lang === 'fr' ? 'Voir les forfaits' : 'See the plans'}
                  </button>
                </>
              )}
            </p>
          </div>

          <div className="flex justify-center gap-3 mt-8 flex-wrap">
            {([
              { icon: 'instagram', label: 'Instagram Reels' },
              { icon: 'tiktok', label: 'TikTok' },
              { icon: 'facebook', label: 'Facebook Reels' },
              { icon: 'youtube', label: 'YouTube Shorts' },
            ] as { icon: IconName; label: string }[]).map(p => (
              <div key={p.label} className="bg-slate-800/60 border border-slate-700 text-slate-300 text-xs md:text-sm px-3 py-1.5 md:px-4 md:py-2 rounded-full font-medium flex items-center gap-2">
                <Icon name={p.icon} size={16} />
                {p.label}
              </div>
            ))}
          </div>

          <div className="mt-6 md:mt-6 flex flex-wrap justify-center gap-4">
            {[
              lang === 'fr' ? '12 essais inclus sans engagement' : '12 trials included, no commitment',
              lang === 'fr' ? 'Adapté pour 1 ou 4 plateformes au choix' : 'Works for 1 or all 4 platforms',
              lang === 'fr' ? 'Génération instantanée en quelques secondes' : 'Instant generation in seconds',
            ].map(item => (
              <div key={item} className="text-slate-400 text-xs md:text-sm font-medium flex items-center gap-1.5">
                <Icon name="check" size={16} />
                {item}
              </div>
            ))}
          </div>
        </div>
      </section>

      <Generator t={t} lang={lang} region={region} openPaywallSignal={paywallSignal} />
      <History lang={lang} />
      <Pricing t={t} lang={lang} />
      {/* <Referral t={t} /> */}

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
            {lang === 'fr' ? 'Conditions Générales de Vente' : 'Terms of Service'}
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
