import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'Page introuvable — ViraReel AI',
};

export default function NotFound() {
  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center px-4">
      <div className="text-center max-w-md">
        <div className="text-8xl font-black bg-gradient-to-r from-violet-400 to-pink-400 bg-clip-text text-transparent mb-4">
          404
        </div>
        <h1 className="text-2xl font-black text-white mb-3">
          Cette page n&apos;existe pas
        </h1>
        <p className="text-slate-400 text-sm mb-8">
          Le lien est peut-être cassé ou la page a été déplacée.
        </p>
        <Link
          href="/"
          className="inline-flex items-center gap-2 bg-gradient-to-r from-violet-600 to-pink-600 hover:from-violet-700 hover:to-pink-700 active:scale-95 text-white font-bold px-8 py-4 rounded-2xl transition shadow-2xl shadow-violet-500/25"
        >
          🚀 Retour à ViraReel AI
        </Link>
      </div>
    </div>
  );
}
