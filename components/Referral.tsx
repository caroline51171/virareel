'use client';

import { useState, useEffect } from 'react';
import { Translations } from '@/lib/i18n';
import { copyText } from '@/lib/clipboard';
import Icon from './Icon';

interface Props { t: Translations }

function generateRefCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 8; i++) code += chars[Math.floor(Math.random() * chars.length)];
  return code;
}

export default function Referral({ t }: Props) {
  const [refCode, setRefCode] = useState('');
  const [copied, setCopied] = useState(false);
  const r = t.referral;

  const [refLink, setRefLink] = useState('');

  useEffect(() => {
    let code = localStorage.getItem('virareel_refcode');
    if (!code) {
      code = generateRefCode();
      localStorage.setItem('virareel_refcode', code);
    }
    setRefCode(code);
    setRefLink(`${window.location.origin}?ref=${code}`);
  }, []);

  // Demo stats stored locally
  const [stats] = useState({ referred: 3, converted: 1, earned: 1 });

  const copyLink = async () => {
    await copyText(refLink);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <section id="referral" className="py-14 md:py-24 px-4 bg-gradient-to-b from-slate-950 to-slate-900">
      <div className="max-w-4xl mx-auto">
        <div className="text-center mb-8 md:mb-12">
          <h2 className="text-2xl md:text-4xl font-black text-white mb-3 flex items-center justify-center gap-2">
            <Icon name={r.titleIcon} size={24} />
            {r.title}
          </h2>
          <p className="text-slate-400 text-sm md:text-base">{r.subtitle}</p>
        </div>

        {/* How it works */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8 md:mb-12">
          {r.steps.map((step, i) => (
            <div key={i} className="bg-slate-800/60 border border-slate-700 rounded-2xl p-5 md:p-6 flex md:flex-col items-center md:text-center gap-4 md:gap-0">
              <div className="md:mb-3 flex-shrink-0 text-violet-300"><Icon name={step.icon} size={24} /></div>
              <div>
                <div className="text-white font-bold mb-1 text-sm md:text-base md:mb-2">{step.title}</div>
                <div className="text-slate-400 text-sm">{step.desc}</div>
              </div>
            </div>
          ))}
        </div>

        {/* Link box */}
        <div className="bg-gradient-to-br from-violet-600/20 to-pink-600/20 border border-violet-500/30 rounded-2xl md:rounded-3xl p-5 md:p-7 mb-6 md:mb-8">
          <div className="text-slate-300 font-semibold mb-3 text-sm md:text-base">{r.linkLabel}</div>
          <div className="flex gap-3 flex-col">
            <div className="w-full bg-slate-900 border border-slate-600 rounded-xl px-4 py-3 text-slate-300 text-xs md:text-sm font-mono break-all">
              {refLink || 'Chargement...'}
            </div>
            <button
              onClick={copyLink}
              className="w-full flex items-center justify-center gap-2 bg-gradient-to-r from-violet-600 to-pink-600 hover:from-violet-700 hover:to-pink-700 active:scale-95 text-white font-bold px-6 py-4 rounded-xl transition min-h-[52px]"
            >
              <Icon name={copied ? r.copiedIcon : r.copyLinkIcon} size={20} />
              {copied ? r.copied : r.copyLink}
            </button>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-3 md:gap-4 mb-6">
          {[
            { label: r.stats.referred, value: stats.referred, color: 'from-blue-500 to-cyan-600' },
            { label: r.stats.converted, value: stats.converted, color: 'from-green-500 to-emerald-600' },
            { label: r.stats.earned, value: stats.earned, color: 'from-amber-500 to-orange-600' },
          ].map((s, i) => (
            <div key={i} className={`bg-gradient-to-br ${s.color} rounded-2xl p-3 md:p-5 text-center text-white shadow-lg`}>
              <div className="text-3xl md:text-4xl font-black">{s.value}</div>
              <div className="text-xs md:text-sm text-white/80 mt-1">{s.label}</div>
            </div>
          ))}
        </div>

        <p className="text-slate-500 text-xs md:text-sm text-center flex items-center justify-center gap-2">
          <Icon name={r.noteIcon} size={16} />
          {r.note}
        </p>
      </div>
    </section>
  );
}
