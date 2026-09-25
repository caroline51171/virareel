import type { Metadata } from 'next';
import { SITE_URL } from '@/lib/site';
import HomeClient from '@/components/HomeClient';

export const metadata: Metadata = {
  title: "ViraReel AI — Générateur de scripts pour Reels, TikTok & Shorts",
  description: "Générateur de scripts IA pour vidéo courte — Reels, TikTok, YouTube Shorts : hooks, légendes, hashtags prêts à publier. Pour agences et créateurs.",
  alternates: {
    canonical: SITE_URL,
    languages: {
      'fr': SITE_URL,
      'en': `${SITE_URL}/en`,
      'x-default': SITE_URL,
    },
  },
  openGraph: {
    title: "ViraReel AI — Des scripts complets, prêts à publier, en quelques secondes",
    description: "Hooks, scripts, captions et hashtags prêts à publier en quelques secondes — Instagram, TikTok, Facebook, YouTube.",
    url: SITE_URL,
    siteName: 'ViraReel AI',
    locale: 'fr_FR',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: "ViraReel AI — Des scripts complets, prêts à publier, en quelques secondes",
    description: "Hooks, scripts, captions et hashtags prêts à publier en quelques secondes — Instagram, TikTok, Facebook, YouTube.",
  },
};

export default function Home() {
  return <HomeClient initialLang="fr" autoDetect />;
}
