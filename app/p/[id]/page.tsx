import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import PartageVue from '@/components/PartageVue';
import Icon from '@/components/Icon';
import { idValide, lirePartage, premiereAccroche } from '@/lib/partage';
import { SITE_URL } from '@/lib/site';

// Page publique d'une génération partagée. Voir lib/partage.ts et components/PartageVue.tsx.

type Props = {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ via?: string }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const p = await lirePartage(id);
  if (!p) return { title: idValide(id) ? 'Lien expiré — ViraReel AI' : 'ViraReel AI', robots: { index: false, follow: false } };
  const fr = p.lang === 'fr';
  const accroche = premiereAccroche(p);
  const titre = accroche ? `« ${accroche.slice(0, 90)} »` : 'ViraReel AI';
  const description = fr
    ? 'Un script de Reel créé en quelques secondes avec ViraReel AI. Créez le vôtre gratuitement.'
    : 'A Reel script made in seconds with ViraReel AI. Create yours for free.';
  return {
    title: `${titre} — ViraReel AI`,
    description,
    // Contenu écrit par les utilisateurs : jamais dans Google.
    robots: { index: false, follow: false },
    openGraph: {
      title: titre,
      description,
      url: `${SITE_URL}/p/${id}`,
      siteName: 'ViraReel AI',
      locale: fr ? 'fr_FR' : 'en_US',
      type: 'website',
    },
    twitter: { card: 'summary_large_image', title: titre, description },
  };
}

export default async function PagePartage({ params, searchParams }: Props) {
  const { id } = await params;
  const { via } = await searchParams;
  const partage = await lirePartage(id);
  // Un identifiant bien formé mais absent = un partage effacé après ses 90 jours
  // (lib/partage.ts). On ne peut plus savoir sa langue : la page est en français
  // avec une ligne en anglais. Une adresse mal formée reste une vraie page 404.
  if (!partage) {
    if (!idValide(id)) notFound();
    return <LienExpire />;
  }
  return <PartageVue partage={partage} via={via === 'qr' ? 'qr' : 'lien'} />;
}

function LienExpire() {
  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center px-4">
      <div className="text-center max-w-md">
        <div className="text-violet-400 flex justify-center mb-4"><Icon name="clock" size={24} /></div>
        <h1 className="text-2xl font-black text-white mb-3">Ce lien a expiré</h1>
        <p className="text-slate-400 text-sm mb-2">
          Les générations partagées restent en ligne 90&nbsp;jours après leur dernier partage.
        </p>
        <p className="text-slate-500 text-xs mb-8">This link has expired: shared generations stay online for 90 days.</p>
        {/* <a> et non <Link> : un VRAI chargement de page, pour que MetaPixel relise
            l'étiquette de provenance de l'adresse (lib/origine.ts). */}
        {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
        <a
          href="/?utm_source=partage&utm_medium=expire#generator"
          className="inline-flex items-center gap-2 bg-gradient-to-r from-violet-600 to-pink-600 hover:from-violet-700 hover:to-pink-700 active:scale-95 text-white font-bold px-8 py-4 rounded-2xl transition shadow-2xl shadow-violet-500/25"
        >
          <Icon name="sparkles" size={20} />
          Créer le mien gratuitement
        </a>
      </div>
    </div>
  );
}
