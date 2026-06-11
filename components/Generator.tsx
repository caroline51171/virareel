'use client';

import { useState, useEffect } from 'react';
import { useUser } from '@clerk/nextjs';
import { Translations } from '@/lib/i18n';
import { copyText } from '@/lib/clipboard';

const ADMIN_EMAIL = 'caroline51171@gmail.com';

interface ReelResult {
  hook: string;
  script: string[];
  screenText: string[];
  caption: string;
  bestTime: string;
  duration?: string;
  soundTrend?: string | null;
  ytTitle?: string;
  seoDescription?: string;
  keywords?: string[];
}

interface Props {
  t: Translations;
  lang: string;
  region: string;
}

const FREE_LIMIT = 5;
const STORAGE_KEY = 'virareel_gens';

function getRemaining() {
  if (typeof window === 'undefined') return FREE_LIMIT;
  const used = parseInt(localStorage.getItem(STORAGE_KEY) || '0', 10);
  return Math.max(0, FREE_LIMIT - used);
}

function useGeneration() {
  const [remaining, setRemaining] = useState(FREE_LIMIT);
  const consume = () => {
    const used = parseInt(localStorage.getItem(STORAGE_KEY) || '0', 10) + 1;
    localStorage.setItem(STORAGE_KEY, String(used));
    setRemaining(Math.max(0, FREE_LIMIT - used));
  };
  const init = () => setRemaining(getRemaining());
  return { remaining, consume, init };
}

function CopyButton({ text, label, copiedLabel }: { text: string; label: string; copiedLabel: string }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    await copyText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  return (
    <button onClick={copy} className="text-xs px-3 py-2 rounded-full bg-white/20 hover:bg-white/30 active:bg-white/40 transition font-medium min-h-[36px]">
      {copied ? copiedLabel : label}
    </button>
  );
}

function ResultCard({ color, icon, title, sub, children, copyText, t }: {
  color: string; icon: string; title: string; sub: string;
  children: React.ReactNode; copyText?: string;
  t: Translations['generator']['results'];
}) {
  return (
    <div className={`${color} rounded-2xl p-5 text-white shadow-lg`}>
      <div className="flex justify-between items-start mb-3">
        <div>
          <div className="font-bold text-lg">{icon} {title}</div>
          <div className="text-white/70 text-sm">{sub}</div>
        </div>
        {copyText && <CopyButton text={copyText} label={t.copyBtn} copiedLabel={t.copied} />}
      </div>
      {children}
    </div>
  );
}

function VariationCard({ v, idx, t, platform, lang }: {
  v: ReelResult; idx: number; t: Translations; platform: string; lang: string;
}) {
  const r = t.generator.results;
  const colors = [
    'from-violet-500 to-purple-600',
    'from-pink-500 to-rose-600',
    'from-orange-400 to-amber-500',
  ];
  return (
    <div className={`bg-gradient-to-br ${colors[idx]} rounded-2xl p-5 text-white shadow-xl`}>
      <div className="font-bold text-xl mb-4">{r.variation} {idx + 1}</div>
      <div className="space-y-4">
        <div>
          <div className="font-semibold text-sm text-white/80 mb-1">{r.hook}</div>
          <div className="text-lg font-bold">"{v.hook}"</div>
        </div>
        <div>
          <div className="font-semibold text-sm text-white/80 mb-1">{r.script}</div>
          <ol className="space-y-1">
            {v.script.map((s, i) => <li key={i} className="text-sm">• {s}</li>)}
          </ol>
        </div>
        <div>
          <div className="font-semibold text-sm text-white/80 mb-1">{r.screenText}</div>
          <div className="flex flex-wrap gap-2">
            {v.screenText.map((w, i) => (
              <span key={i} className="bg-white/20 px-3 py-1 rounded-full text-sm font-bold">{w}</span>
            ))}
          </div>
        </div>
        <div>
          <div className="font-semibold text-sm text-white/80 mb-1">{r.caption}</div>
          <div className="text-sm bg-white/10 rounded-xl p-3">{v.caption}</div>
          <CopyButton text={v.caption} label={r.copyBtn} copiedLabel={r.copied} />
        </div>
        <div className="flex gap-3 flex-wrap">
          <span className="bg-white/20 px-3 py-1 rounded-full text-sm">🕐 {v.bestTime}</span>
          {platform === 'tiktok' && v.duration && (
            <span className="bg-white/20 px-3 py-1 rounded-full text-sm">⏱️ {v.duration}</span>
          )}
          {platform === 'tiktok' && v.soundTrend && (
            <span className="bg-white/20 px-3 py-1 rounded-full text-sm">🎵 {v.soundTrend}</span>
          )}
        </div>
        {platform === 'youtube' && v.ytTitle && (
          <div>
            <div className="font-semibold text-sm text-white/80 mb-1">{r.ytTitle}</div>
            <div className="text-sm bg-white/10 rounded-xl p-3 font-bold">{v.ytTitle}</div>
            <CopyButton text={v.ytTitle} label={r.copyBtn} copiedLabel={r.copied} />
          </div>
        )}
        {platform === 'youtube' && v.seoDescription && (
          <div>
            <div className="font-semibold text-sm text-white/80 mb-1">{r.seoDescription}</div>
            <div className="text-sm bg-white/10 rounded-xl p-3">{v.seoDescription}</div>
            <CopyButton text={v.seoDescription} label={r.copyBtn} copiedLabel={r.copied} />
          </div>
        )}
        {platform === 'youtube' && v.keywords && v.keywords.length > 0 && (
          <div>
            <div className="font-semibold text-sm text-white/80 mb-1">{r.keywords}</div>
            <div className="flex flex-wrap gap-2">
              {v.keywords.map((kw, i) => (
                <span key={i} className="bg-white/20 px-3 py-1 rounded-full text-sm font-medium">{kw}</span>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default function Generator({ t, lang, region }: Props) {
  const [topic, setTopic] = useState('');
  const [platform, setPlatform] = useState('instagram');
  const [tone, setTone] = useState('inspirational');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<ReelResult | null>(null);
  const [variations, setVariations] = useState<ReelResult[] | null>(null);
  const [error, setError] = useState('');
  const { remaining, consume, init } = useGeneration();
  const { user } = useUser();
  const isAdmin = user?.primaryEmailAddress?.emailAddress === ADMIN_EMAIL;

  const g = t.generator;

  // init remaining on mount
  useEffect(() => { init(); }, []);

  const generate = async (withVariations = false) => {
    if (!isAdmin && remaining <= 0) return;
    if (!topic.trim()) return;

    setLoading(true);
    setError('');
    setResult(null);
    setVariations(null);

    try {
      const res = await fetch('/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ topic, platform, tone, variations: withVariations, lang, region }),
      });

      if (!res.ok) throw new Error('API error');
      const data = await res.json();

      if (!isAdmin) consume();

      if (withVariations && data.variations) {
        setVariations(data.variations);
      } else {
        setResult(data);
      }
    } catch {
      setError(lang === 'fr' ? 'Erreur lors de la génération. Réessaie !' : 'Generation error. Please try again!');
    } finally {
      setLoading(false);
    }
  };

  const r = g.results;

  return (
    <section id="generator" className="py-14 px-4 bg-gradient-to-b from-slate-950 to-slate-900">
      <div className="max-w-4xl mx-auto">
        <div className="text-center mb-8">
          <h2 className="text-2xl md:text-4xl font-black text-white mb-2">{g.title}</h2>
          <p className="text-slate-400 text-sm md:text-base">{g.subtitle}</p>
        </div>

        {/* Form */}
        <div className="bg-slate-800/60 backdrop-blur rounded-2xl p-4 md:p-8 shadow-2xl border border-slate-700 mb-6">
          <div className="space-y-5">
            <div>
              <label className="block text-white font-semibold mb-2 text-sm md:text-base">{g.topicLabel}</label>
              <textarea
                value={topic}
                onChange={e => setTopic(e.target.value)}
                placeholder={g.topicPlaceholder}
                rows={3}
                className="w-full bg-slate-900 text-white rounded-xl p-3 md:p-4 border border-slate-600 focus:border-violet-500 focus:outline-none resize-none placeholder-slate-500 text-sm md:text-base"
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-white font-semibold mb-2 text-sm md:text-base">{g.platformLabel}</label>
                <div className="flex flex-col gap-2">
                  {(['instagram', 'tiktok', 'facebook', 'youtube'] as const).map(p => (
                    <button
                      key={p}
                      onClick={() => setPlatform(p)}
                      className={`px-4 py-3 rounded-xl border text-sm font-medium transition text-left min-h-[44px] cursor-pointer select-none touch-manipulation ${
                        platform === p
                          ? 'bg-violet-600 border-violet-500 text-white'
                          : 'bg-slate-900 border-slate-600 text-slate-300 hover:border-violet-500'
                      }`}
                    >
                      {g.platforms[p]}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-white font-semibold mb-2 text-sm md:text-base">{g.toneLabel}</label>
                <div className="flex flex-col gap-2">
                  {(Object.keys(g.tones) as (keyof typeof g.tones)[]).map(tk => (
                    <button
                      key={tk}
                      onClick={() => setTone(tk)}
                      className={`px-4 py-3 rounded-xl border text-sm font-medium transition text-left min-h-[44px] cursor-pointer select-none touch-manipulation ${
                        tone === tk
                          ? 'bg-pink-600 border-pink-500 text-white'
                          : 'bg-slate-900 border-slate-600 text-slate-300 hover:border-pink-500'
                      }`}
                    >
                      {g.tones[tk]}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {(isAdmin || remaining > 0) ? (
              <div className="flex flex-col gap-3">
                <button
                  onClick={() => generate(false)}
                  disabled={loading || !topic.trim()}
                  className="w-full bg-gradient-to-r from-violet-600 to-pink-600 hover:from-violet-700 hover:to-pink-700 text-white font-bold py-4 rounded-xl transition disabled:opacity-50 disabled:cursor-not-allowed text-base md:text-lg shadow-lg min-h-[52px] cursor-pointer touch-manipulation"
                >
                  {loading ? g.generating : g.generateBtn}
                </button>
                <button
                  onClick={() => generate(true)}
                  disabled={loading || !topic.trim()}
                  className="w-full bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-white font-bold py-4 rounded-xl transition disabled:opacity-50 disabled:cursor-not-allowed text-base md:text-lg shadow-lg min-h-[52px] cursor-pointer touch-manipulation"
                >
                  {loading ? g.generating : g.variationsBtn}
                </button>
              </div>
            ) : (
              <div className="text-center space-y-3">
                <p className="text-orange-400 font-semibold text-sm md:text-base">{g.limitReached}</p>
                <a href="#pricing" className="inline-block bg-gradient-to-r from-violet-600 to-pink-600 text-white font-bold py-3 px-8 rounded-xl min-h-[44px]">
                  {g.upgradeBtn}
                </a>
              </div>
            )}

            <p className="text-center text-slate-500 text-sm">
              {isAdmin ? '∞ Admin' : `${remaining} ${g.remaining}`}
            </p>
          </div>
        </div>

        {error && (
          <div className="bg-red-500/20 border border-red-500 text-red-400 rounded-xl p-4 mb-6 text-center">
            {error}
          </div>
        )}

        {/* Single Result */}
        {result && (
          <div className="space-y-4 animate-fadeIn">
            <ResultCard color="bg-gradient-to-br from-violet-600 to-purple-700" icon="🎯" title={r.hook} sub={r.hookSub} copyText={result.hook} t={r}>
              <p className="text-2xl font-black">"{result.hook}"</p>
            </ResultCard>

            <ResultCard color="bg-gradient-to-br from-blue-600 to-cyan-600" icon="📝" title={r.script} sub={r.scriptSub} t={r}>
              <ol className="space-y-2">
                {result.script.map((step, i) => (
                  <li key={i} className="flex gap-3 items-start">
                    <span className="bg-white/20 rounded-full w-6 h-6 flex items-center justify-center text-sm font-bold flex-shrink-0">{i + 1}</span>
                    <span className="text-sm">{step}</span>
                  </li>
                ))}
              </ol>
            </ResultCard>

            <ResultCard color="bg-gradient-to-br from-emerald-500 to-teal-600" icon="✏️" title={r.screenText} sub={r.screenTextSub} t={r}>
              <div className="flex flex-wrap gap-3">
                {result.screenText.map((w, i) => (
                  <span key={i} className="bg-white/20 px-4 py-2 rounded-xl font-black text-xl">{w}</span>
                ))}
              </div>
            </ResultCard>

            <ResultCard color="bg-gradient-to-br from-pink-500 to-rose-600" icon="💬" title={r.caption} sub={r.captionSub} copyText={result.caption} t={r}>
              <p className="text-sm leading-relaxed bg-white/10 rounded-xl p-3">{result.caption}</p>
            </ResultCard>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <ResultCard color="bg-gradient-to-br from-amber-500 to-orange-600" icon="🕐" title={r.bestTime} sub={r.bestTimeSub} t={r}>
                <p className="text-xl font-bold">{result.bestTime}</p>
              </ResultCard>

              {platform === 'tiktok' && (
                <>
                  {result.duration && (
                    <ResultCard color="bg-gradient-to-br from-red-500 to-rose-700" icon="⏱️" title={r.duration} sub={r.durationSub} t={r}>
                      <p className="text-3xl font-black">{result.duration}</p>
                    </ResultCard>
                  )}
                  {result.soundTrend && (
                    <ResultCard color="bg-gradient-to-br from-fuchsia-500 to-violet-700" icon="🎵" title={r.trend} sub={r.trendSub} t={r}>
                      <p className="text-lg font-bold">{result.soundTrend}</p>
                    </ResultCard>
                  )}
                </>
              )}
            </div>

            {platform === 'youtube' && (
              <div className="space-y-4">
                {result.ytTitle && (
                  <ResultCard color="bg-gradient-to-br from-red-600 to-rose-700" icon="🏷️" title={r.ytTitle} sub={r.ytTitleSub} copyText={result.ytTitle} t={r}>
                    <p className="text-lg font-bold">{result.ytTitle}</p>
                  </ResultCard>
                )}
                {result.seoDescription && (
                  <ResultCard color="bg-gradient-to-br from-sky-600 to-blue-700" icon="🔍" title={r.seoDescription} sub={r.seoDescriptionSub} copyText={result.seoDescription} t={r}>
                    <p className="text-sm leading-relaxed bg-white/10 rounded-xl p-3">{result.seoDescription}</p>
                  </ResultCard>
                )}
                {result.keywords && result.keywords.length > 0 && (
                  <ResultCard color="bg-gradient-to-br from-green-600 to-emerald-700" icon="🔑" title={r.keywords} sub={r.keywordsSub} copyText={result.keywords.join(', ')} t={r}>
                    <div className="flex flex-wrap gap-2">
                      {result.keywords.map((kw, i) => (
                        <span key={i} className="bg-white/20 px-3 py-1 rounded-full text-sm font-medium">{kw}</span>
                      ))}
                    </div>
                  </ResultCard>
                )}
              </div>
            )}
          </div>
        )}

        {/* Variations */}
        {variations && (
          <div className="space-y-6 animate-fadeIn">
            {variations.map((v, i) => (
              <VariationCard key={i} v={v} idx={i} t={t} platform={platform} lang={lang} />
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
