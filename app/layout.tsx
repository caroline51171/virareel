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
  title: "ViraReel AI — Générateur de Reels Viraux IA",
  description: "Entre ton idée, choisis ta plateforme, et l'IA génère un hook percutant, un script complet et une caption avec hashtags — prêt à publier en 10 secondes.",
  metadataBase: new URL('https://virareelai.com'),
  verification: {
    google: "Lg_N_K2FD1PANv_6w3mB8XiB3RrrR_OD36B_NWULQy4",
  },
  openGraph: {
    title: "ViraReel AI — Génère tes Reels viraux en 10 secondes",
    description: "Entre ton idée, choisis ta plateforme, et l'IA génère un hook percutant, un script complet et une caption avec hashtags — prêt à publier !",
    url: 'https://virareelai.com',
    siteName: 'ViraReel AI',
    locale: 'fr_FR',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: "ViraReel AI — Génère tes Reels viraux en 10 secondes",
    description: "Entre ton idée, choisis ta plateforme, et l'IA génère un hook percutant, un script complet et une caption avec hashtags — prêt à publier !",
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
