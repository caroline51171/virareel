'use client';

import { useState } from 'react';

const LEGAL_KEY = 'virareel-legal-consent';

interface Props {
  lang: string;
  onAccept: () => void;
  onClose: () => void;
}

export default function ConsentModal({ lang, onAccept, onClose }: Props) {
  const [checked, setChecked] = useState(false);

  const handleAccept = () => {
    localStorage.setItem(LEGAL_KEY, '1');
    onAccept();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Overlay */}
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />

      {/* Modal */}
      <div className="relative bg-slate-900 border border-violet-500/40 rounded-2xl p-6 md:p-8 max-w-md w-full shadow-2xl">
        {/* Close */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-slate-500 hover:text-slate-300 text-xl transition"
        >
          ✕
        </button>

        {/* Logo */}
        <div className="text-center mb-6">
          <div className="text-xl font-black bg-gradient-to-r from-violet-400 to-pink-400 bg-clip-text text-transparent mb-1">
            ViraReel AI
          </div>
          <h2 className="text-white font-bold text-lg">
            {lang === 'fr' ? 'Avant de continuer' : 'Before continuing'}
          </h2>
        </div>

        {/* Text */}
        <p className="text-slate-400 text-sm mb-6 text-center leading-relaxed">
          {lang === 'fr'
            ? 'En créant un compte ou en vous connectant, vous acceptez l\'utilisation de cookies ainsi que nos documents légaux.'
            : 'By creating an account or signing in, you agree to the use of cookies and our legal documents.'}
        </p>

        {/* Checkbox */}
        <label className="flex items-start gap-3 cursor-pointer mb-6 group">
          <div className="relative mt-0.5 flex-shrink-0">
            <input
              type="checkbox"
              checked={checked}
              onChange={e => setChecked(e.target.checked)}
              className="sr-only"
            />
            <div className={`w-5 h-5 rounded border-2 transition flex items-center justify-center ${checked ? 'bg-violet-600 border-violet-600' : 'border-slate-500 bg-slate-800 group-hover:border-violet-400'}`}>
              {checked && <span className="text-white text-xs font-bold">✓</span>}
            </div>
          </div>
          <span className="text-slate-300 text-sm leading-relaxed">
            {lang === 'fr' ? (
              <>J&apos;accepte les <a href="/cgv" target="_blank" className="text-violet-400 hover:text-violet-300 underline">Conditions Générales de Vente</a>, la <a href="/privacy" target="_blank" className="text-violet-400 hover:text-violet-300 underline">Politique de Confidentialité</a> et l&apos;utilisation de cookies.</>
            ) : (
              <>I accept the <a href="/cgv" target="_blank" className="text-violet-400 hover:text-violet-300 underline">Terms of Service</a>, the <a href="/privacy" target="_blank" className="text-violet-400 hover:text-violet-300 underline">Privacy Policy</a> and the use of cookies.</>
            )}
          </span>
        </label>

        {/* Button */}
        <button
          onClick={handleAccept}
          disabled={!checked}
          className="w-full bg-gradient-to-r from-violet-600 to-pink-600 hover:from-violet-700 hover:to-pink-700 disabled:opacity-40 disabled:cursor-not-allowed active:scale-95 text-white font-bold py-3 rounded-xl transition"
        >
          {lang === 'fr' ? 'Continuer' : 'Continue'}
        </button>
      </div>
    </div>
  );
}
