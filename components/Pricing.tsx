'use client';

import { useState, useEffect } from 'react';
import { Translations, Lang } from '@/lib/i18n';
import Icon from './Icon';

interface Props { t: Translations; lang: Lang }

interface FounderStatus { total: number; claimed: number; remaining: number; open: boolean }

export default function Pricing({ t, lang }: Props) {
  const [annual, setAnnual] = useState(false);
  const [loading, setLoading] = useState<string | null>(null);
  const [founder, setFounder] = useState<FounderStatus | null>(null);
  const p = t.pricing;
  const f = p.founder;

  // État de l'offre fondateur (compteur de places réel, compté dans Stripe)
  useEffect(() => {
    fetch('/api/founder-status')
      .then(r => r.json())
      .then(setFounder)
      .catch(() => {});
  }, []);

  const isFounder = founder?.open === true;

  const plans = [
    {
      key: 'solo',
      data: p.plans.solo,
      price: '$12',
      priceAnnual: '$115',
      founderPrice: '$8',
      founderPriceAnnual: '$96',
      founderPct: 33,
      gradient: 'from-violet-600 to-purple-700',
      border: 'border-violet-400',
      btnGradient: 'from-white to-white hover:from-slate-100 hover:to-slate-100',
      btnText: 'text-violet-700',
      popular: false,
    },
    {
      key: 'creator',
      data: p.plans.creator,
      price: '$19',
      priceAnnual: '$182',
      founderPrice: '$14',
      founderPriceAnnual: '$168',
      founderPct: 26,
      gradient: 'from-pink-600 to-rose-700',
      border: 'border-pink-400',
      btnGradient: 'from-white to-white hover:from-slate-100 hover:to-slate-100',
      btnText: 'text-pink-700',
      popular: true,
    },
    {
      key: 'pro',
      data: p.plans.pro,
      price: '$129',
      priceAnnual: '$1238',
      founderPrice: '$89',
      founderPriceAnnual: '$1068',
      founderPct: 31,
      popular: false,
    },
  ];

  const handleCheckout = async (planKey: string) => {
    setLoading(planKey);
    try {
      const res = await fetch('/api/checkout', {
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
      alert(lang === 'fr' ? 'Erreur. Réessaie !' : 'Error. Please try again!');
    } finally {
      setLoading(null);
    }
  };

  return (
    <section id="pricing" className="py-24 px-4 bg-gradient-to-b from-slate-900 to-slate-950">
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
              <p className="text-white/90 text-sm mt-1">{f.bannerSub}</p>
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

          {/* Toggle mensuel / annuel — interrupteur segmenté : la pastille blanche = option choisie */}
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
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-stretch">
          {plans.map(plan => (
            <div
              key={plan.key}
              className={`relative bg-slate-800/70 rounded-3xl p-6 md:p-8 shadow-2xl flex flex-col ${plan.popular ? 'border-2 border-pink-400/80' : 'border border-slate-700'}`}
            >
              {plan.popular && (plan.data as typeof p.plans.creator).badge && (
                <div className="absolute -top-4 left-1/2 -translate-x-1/2 bg-pink-500/15 border border-pink-400/40 text-pink-200 font-bold text-sm px-4 py-1 rounded-full backdrop-blur-sm">
                  <span className="inline-flex items-center gap-1.5">
                    <Icon name={(plan.data as typeof p.plans.creator).badgeIcon} size={16} />
                    {(plan.data as typeof p.plans.creator).badge}
                  </span>
                </div>
              )}

              <div className="mb-6">
                <div className="text-white font-black text-2xl mb-1">{plan.data.name}</div>
                <div className="text-white/70 text-sm">{plan.data.desc}</div>
              </div>

              <div className="mb-6">
                {isFounder ? (
                  <>
                    <div className="flex items-end gap-2 flex-wrap">
                      <span className="text-white/50 text-2xl font-bold line-through" title={f.was}>
                        {annual ? plan.priceAnnual : plan.price}
                      </span>
                      <span className="text-4xl md:text-5xl font-black text-white">
                        {annual ? plan.founderPriceAnnual : plan.founderPrice}
                      </span>
                      <span className="text-white/60 text-sm mb-1.5">{annual ? p.perYear : p.perMonth}</span>
                    </div>
                    <div className="mt-2 inline-block rounded-full border border-amber-400/60 text-amber-300 text-xs font-bold px-3 py-1">
                      {f.tag} · −{plan.founderPct}{lang === 'fr' ? ' ' : ''}%
                    </div>
                  </>
                ) : (
                  <>
                    <div className="text-4xl font-black text-white">
                      {annual && plan.priceAnnual ? plan.priceAnnual : plan.price}
                    </div>
                    <div className="text-white/60 text-sm">
                      {annual ? p.perYear : p.perMonth}
                    </div>
                  </>
                )}
              </div>

              <ul className="space-y-3 mb-8 flex-1">
                {plan.data.features.map((feat, i) => (
                  <li key={i} className="flex items-center gap-2 text-white text-sm">
                    <span className="text-slate-300 flex-shrink-0"><Icon name="check" size={16} /></span>
                    {feat}
                  </li>
                ))}
              </ul>

              <button
                onClick={() => handleCheckout(plan.key)}
                disabled={loading === plan.key}
                className={`w-full text-center font-bold py-4 rounded-xl transition shadow-lg min-h-[52px] flex items-center justify-center active:scale-95 disabled:opacity-70 cursor-pointer touch-manipulation text-white ${plan.popular ? 'bg-gradient-to-r from-violet-600 to-pink-600 hover:from-violet-700 hover:to-pink-700' : 'bg-transparent border border-white/40 hover:bg-white/10'}`}
              >
                {loading === plan.key
                  ? <span className="inline-flex items-center gap-2"><Icon name="loader" size={20} className="animate-spin" /> ...</span>
                  : (isFounder ? f.cta : plan.data.cta)}
              </button>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
