'use client';

import { useState, useEffect } from 'react';
import { Translations, Lang } from '@/lib/i18n';

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
      gradient: 'from-slate-600 to-slate-700',
      border: 'border-slate-400',
      btnGradient: 'from-white to-white hover:from-slate-100 hover:to-slate-100',
      btnText: 'text-slate-700',
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
      gradient: 'from-violet-600 to-purple-700',
      border: 'border-violet-400',
      btnGradient: 'from-white to-white hover:from-slate-100 hover:to-slate-100',
      btnText: 'text-violet-700',
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
      gradient: 'from-pink-600 to-rose-700',
      border: 'border-pink-400',
      btnGradient: 'from-white to-white hover:from-slate-100 hover:to-slate-100',
      btnText: 'text-pink-700',
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
            <div className="mb-8 mx-auto max-w-2xl rounded-2xl border-2 border-amber-400 bg-gradient-to-r from-amber-500/20 via-orange-500/20 to-rose-500/20 px-5 py-4 shadow-lg animate-fadeIn">
              <p className="text-amber-300 font-black text-lg md:text-xl">{f.banner}</p>
              <p className="text-white/90 text-sm md:text-base mt-1">{f.bannerSub}</p>
              <div className="mt-3 inline-flex items-center gap-2 rounded-full bg-slate-900/70 border border-amber-400/50 px-4 py-1.5">
                <span className="text-amber-300 font-black text-base">{founder.remaining}/{founder.total}</span>
                <span className="text-white/80 text-sm">{f.spots}</span>
                {founder.remaining <= 10 && <span className="text-rose-300 font-bold text-sm">· {f.lastSpots}</span>}
              </div>
            </div>
          )}

          {/* Toggle mensuel / annuel — interrupteur segmenté : la pastille blanche = option choisie */}
          <div className="inline-flex items-center gap-1 bg-orange-500 rounded-2xl p-1.5">
            <button
              onClick={() => setAnnual(false)}
              aria-pressed={!annual}
              className={`px-7 py-3 rounded-xl font-bold text-base transition ${!annual ? 'bg-white text-orange-600 shadow-lg' : 'text-white/80 hover:text-white'}`}
            >
              {p.monthly}
            </button>
            <button
              onClick={() => setAnnual(true)}
              aria-pressed={annual}
              className={`px-7 py-3 rounded-xl font-bold text-base transition flex items-center gap-2 ${annual ? 'bg-white text-orange-600 shadow-lg' : 'text-white/80 hover:text-white'}`}
            >
              {p.annual}
              <span className="bg-green-500 text-white text-xs px-2.5 py-1 rounded-lg font-bold">{p.save}</span>
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-stretch">
          {plans.map(plan => (
            <div
              key={plan.key}
              className={`relative bg-gradient-to-br ${plan.gradient} rounded-3xl p-6 md:p-8 border ${plan.border} shadow-2xl flex flex-col`}
            >
              {plan.popular && (plan.data as typeof p.plans.creator).badge && (
                <div className="absolute -top-4 left-1/2 -translate-x-1/2 bg-yellow-400 text-yellow-900 font-black text-sm px-4 py-1 rounded-full shadow">
                  {(plan.data as typeof p.plans.creator).badge}
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
                    <div className="mt-2 inline-block rounded-full bg-rose-500 text-white text-xs font-black px-3 py-1 shadow">
                      🔥 {f.tag} · −{plan.founderPct}% {f.lifetime}
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
                    <span className="text-green-400 font-bold flex-shrink-0">✓</span>
                    {feat}
                  </li>
                ))}
              </ul>

              <button
                onClick={() => handleCheckout(plan.key)}
                disabled={loading === plan.key}
                className={`w-full text-center bg-gradient-to-r ${plan.btnGradient} ${plan.btnText || 'text-white'} font-bold py-4 rounded-xl transition shadow-lg min-h-[52px] flex items-center justify-center active:scale-95 disabled:opacity-70 cursor-pointer touch-manipulation`}
              >
                {loading === plan.key ? '⏳ ...' : (isFounder ? f.cta : plan.data.cta)}
              </button>
              {isFounder && founder && (
                <p className="text-center text-amber-300 text-xs font-semibold mt-2">
                  ⏳ {founder.remaining}/{founder.total} {f.spots}
                </p>
              )}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
