'use client';

import { useState, useRef, useEffect } from 'react';
import { ExportFormat } from '@/lib/exportHistory';
import Icon from './Icon';

// Bouton « Exporter » : on choisit le format (TXT / CSV / MD) au moment du clic.
export default function ExportMenu({ onExport, lang, label, className }: {
  onExport: (format: ExportFormat) => void;
  lang: string;
  label?: string;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const fr = lang === 'fr';

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const formats: { f: ExportFormat; desc: string }[] = [
    { f: 'txt', desc: fr ? 'texte simple' : 'plain text' },
    { f: 'csv', desc: fr ? 'tableur (Excel)' : 'spreadsheet (Excel)' },
    { f: 'md', desc: 'Notion / Docs' },
  ];

  const pick = (f: ExportFormat) => {
    setOpen(false);
    onExport(f);
  };

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen(o => !o)}
        className={className ?? 'bg-slate-700 hover:bg-slate-600 text-white text-xs font-semibold rounded-lg px-3 py-1.5 transition touch-manipulation'}
      >
        {/* span interne : le className du bouton vient parfois du parent, on ne le touche pas */}
        <span className="inline-flex items-center justify-center gap-1.5">
          <Icon name="download" size={16} />
          {label ?? (fr ? 'Exporter' : 'Export')}
          <Icon name="chevron-down" size={16} />
        </span>
      </button>
      {open && (
        <div className="absolute right-0 top-full mt-1 z-30 bg-slate-800 border border-slate-600 rounded-xl shadow-2xl overflow-hidden min-w-[190px]">
          <div className="px-3 py-2 text-slate-400 text-xs border-b border-slate-700">
            {fr ? 'Choisir le format' : 'Choose the format'}
          </div>
          {formats.map(({ f, desc }) => (
            <button
              key={f}
              onClick={() => pick(f)}
              className="w-full text-left px-3 py-2.5 text-sm text-white hover:bg-slate-700 transition flex items-center justify-between gap-3 touch-manipulation"
            >
              <span className="font-semibold">{f.toUpperCase()}</span>
              <span className="text-slate-400 text-xs">{desc}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
