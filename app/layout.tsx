import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { ClerkProvider } from "@clerk/nextjs";
import { Analytics } from "@vercel/analytics/next";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "ViraReel AI — Générateur de scripts pour Reels viraux, TikTok & Shorts",
  description: "Générateur de scripts IA pour contenu court viral — Reels, TikTok, YouTube Shorts : hooks, légendes, hashtags prêts à publier. Pour agences et créateurs.",
  metadataBase: new URL('https://virareelai.com'),
  verification: {
    google: "Lg_N_K2FD1PANv_6w3mB8XiB3RrrR_OD36B_NWULQy4",
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

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <ClerkProvider>
      <html
        lang="fr"
        translate="no"
        className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
      >
        <body className="min-h-full flex flex-col">
          {children}
          <Analytics />
        </body>
      </html>
    </ClerkProvider>
  );
}
