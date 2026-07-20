import type { Metadata } from 'next';
import HomeClient from '@/components/HomeClient';

export const metadata: Metadata = {
  title: "ViraReel AI — Générateur de scripts pour Reels viraux, TikTok & Shorts",
  description: "Générateur de scripts IA pour contenu court viral — Reels, TikTok, YouTube Shorts : hooks, légendes, hashtags prêts à publier. Pour agences et créateurs.",
  alternates: {
    canonical: 'https://virareelai.com',
    languages: {
      'fr': 'https://virareelai.com',
      'en': 'https://virareelai.com/en',
      'x-default': 'https://virareelai.com',
    },
  },
  openGraph: {
    title: "ViraReel AI — Des scripts complets, prêts à publier, en quelques secondes",
    description: "Hooks, scripts, captions et hashtags prêts à publier en quelques secondes — Instagram, TikTok, Facebook, YouTube.",
    url: 'https://virareelai.com',
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
