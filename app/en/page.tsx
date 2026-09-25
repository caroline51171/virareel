import type { Metadata } from 'next';
import { SITE_URL } from '@/lib/site';
import HomeClient from '@/components/HomeClient';

export const metadata: Metadata = {
  title: "ViraReel AI — AI Script Generator for Reels, TikTok & Shorts",
  description: "AI script generator for short-form video — Reels, TikTok, YouTube Shorts: hooks, captions and hashtags ready to publish. Built for agencies and creators.",
  alternates: {
    canonical: `${SITE_URL}/en`,
    languages: {
      'fr': SITE_URL,
      'en': `${SITE_URL}/en`,
      'x-default': SITE_URL,
    },
  },
  openGraph: {
    title: "ViraReel AI — Complete, ready-to-publish scripts in seconds",
    description: "Hooks, scripts, captions and hashtags ready to publish in seconds — Instagram, TikTok, Facebook, YouTube.",
    url: `${SITE_URL}/en`,
    siteName: 'ViraReel AI',
    locale: 'en_US',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: "ViraReel AI — Complete, ready-to-publish scripts in seconds",
    description: "Hooks, scripts, captions and hashtags ready to publish in seconds — Instagram, TikTok, Facebook, YouTube.",
  },
};

export default function HomeEn() {
  return <HomeClient initialLang="en" autoDetect={false} />;
}
