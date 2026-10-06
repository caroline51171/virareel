import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import PartageVue from '@/components/PartageVue';
import { lirePartage, premiereAccroche } from '@/lib/partage';
import { SITE_URL } from '@/lib/site';

// Page publique d'une génération partagée. Voir lib/partage.ts et components/PartageVue.tsx.

type Props = {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ via?: string }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const p = await lirePartage(id);
  if (!p) return { title: 'ViraReel AI', robots: { index: false, follow: false } };
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
  if (!partage) notFound();
  return <PartageVue partage={partage} via={via === 'qr' ? 'qr' : 'lien'} />;
}
