'use client';

// Affichage d'UN script en lecture (accroche, script, texte écran, légende…), sorti de
// History.tsx le 2026-10-05 pour être partagé avec la page publique /p/<id>.

import { useState } from 'react';
import Icon, { type IconName } from '@/components/Icon';
import { withJargon } from '@/components/Jargon';

// Logos de marque officiels (simple-icons) ; `all` = les 4 plateformes -> LayoutGrid.
export const PLATFORM_ICONS: Record<string, IconName> = {
  instagram: 'instagram',
  tiktok: 'tiktok',
  facebook: 'facebook',
  youtube: 'youtube',
  all: 'layout-grid',
};

export const PLATFORM_NAMES: Record<string, string> = {
  instagram: 'Instagram',
  tiktok: 'TikTok',
  facebook: 'Facebook',
  youtube: 'YouTube',
};

export interface ReelData {
  hook?: string;
  script?: string[];
  screenText?: string[];
  visualInspo?: string[];
  caption?: string;
  bestTime?: string;
  duration?: string;
  soundTrend?: string | null;
  ytTitle?: string;
  seoDescription?: string;
  keywords?: string[];
}

// Bloc repliable « 💡 Inspiration visuelle » dans l'historique (idées de plans/tournage).
function VisualInspoBlock({ items, lang }: { items?: string[]; lang: string }) {
  const [open, setOpen] = useState(false);
  if (!items || items.length === 0) return null;
  const fr = lang === 'fr';
  return (
    <div>
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className="text-violet-400 text-xs font-bold flex items-center gap-1 touch-manipulation"
      >
        <Icon name="lightbulb" size={16} />
        {fr ? 'Inspiration visuelle' : 'Visual inspiration'}
        <span className="text-slate-500"><Icon name={open ? 'chevron-up' : 'chevron-down'} size={16} /></span>
      </button>
      {open && (
        <ul className="mt-1.5 space-y-1">
          {items.map((v, i) => (
            <li key={i} className="text-slate-200 text-sm flex gap-2"><Icon name="clapperboard" size={16} /><span>{v}</span></li>
          ))}
        </ul>
      )}
    </div>
  );
}

export function ReelBlock({ reel, lang }: { reel: ReelData; lang: string }) {
  const fr = lang === 'fr';
  return (
    <div className="space-y-3 text-sm">
      {reel.hook && (
        <div>
          <div className="text-violet-400 text-xs font-bold mb-1 flex items-center gap-1.5"><Icon name="magnet" size={16} /> {withJargon('HOOK', fr)}</div>
          <p className="text-white italic">"{reel.hook}"</p>
        </div>
      )}
      {reel.script && reel.script.length > 0 && (
        <div>
          <div className="text-violet-400 text-xs font-bold mb-1 flex items-center gap-1.5"><Icon name="clapperboard" size={16} /> SCRIPT</div>
          <ul className="space-y-1.5">
            {reel.script.map((s, i) => (
              <li key={i} className="text-slate-200 bg-slate-900/60 rounded-lg px-3 py-2">{s}</li>
            ))}
          </ul>
        </div>
      )}
      {reel.screenText && reel.screenText.length > 0 && (
        <div>
          <div className="text-violet-400 text-xs font-bold mb-1 flex items-center gap-1.5"><Icon name="pencil" size={16} /> {fr ? 'TEXTE ÉCRAN' : 'SCREEN TEXT'}</div>
          <div className="flex flex-wrap gap-2">
            {reel.screenText.map((w, i) => (
              <span key={i} className="bg-white/10 px-3 py-1 rounded-lg text-white text-xs font-bold">{w}</span>
            ))}
          </div>
        </div>
      )}
      <VisualInspoBlock items={reel.visualInspo} lang={lang} />
      {reel.caption && (
        <div>
          <div className="text-violet-400 text-xs font-bold mb-1 flex items-center gap-1.5"><Icon name="file-text" size={16} /> {fr ? 'LÉGENDE' : 'CAPTION'}</div>
          <p className="text-slate-200 whitespace-pre-line">{reel.caption}</p>
        </div>
      )}
      <div className="flex flex-wrap gap-x-5 gap-y-1 text-xs text-slate-400">
        {reel.bestTime && <span className="inline-flex items-center gap-1"><Icon name="clock" size={16} /> {reel.bestTime}</span>}
        {reel.duration && <span className="inline-flex items-center gap-1"><Icon name="timer" size={16} /> {reel.duration}</span>}
        {reel.soundTrend && <span className="inline-flex items-center gap-1"><Icon name="music" size={16} /> {reel.soundTrend}</span>}
      </div>
      {reel.ytTitle && (
        <div>
          <div className="text-violet-400 text-xs font-bold mb-1 flex items-center gap-1.5"><Icon name="play" size={16} /> {fr ? 'TITRE YOUTUBE' : 'YOUTUBE TITLE'}</div>
          <p className="text-slate-200">{reel.ytTitle}</p>
        </div>
      )}
      {reel.seoDescription && (
        <div>
          <div className="text-violet-400 text-xs font-bold mb-1 flex items-center gap-1.5"><Icon name="search" size={16} /> {fr ? 'DESCRIPTION SEO' : 'SEO DESCRIPTION'}</div>
          <p className="text-slate-300 whitespace-pre-line text-xs">{reel.seoDescription}</p>
        </div>
      )}
      {reel.keywords && reel.keywords.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {reel.keywords.map((k, i) => (
            <span key={i} className="bg-slate-700 px-2 py-0.5 rounded text-xs text-slate-300">{k}</span>
          ))}
        </div>
      )}
    </div>
  );
}
