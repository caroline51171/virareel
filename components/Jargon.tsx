'use client';

// Bulle « ? » qui donne l'équivalent français d'un mot de jargon anglais (Hook, CTA…).
//
// Pourquoi : la Charte de la langue française (Québec) et la loi Toubon (France)
// demandent qu'un terme anglais soit accompagné de son équivalent français. Avis de
// Jean (2026-10-01) : une infobulle à côté du mot suffit, à condition qu'elle s'ouvre
// aussi au toucher sur téléphone. Site FRANÇAIS seulement — en anglais, rien ne s'affiche.
//
// Ajouter un mot : une ligne dans JARGON_FR, puis passer le texte dans withJargon().

import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import Icon from '@/components/Icon';

// Clé = le mot anglais en minuscules ; valeur = ce que la bulle affiche.
export const JARGON_FR: Record<string, string> = {
  hooks: 'Accroches',
  hook: 'Accroche',
  cta: "Appel à l'action",
};

export function JargonTip({ traduction, size = 14 }: { traduction: string; size?: 14 | 16 }) {
  const [ouvert, setOuvert] = useState(false);
  const [decalage, setDecalage] = useState(0);
  const racine = useRef<HTMLSpanElement>(null);
  const bulle = useRef<HTMLSpanElement>(null);

  // Fermer au toucher/clic ailleurs, ou avec Échap.
  useEffect(() => {
    if (!ouvert) return;
    const ailleurs = (e: PointerEvent) => {
      if (racine.current && !racine.current.contains(e.target as Node)) setOuvert(false);
    };
    const echap = (e: KeyboardEvent) => { if (e.key === 'Escape') setOuvert(false); };
    document.addEventListener('pointerdown', ailleurs);
    document.addEventListener('keydown', echap);
    return () => {
      document.removeEventListener('pointerdown', ailleurs);
      document.removeEventListener('keydown', echap);
    };
  }, [ouvert]);

  // Garder la bulle dans l'écran (téléphone de 320 px, mot collé au bord).
  useLayoutEffect(() => {
    if (!ouvert || !bulle.current) { setDecalage(0); return; }
    const b = bulle.current.getBoundingClientRect();
    const marge = 8;
    if (b.right > window.innerWidth - marge) setDecalage(window.innerWidth - marge - b.right);
    else if (b.left < marge) setDecalage(marge - b.left);
  }, [ouvert]);

  return (
    <span ref={racine} className="relative inline-flex align-middle">
      <button
        type="button"
        // Ne pas déclencher la copie au clic des blocs « cliquer pour copier ».
        onClick={e => { e.stopPropagation(); setOuvert(o => !o); }}
        aria-label={`En français : ${traduction}`}
        aria-expanded={ouvert}
        className="inline-flex text-current opacity-60 hover:opacity-100 transition cursor-pointer p-0.5"
      >
        <Icon name="help-circle" size={size} />
      </button>
      {ouvert && (
        <span
          ref={bulle}
          role="tooltip"
          style={{ transform: `translateX(calc(-50% + ${decalage}px))` }}
          className="absolute bottom-full left-1/2 mb-1.5 z-20 whitespace-nowrap bg-slate-900 text-white text-xs font-semibold normal-case tracking-normal px-2.5 py-1 rounded-lg shadow-lg border border-white/10"
        >
          {traduction}
        </span>
      )}
    </span>
  );
}

// Ajoute la bulle « ? » après le 1er mot de jargon trouvé dans le texte (une seule fois,
// comme le demande la loi). `debut` : ne chercher qu'au début (étiquette « CTA : … ») ;
// `seulement` : limiter à certains mots (ex. ['cta'] dans le script, où « Hook » a déjà
// sa bulle dans le titre de la carte).
export function withJargon(
  texte: string,
  fr: boolean,
  { debut = false, seulement, size }: { debut?: boolean; seulement?: string[]; size?: 14 | 16 } = {},
): React.ReactNode {
  if (!fr || !texte) return texte;
  const mots = (seulement ?? Object.keys(JARGON_FR)).join('|');
  const m = new RegExp(`${debut ? '^' : ''}\\b(${mots})\\b`, 'i').exec(texte);
  if (!m) return texte;
  const fin = m.index + m[0].length;
  return (
    <>
      {texte.slice(0, fin)}
      <JargonTip traduction={JARGON_FR[m[1].toLowerCase()]} size={size} />
      {texte.slice(fin)}
    </>
  );
}
