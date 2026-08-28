import type { Metadata, Viewport } from "next";
import { Inter, Geist_Mono } from "next/font/google";
import ClerkLangProvider from "@/components/ClerkLangProvider";
import { Analytics } from "@vercel/analytics/next";
import "./globals.css";

// Police géométrique sans-serif (type Helvetica Neue) pour le logo, les titres
// et tout le texte du site. Variable : tous les poids 100-900 disponibles.
const interSans = Inter({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

// Métadonnées communes à tout le site. Le titre/description par langue sont définis
// par page : app/page.tsx (français) et app/en/page.tsx (anglais).
export const metadata: Metadata = {
  title: "ViraReel AI — Générateur de scripts pour Reels viraux, TikTok & Shorts",
  description: "Générateur de scripts IA pour contenu court viral — Reels, TikTok, YouTube Shorts : hooks, légendes, hashtags prêts à publier. Pour agences et créateurs.",
  metadataBase: new URL('https://virareelai.com'),
  verification: {
    google: "Lg_N_K2FD1PANv_6w3mB8XiB3RrrR_OD36B_NWULQy4",
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
    <ClerkLangProvider>
      <html
        lang="fr"
        translate="no"
        className={`${interSans.variable} ${geistMono.variable} h-full antialiased`}
      >
        <body className="min-h-full flex flex-col">
          {children}
          <Analytics />
        </body>
      </html>
    </ClerkLangProvider>
  );
}
