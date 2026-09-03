'use client';

import { useState, useEffect, useRef } from 'react';
import { useUser, useClerk } from '@clerk/nextjs';
import { Translations, Lang } from '@/lib/i18n';
import { trackPixel } from '@/lib/pixel';
import { PRICING_BY_KEY, formatPrice, ANNUAL_ENABLED } from '@/lib/pricing';
import Icon from './Icon';

interface Props { t: Translations; lang: Lang }

interface FounderStatus { total: number; claimed: number; remaining: number; open: boolean }

export default function Pricing({ t, lang }: Props) {
  const { user } = useUser();
  const { openSignUp } = useClerk();
  const [annual, setAnnual] = useState(false);
  const [loading, setLoading] = useState<string | null>(null);
  const [founder, setFounder] = useState<FounderStatus | null>(null);
  const [currentPlan, setCurrentPlan] = useState<string | null>(null);
  const [choisi, setChoisi] = useState<string | null>(null);
  // Forfait mis en attente le temps de l-inscription : reprend le paiement TOUTE
  // SEULE, un clic. Sans compte, /api/checkout refuse desormais (verrou serveur,
  // trouve en test le 09-03 : un paiement pouvait aboutir sans personne pour le recevoir).
  const [enAttente, setEnAttente] = useState<{ plan: string; a: number } | null>(null);
  const DELAI_ATTENTE = 5 * 60 * 1000;
  const p = t.pricing;
  const f = p.founder;

  // État de l'offre fondateur (compteur de places réel, compté dans Stripe)
  useEffect(() => {
    fetch('/api/founder-status')
      .then(r => r.json())
      .then(setFounder)
      .catch(() => {});
  }, []);

  // Forfait déjà actif : un clic sur une carte doit alors passer par le portail
  // Stripe (changement de forfait), pas créer un 2e abonnement via /api/checkout.
  useEffect(() => {
    if (!user) { setCurrentPlan(null); return; }
    fetch('/api/user/stats')
      .then(r => r.json())
      .then(s => setCurrentPlan(s.plan))
      .catch(() => {});
  }, [user]);

  // Carte entiere cliquable. Sur telephone le bouton tombe sous le pli : des gens
  // cliquaient la carte, rien ne se passait, et ils repartaient en croyant que le
  // forfait ne fonctionnait pas. Le bouton reste, il ne change pas de place.
  const departClic = useRef<{ x: number; y: number } | null>(null);
  const boutons = useRef<Record<string, HTMLButtonElement | null>>({});

  // Un clic sur la carte ne PAIE PAS : il selectionne, et amene le bouton a l-ecran.
  // Partir droit au paiement etait trop brutal, et un clic accidentel coute cher.
  const clicCarte = (e: React.MouseEvent, planKey: string) => {
    if ((e.target as HTMLElement).closest('button')) return;
    // Un glissement du doigt pour defiler, ou une selection de texte, n-est pas un choix.
    const d = departClic.current;
    if (d && Math.hypot(e.clientX - d.x, e.clientY - d.y) > 10) return;
    if (window.getSelection()?.toString()) return;
    setChoisi(planKey);

    // Le bouton doit etre visible des la selection, telephone comme ordinateur.
    // On ne bouge la page que s-il ne l-est pas deja, sinon elle sauterait pour rien.
    const bouton = boutons.current[planKey];
    if (!bouton) return;
    requestAnimationFrame(() => {
      const r = bouton.getBoundingClientRect();
      // L-en-tete colle recouvre le haut : on garde 100 px de marge en haut et en bas.
      const visible = r.top >= 100 && r.bottom <= window.innerHeight - 20;
      // window.scrollTo plutot que scrollIntoView : c-est la methode deja eprouvee
      // partout ailleurs sur le site (Generator.tsx).
      if (!visible) {
        window.scrollTo({ top: r.bottom + window.scrollY - window.innerHeight + 24, behavior: 'smooth' });
      }
    });
  };

  const isFounder = founder?.open === true;

  // Prix/pourcentages DÉRIVÉS de lib/pricing.ts (source de vérité unique) —
  // aucune valeur monétaire en dur ici. Seuls restent les réglages visuels.
  const plans = [
    {
      key: 'solo',
      data: p.plans.solo,
      gradient: 'from-violet-600 to-purple-700',
      border: 'border-violet-400',
      btnGradient: 'from-white to-white hover:from-slate-100 hover:to-slate-100',
      btnText: 'text-violet-700',
      popular: false,
    },
    {
      key: 'creator',
      data: p.plans.creator,
      gradient: 'from-pink-600 to-rose-700',
      border: 'border-pink-400',
      btnGradient: 'from-white to-white hover:from-slate-100 hover:to-slate-100',
      btnText: 'text-pink-700',
      popular: true,
    },
    {
      key: 'pro',
      data: p.plans.pro,
      popular: false,
    },
  ];

  // Reprend le paiement des que l-inscription se termine - sauf si trop de temps
  // a passe (delai depasse : la personne reclique elle-meme, rien ne part par surprise).
  useEffect(() => {
    if (user && enAttente) {
      const { plan, a } = enAttente;
      setEnAttente(null);
      if (Date.now() - a < DELAI_ATTENTE) handleCheckout(plan);
    }
  }, [user]);

  const handleCheckout = async (planKey: string) => {
    if (!user) { setEnAttente({ plan: planKey, a: Date.now() }); openSignUp(); return; }
    setLoading(planKey);
    try {
      const alreadySubscribed = currentPlan === 'solo' || currentPlan === 'creator' || currentPlan === 'pro';
      // Pas d'événement pour un changement de forfait : ce n'est pas une nouvelle vente.
      if (!alreadySubscribed) trackPixel('InitiateCheckout', { content_name: planKey, currency: 'CAD' });
      const res = await fetch(alreadySubscribed ? '/api/portal' : '/api/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          plan: planKey,
          billing: annual ? 'annual' : 'monthly',
          lang,
        }),
      });
      const data = await res.json();
      if (data.url) window.location.href = data.url;
    } catch {
      alert(lang === 'fr' ? 'Erreur. Réessayez !' : 'Error. Please try again!');
    } finally {
      setLoading(null);
    }
  };

  return (
    <section id="pricing" className="scroll-mt-28 py-24 px-4 bg-gradient-to-b from-slate-900 to-slate-950">
      <div className="max-w-6xl mx-auto">
        <div className="text-center mb-12">
          <h2 className="text-3xl md:text-4xl font-black text-white mb-3">{p.title}</h2>
          <p className="text-slate-400 mb-8">{p.subtitle}</p>

          {/* Bandeau OFFRE FONDATEUR — bien visible : les gens achètent l'offre, pas le prix */}
          {isFounder && founder && (
            <div className="mb-8 mx-auto max-w-2xl rounded-2xl border border-amber-400/60 bg-slate-800/70 px-4 py-3 shadow-lg animate-fadeIn">
              <p className="text-amber-300 font-black text-base md:text-lg flex items-center justify-center gap-2">
                <Icon name="flame" size={20} className="animate-flame" />
                {f.banner}
              </p>
              <p className="text-white/90 text-sm mt-1 text-balance">{f.bannerSub}</p>
              <div className="mt-2 inline-flex items-center gap-2 rounded-full border border-amber-400/60 px-3 py-1">
                <span className="text-amber-300 font-bold text-sm">{f.spotsOnly}</span>
                {founder.remaining <= 10 && (
                  <span className="text-amber-300 font-bold text-xs inline-flex items-center gap-1">
                    · <Icon name={f.lastSpotsIcon} size={16} /> {f.lastSpots}
                  </span>
                )}
              </div>
            </div>
          )}

          {/* Toggle mensuel / annuel — interrupteur segmenté : la pastille blanche = option choisie.
              Masqué tant que ANNUAL_ENABLED === false (chemin annuel non validé). Réversible via le flag. */}
          {ANNUAL_ENABLED && (
            <div className="inline-flex items-center gap-1 bg-transparent border border-white/25 rounded-2xl p-1.5">
              <button
                onClick={() => setAnnual(false)}
                aria-pressed={!annual}
                className={`px-7 py-3 rounded-xl font-bold text-base transition ${!annual ? 'bg-white/15 text-white shadow' : 'text-slate-400 hover:text-white'}`}
              >
                {p.monthly}
              </button>
              <button
                onClick={() => setAnnual(true)}
                aria-pressed={annual}
                className={`px-7 py-3 rounded-xl font-bold text-base transition flex items-center gap-2 ${annual ? 'bg-white/15 text-white shadow' : 'text-slate-400 hover:text-white'}`}
              >
                {p.annual}
                <span className="bg-transparent border border-green-400 text-green-400 text-xs px-2.5 py-1 rounded-lg font-bold">{p.save}</span>
              </button>
            </div>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-stretch">
          {plans.map(plan => {
            const px = PRICING_BY_KEY[plan.key];
            const priceNow = formatPrice(annual ? px.annualPublic : px.monthlyPublic);
            const founderNow = formatPrice(annual ? px.annualFounder : px.monthlyFounder);
            return (
            <div
              key={plan.key}
              onPointerDown={e => { departClic.current = { x: e.clientX, y: e.clientY }; }}
              onClick={e => clicCarte(e, plan.key)}
              className={`relative bg-slate-800/70 rounded-3xl p-6 shadow-2xl flex flex-col cursor-pointer transition ${plan.popular ? 'border-2 border-pink-400/80' : 'border border-slate-700'} ${choisi === plan.key ? 'ring-2 ring-violet-400' : ''}`}
            >
              {plan.popular && (plan.data as typeof p.plans.creator).badge && (
                <div className="absolute -top-4 left-1/2 -translate-x-1/2 bg-pink-500/15 border border-pink-400/40 text-pink-200 font-bold text-sm px-4 py-1 rounded-full backdrop-blur-sm">
                  <span className="inline-flex items-center gap-1.5">
                    <Icon name={(plan.data as typeof p.plans.creator).badgeIcon} size={16} />
                    {(plan.data as typeof p.plans.creator).badge}
                  </span>
                </div>
              )}

              <div className="mb-6 md:mb-4">
                <div className="text-white font-black text-2xl mb-1">{plan.data.name}</div>
                <div className="text-white/70 text-sm">{plan.data.desc}</div>
              </div>

              <div className="mb-6 md:mb-4">
                {isFounder ? (
                  <>
                    <div className="flex items-end gap-2 flex-wrap">
                      <span className="text-white/50 text-2xl font-bold line-through" title={f.was}>
                        {priceNow}
                      </span>
                      <span className="text-4xl md:text-5xl font-black text-white">
                        {founderNow}
                      </span>
                      <span className="text-white/40 text-sm mb-1.5">CAD</span>
                      <span className="text-white/60 text-sm mb-1.5">{annual ? p.perYear : p.perMonth}</span>
                    </div>
                    <div className="mt-2 inline-block rounded-full border border-amber-400/60 text-amber-300 text-xs font-bold px-3 py-1">
                      {f.tag} · −{px.founderPct}{lang === 'fr' ? ' ' : ''}%
                    </div>
                    <p className="mt-1.5 text-white/40 text-xs">{f.notice}</p>
                  </>
                ) : (
                  <>
                    <div className="flex items-end gap-2 flex-wrap">
                      <span className="text-4xl font-black text-white">
                        {priceNow}
                      </span>
                      <span className="text-white/40 text-sm mb-0.5">CAD</span>
                      <span className="text-white/60 text-sm mb-0.5">
                        {annual ? p.perYear : p.perMonth}
                      </span>
                    </div>
                  </>
                )}
              </div>

              <ul className="space-y-3 md:space-y-2 mb-8 md:mb-6 flex-1">
                {plan.data.features.map((feat, i) => (
                  <li key={i} className="flex items-center gap-2 text-white text-sm">
                    <span className="text-slate-300 flex-shrink-0"><Icon name="check" size={16} /></span>
                    {feat}
                  </li>
                ))}
              </ul>

              <button
                ref={el => { boutons.current[plan.key] = el; }}
                onClick={() => handleCheckout(plan.key)}
                disabled={loading === plan.key}
                className={`w-full text-center font-bold py-4 rounded-xl transition shadow-lg min-h-[52px] flex items-center justify-center active:scale-95 disabled:opacity-70 cursor-pointer touch-manipulation text-white ${plan.popular ? 'bg-gradient-to-r from-violet-600 to-pink-600 hover:from-violet-700 hover:to-pink-700' : 'bg-transparent border border-white/40 hover:bg-white/10'}`}
              >
                {loading === plan.key
                  ? <span className="inline-flex items-center gap-2"><Icon name="loader" size={20} className="animate-spin" /> ...</span>
                  : (isFounder ? f.cta : plan.data.cta)}
              </button>
            </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
