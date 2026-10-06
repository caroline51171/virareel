'use client';

// Page publique d'une génération partagée (/p/<id>) — ce que voit l'AMI qui reçoit
// le lien. Lecture seule, puis « Créer le mien gratuitement » vers le générateur, où
// il a les essais gratuits habituels. Voir lib/partage.ts.

import { useState } from 'react';
import Icon from '@/components/Icon';
import { useSwipe } from '@/lib/useSwipe';
import { ReelBlock, PLATFORM_ICONS, PLATFORM_NAMES, type ReelData } from '@/components/ReelBlock';
import { PLATEFORMES, type Partage } from '@/lib/partage';

function Pastilles({ n, actif, choisir, libelle }: { n: number; actif: number; choisir: (i: number) => void; libelle: string }) {
  return (
    <div className="flex flex-wrap gap-2">
      {Array.from({ length: n }, (_, i) => (
        <button
          key={i}
          type="button"
          onClick={() => choisir(i)}
          aria-pressed={i === actif}
          className={`text-xs px-3 py-1.5 rounded-full font-semibold transition ${
            i === actif
              ? 'bg-slate-300 text-slate-900'
              : 'bg-slate-800/60 border border-slate-700 text-slate-300 hover:bg-slate-700'
          }`}
        >
          {libelle} {i + 1}
        </button>
      ))}
    </div>
  );
}

function Carte({ children }: { children: React.ReactNode }) {
  return <div className="bg-slate-800 border border-slate-700 rounded-xl p-4">{children}</div>;
}

// Un reel seul, ou un lot de plateformes (mode 4 plateformes, ou une idée en 4 plateformes).
function Contenu({ data, platform, lang }: { data: unknown; platform: string; lang: string }) {
  const d = data as Record<string, ReelData>;
  const plateformes = PLATEFORMES.filter(p => d[p]);
  if (plateformes.length === 0) {
    return (
      <Carte>
        {PLATFORM_NAMES[platform] && (
          <div className="text-white font-bold mb-3 flex items-center gap-2">
            <Icon name={PLATFORM_ICONS[platform]} size={20} /> {PLATFORM_NAMES[platform]}
          </div>
        )}
        <ReelBlock reel={d as ReelData} lang={lang} />
      </Carte>
    );
  }
  return (
    <div className="space-y-4">
      {plateformes.map(p => (
        <Carte key={p}>
          <div className="text-white font-bold mb-3 flex items-center gap-2">
            <Icon name={PLATFORM_ICONS[p]} size={20} /> {PLATFORM_NAMES[p]}
          </div>
          <ReelBlock reel={d[p]} lang={lang} />
        </Carte>
      ))}
    </div>
  );
}

function AvecOnglets({ elements, libelle, lang, platform }: {
  elements: { label?: string; data: unknown }[]; libelle: string; lang: string; platform: string;
}) {
  const [actif, setActif] = useState(0);
  const swipe = useSwipe(
    () => setActif(n => Math.max(0, n - 1)),
    () => setActif(n => Math.min(elements.length - 1, n + 1)),
  );
  const cur = elements[Math.min(actif, elements.length - 1)];
  return (
    <div className="space-y-4">
      <Pastilles n={elements.length} actif={actif} choisir={setActif} libelle={libelle} />
      <div className="space-y-3" {...swipe}>
        {cur.label && <p className="text-slate-400 text-sm">{cur.label}</p>}
        <Contenu key={actif} data={cur.data} platform={platform} lang={lang} />
      </div>
    </div>
  );
}

export default function PartageVue({ partage, via }: { partage: Partage; via: 'qr' | 'lien' }) {
  const fr = partage.lang === 'fr';
  // Le lien porte l'étiquette « partage » (lib/origine.ts) : sans elle, une visite qui
  // accepte les témoins seulement sur l'accueil perdrait sa provenance.
  const accueil = `${fr ? '/' : '/en'}?utm_source=partage&utm_medium=${via}#generator`;
  const d = partage.data as Record<string, unknown>;

  let corps: React.ReactNode;
  if (partage.mode === 'variations' && Array.isArray(d.variations)) {
    corps = <AvecOnglets elements={(d.variations as unknown[]).map(v => ({ data: v }))} libelle="Variation" lang={partage.lang} platform={partage.platform} />;
  } else if (partage.mode === 'ideas' && Array.isArray(d.ideas)) {
    corps = <AvecOnglets elements={d.ideas as { label?: string; data: unknown }[]} libelle={fr ? 'Idée' : 'Idea'} lang={partage.lang} platform={partage.platform} />;
  } else {
    corps = <Contenu data={d} platform={partage.platform} lang={partage.lang} />;
  }

  const cta = (
    <a
      href={accueil}
      className="inline-flex items-center justify-center gap-2 bg-gradient-to-r from-violet-600 to-pink-600 hover:from-violet-700 hover:to-pink-700 active:scale-95 text-white font-bold px-6 py-3 rounded-2xl transition shadow-2xl shadow-violet-500/25"
    >
      <Icon name="sparkles" size={20} />
      {fr ? 'Créer le mien gratuitement' : 'Create mine for free'}
    </a>
  );

  return (
    <div className="min-h-screen bg-slate-950 text-white">
      <header className="border-b border-slate-800 bg-slate-950/80">
        <div className="max-w-3xl mx-auto px-4 py-3 flex items-center justify-between gap-3">
          <a href={fr ? '/' : '/en'} className="text-xl md:text-2xl font-black whitespace-nowrap bg-gradient-to-r from-violet-400 to-pink-400 bg-clip-text text-transparent">
            ViraReel AI
          </a>
          <a href={accueil} className="text-sm font-semibold text-violet-300 hover:text-violet-200 transition whitespace-nowrap">
            {fr ? 'Essayer gratuitement' : 'Try it free'}
          </a>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 py-8 space-y-6">
        <div className="text-center space-y-2">
          <p className="text-violet-300 text-sm font-semibold inline-flex items-center gap-1.5">
            <Icon name="share" size={16} />
            {fr ? 'On vous a partagé un script de Reel' : 'Someone shared a Reel script with you'}
          </p>
          <h1 className="text-2xl md:text-3xl font-black">
            {fr ? 'Créé en quelques secondes avec ViraReel AI' : 'Made in seconds with ViraReel AI'}
          </h1>
        </div>

        <div className="select-text">{corps}</div>

        <div className="bg-gradient-to-br from-violet-600/20 to-pink-600/20 border border-violet-500/40 rounded-2xl p-6 text-center space-y-3">
          <h2 className="text-xl font-black">{fr ? 'Envie du vôtre ?' : 'Want your own?'}</h2>
          <p className="text-slate-300 text-sm">
            {fr
              ? 'Décrivez votre sujet, ViraReel écrit l’accroche, le script, la légende et les mots-clics. Essai gratuit, sans carte de crédit.'
              : 'Describe your topic, ViraReel writes the hook, script, caption and hashtags. Free trial, no credit card.'}
          </p>
          {cta}
        </div>
      </main>
    </div>
  );
}
