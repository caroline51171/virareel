'use client';

import { useState } from 'react';
import { Translations, Lang } from '@/lib/i18n';

interface Props { t: Translations; lang: Lang }

export default function Pricing({ t, lang }: Props) {
  const [annual, setAnnual] = useState(false);
  const [loading, setLoading] = useState<string | null>(null);
  const p = t.pricing;

  const plans = [
    {
      key: 'free',
      data: p.plans.free,
      price: p.plans.free.price,
      priceAnnual: null,
      gradient: 'from-slate-700 to-slate-800',
      border: 'border-slate-600',
      btnGradient: 'from-slate-600 to-slate-700 hover:from-slate-500 hover:to-slate-600',
      popular: false,
    },
    {
      key: 'creator',
      data: p.plans.creator,
      price: '14,99$',
      priceAnnual: '129$',
      gradient: 'from-violet-600 to-purple-700',
      border: 'border-violet-400',
      btnGradient: 'from-white to-white hover:from-slate-100 hover:to-slate-100',
      btnText: 'text-violet-700',
      popular: true,
    },
    {
      key: 'pro',
      data: p.plans.pro,
      price: '29,99$',
      priceAnnual: '279$',
      gradient: 'from-pink-600 to-rose-700',
      border: 'border-pink-400',
      btnGradient: 'from-white to-white hover:from-slate-100 hover:to-slate-100',
      btnText: 'text-pink-700',
      popular: false,
    },
  ];

  const handleCheckout = async (planKey: string) => {
    if (planKey === 'free') {
      window.location.href = '#generator';
      return;
    }
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

          {/* Toggle */}
          <div className="inline-flex items-center gap-4 bg-slate-800 rounded-2xl p-2">
            <button
              onClick={() => setAnnual(false)}
              className={`px-5 py-2 rounded-xl font-semibold text-sm transition ${!annual ? 'bg-violet-600 text-white shadow' : 'text-slate-400 hover:text-white'}`}
            >
              {p.monthly}
            </button>
            <button
              onClick={() => setAnnual(true)}
              className={`px-5 py-2 rounded-xl font-semibold text-sm transition flex items-center gap-2 ${annual ? 'bg-violet-600 text-white shadow' : 'text-slate-400 hover:text-white'}`}
            >
              {p.annual}
              <span className="bg-green-500 text-white text-xs px-2 py-0.5 rounded-full">{p.save}</span>
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-stretch">
          {plans.map(plan => (
            <div
              key={plan.key}
              className={`relative bg-gradient-to-br ${plan.gradient} rounded-3xl p-6 md:p-7 border ${plan.border} shadow-2xl flex flex-col ${plan.popular ? 'md:scale-110 md:z-10 ring-2 ring-violet-400 ring-offset-2 ring-offset-slate-900' : ''}`}
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
                {plan.key === 'free' ? (
                  <div className="text-4xl font-black text-white">{'price' in plan.data ? plan.data.price : plan.price}</div>
                ) : (
                  <div>
                    <div className="text-4xl font-black text-white">
                      {annual && plan.priceAnnual ? plan.priceAnnual : plan.price}
                    </div>
                    <div className="text-white/60 text-sm">
                      {annual ? p.perYear : p.perMonth}
                    </div>
                  </div>
                )}
              </div>

              <ul className="space-y-3 mb-8 flex-1">
                {plan.data.features.map((f, i) => (
                  <li key={i} className="flex items-center gap-2 text-white text-sm">
                    <span className="text-green-400 font-bold flex-shrink-0">✓</span>
                    {f}
                  </li>
                ))}
              </ul>

              <button
                onClick={() => handleCheckout(plan.key)}
                disabled={loading === plan.key}
                className={`w-full text-center bg-gradient-to-r ${plan.btnGradient} ${plan.btnText || 'text-white'} font-bold py-4 rounded-xl transition shadow-lg min-h-[52px] flex items-center justify-center active:scale-95 disabled:opacity-70 cursor-pointer touch-manipulation`}
              >
                {loading === plan.key
                  ? '⏳ ...'
                  : plan.data.cta}
              </button>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
