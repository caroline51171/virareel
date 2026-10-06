'use client';

// Bouton « Partager » d'une génération + sa fenêtre à 3 choix (2026-10-05) :
//   Envoyer      — le menu de partage du téléphone (texto, Messenger, WhatsApp…)
//   Courriel     — l'appli de courriel, sujet et lien déjà écrits (mailto:)
//   Copier       — le lien, à coller où on veut (DM Instagram, groupe…)
//   Code QR      — pour la personne DEVANT soi : elle le scanne avec son appareil photo
// Le lien est créé au clic par /api/partage (lib/partage.ts). Ouvert à tous, visiteurs
// compris, et ne coûte aucune génération.

import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import Icon from '@/components/Icon';
import { copyText } from '@/lib/clipboard';
import { lienPartage } from '@/lib/partage';
import { SITE_URL } from '@/lib/site';
import type { LocalHistoryEntry } from '@/lib/localHistory';

export default function BoutonPartager({ entry, lang, className }: {
  // Seuls mode, plateforme, langue et data partent au serveur (jamais le sujet).
  entry: Pick<LocalHistoryEntry, 'mode' | 'platform' | 'lang' | 'data'>;
  lang: string;
  className?: string;
}) {
  const fr = lang === 'fr';
  const [id, setId] = useState<string | null>(null);
  const [enCours, setEnCours] = useState(false);
  const [ouvert, setOuvert] = useState(false);
  const [erreur, setErreur] = useState('');
  const [copie, setCopie] = useState(false);
  const [qr, setQr] = useState<string | null>(null);
  const [montrerQr, setMontrerQr] = useState(false);
  // navigator.share n'existe pas partout (Firefox ordinateur) : « Envoyer » n'apparaît que s'il existe.
  // Lu au clic (jamais pendant le rendu serveur, où navigator n'existe pas).
  const [peutEnvoyer, setPeutEnvoyer] = useState(false);

  // Une nouvelle génération dans le même bouton (le générateur le garde monté) : on
  // oublie l'ancien lien. L'identifiant suit le contenu, le serveur redonne le même
  // lien pour le même contenu de toute façon.
  const empreinte = JSON.stringify([entry.mode, entry.platform, entry.lang, entry.data]);
  const [empreinteLien, setEmpreinteLien] = useState('');
  const lienValide = id && empreinteLien === empreinte ? id : null;

  // Fermer avec Échap.
  useEffect(() => {
    if (!ouvert) return;
    const echap = (e: KeyboardEvent) => { if (e.key === 'Escape') setOuvert(false); };
    document.addEventListener('keydown', echap);
    return () => document.removeEventListener('keydown', echap);
  }, [ouvert]);

  const ouvrir = async () => {
    setPeutEnvoyer(typeof navigator.share === 'function');
    setErreur('');
    setMontrerQr(false);
    if (lienValide) { setOuvert(true); return; }
    setEnCours(true);
    try {
      const res = await fetch('/api/partage', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode: entry.mode, platform: entry.platform, lang: entry.lang, data: entry.data }),
      });
      if (res.status === 429) throw new Error(fr
        ? 'Beaucoup de partages en peu de temps. Réessayez dans une heure.'
        : 'Too many shares in a short time. Please try again in an hour.');
      const d = await res.json().catch(() => ({}));
      if (!res.ok || typeof d.id !== 'string') throw new Error('');
      setId(d.id);
      setEmpreinteLien(empreinte);
      setQr(null);
      setOuvert(true);
    } catch (e) {
      const msg = e instanceof Error && e.message ? e.message : (fr
        ? 'Le partage ne fonctionne pas pour le moment. Réessayez dans un instant.'
        : 'Sharing is not working right now. Please try again in a moment.');
      setErreur(msg);
      setOuvert(true);
    } finally {
      setEnCours(false);
    }
  };

  const lien = lienValide ? lienPartage(SITE_URL, lienValide) : '';

  // Bouton à part plutôt que le menu de partage : sur Windows, ce menu ouvrait un
  // courriel VIDE (phrase + lien) ou ne proposait plus Outlook du tout (lien seul) —
  // tests de Caroline, 2026-10-05. Un lien mailto: ouvre l'appli de courriel par
  // défaut, sur ordinateur comme sur téléphone, avec le lien déjà dans le message.
  const courriel = `mailto:?subject=${encodeURIComponent(fr
    ? 'Un script de Reel créé avec ViraReel AI'
    : 'A Reel script made with ViraReel AI')}&body=${encodeURIComponent(fr
    ? `Bonjour,\n\nVoici un script de Reel créé avec ViraReel AI :\n${lien}\n\nVous pouvez aussi créer le vôtre gratuitement.`
    : `Hi,\n\nHere is a Reel script made with ViraReel AI:\n${lien}\n\nYou can create your own for free too.`)}`;

  const envoyer = async () => {
    try {
      // LE LIEN SEUL, sans `text` : avec texte + lien, certaines applis (Gmail sur
      // téléphone) ouvraient un courriel VIDE — test de Caroline, 2026-10-05. Un lien
      // seul est accepté partout, et son aperçu (accroche + marque) tient lieu de message.
      await navigator.share({ url: lien });
    } catch {
      // Menu fermé sans choisir : rien à faire.
    }
  };

  const copier = async () => {
    await copyText(lien);
    setCopie(true);
    setTimeout(() => setCopie(false), 2000);
  };

  const basculerQr = async () => {
    if (montrerQr) { setMontrerQr(false); return; }
    setMontrerQr(true);
    if (qr || !lienValide) return;
    // Chargé seulement au besoin : la bibliothèque n'alourdit pas le générateur.
    const QRCode = (await import('qrcode')).default;
    setQr(await QRCode.toString(lienPartage(SITE_URL, lienValide, true), { type: 'svg', margin: 1, errorCorrectionLevel: 'M' }));
  };

  const choix = 'w-full flex items-center justify-center gap-2 rounded-xl px-4 py-3 font-semibold text-sm transition touch-manipulation';

  return (
    <>
      <button
        type="button"
        onClick={ouvrir}
        disabled={enCours}
        className={className ?? 'bg-slate-700 hover:bg-slate-600 text-white text-xs font-semibold rounded-lg px-3 py-1.5 transition touch-manipulation disabled:opacity-60'}
      >
        <span className="inline-flex items-center justify-center gap-1.5">
          <Icon name={enCours ? 'loader' : 'share'} size={16} className={enCours ? 'animate-spin' : undefined} />
          {fr ? 'Partager' : 'Share'}
        </span>
      </button>

      {/* Portail : la barre d'outils collante a un flou d'arrière-plan, qui piégerait
          une fenêtre « fixed » à l'intérieur de la barre au lieu de couvrir l'écran. */}
      {ouvert && createPortal(
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" role="dialog" aria-modal="true">
          <div className="absolute inset-0 bg-slate-950/85 backdrop-blur-sm" onClick={() => setOuvert(false)} />
          <div className="relative z-10 w-full max-w-sm bg-slate-800 border border-violet-500/40 rounded-2xl p-6 shadow-2xl">
            <button
              type="button"
              onClick={() => setOuvert(false)}
              className="absolute top-4 right-4 text-slate-500 hover:text-slate-300"
              aria-label={fr ? 'Fermer' : 'Close'}
            >
              <Icon name="x" size={20} />
            </button>
            <h3 className="text-white font-bold text-lg mb-1 pr-8 flex items-center gap-2">
              <Icon name="share" size={20} />
              {fr ? 'Partager cette génération' : 'Share this generation'}
            </h3>

            {erreur ? (
              <p className="text-red-300 text-sm mt-3 flex items-start gap-2">
                <Icon name="alert-triangle" size={16} className="mt-0.5" />
                {erreur}
              </p>
            ) : (
              <>
                <p className="text-slate-400 text-xs mb-4">
                  {fr
                    ? 'Toute personne qui a le lien peut voir ce script. Votre nom et votre sujet ne sont pas partagés.'
                    : 'Anyone with the link can see this script. Your name and your topic are not shared.'}
                </p>

                <div className="space-y-2">
                  {peutEnvoyer && (
                    <button type="button" onClick={envoyer} className={`${choix} bg-gradient-to-r from-violet-600 to-pink-600 hover:from-violet-700 hover:to-pink-700 text-white`}>
                      <Icon name="send" size={20} />
                      {fr ? 'Envoyer (texto, Messenger…)' : 'Send (text, Messenger…)'}
                    </button>
                  )}
                  <a href={courriel} className={`${choix} bg-slate-700 hover:bg-slate-600 text-white`}>
                    <Icon name="mail" size={20} />
                    {fr ? 'Courriel' : 'Email'}
                  </a>
                  <button type="button" onClick={copier} className={`${choix} bg-slate-700 hover:bg-slate-600 text-white`}>
                    <Icon name={copie ? 'check' : 'link'} size={20} />
                    {copie ? (fr ? 'Lien copié !' : 'Link copied!') : (fr ? 'Copier le lien' : 'Copy link')}
                  </button>
                  <button type="button" onClick={basculerQr} aria-expanded={montrerQr} className={`${choix} bg-slate-700 hover:bg-slate-600 text-white`}>
                    <Icon name="qr-code" size={20} />
                    {fr ? 'Code QR' : 'QR code'}
                    <Icon name={montrerQr ? 'chevron-up' : 'chevron-down'} size={16} />
                  </button>
                </div>

                {montrerQr && (
                  <div className="mt-4 flex flex-col items-center gap-2">
                    {/* Fond BLANC obligatoire : un code QR sur fond sombre se lit mal. */}
                    <div className="bg-white rounded-xl p-3 w-56 h-56 flex items-center justify-center">
                      {qr
                        ? <div className="w-full h-full [&>svg]:w-full [&>svg]:h-full" dangerouslySetInnerHTML={{ __html: qr }} />
                        : <Icon name="loader" size={24} className="animate-spin text-slate-400" />}
                    </div>
                    <p className="text-slate-400 text-xs text-center">
                      {fr
                        ? "La personne le scanne avec l'appareil photo de son téléphone."
                        : 'The other person scans it with their phone camera.'}
                    </p>
                  </div>
                )}

                <p className="mt-4 text-slate-500 text-xs text-center break-all select-all">{lien}</p>
              </>
            )}
          </div>
        </div>,
        document.body,
      )}
    </>
  );
}
