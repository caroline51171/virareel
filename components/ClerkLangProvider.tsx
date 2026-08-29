'use client';

import { ClerkProvider } from '@clerk/nextjs';
import { frFR, enUS } from '@clerk/localizations';
import { useState } from 'react';
import { langueChoisie } from '@/lib/langue';

// Les fenêtres de Clerk (connexion, inscription, vérification du courriel) parlaient
// anglais à tout le monde : Clerk n'a aucune traduction par défaut.
//
// Le choix se fait ICI, dans le navigateur, et surtout PAS côté serveur : le layout
// racine est servi identique à tout le monde (donc mis en cache, donc rapide), et lui
// faire lire la langue de chaque visiteur lui ferait perdre cette mise en cache.
//
// Même règle que le reste du site : le choix manuel FR/EN mémorisé l'emporte, sinon
// c'est la langue du navigateur.

export default function ClerkLangProvider({ children }: { children: React.ReactNode }) {
  // Fixé au premier rendu : la fenêtre de connexion ne doit pas changer de langue
  // sous les yeux de la personne pendant qu'elle la remplit.
  const [lang] = useState(langueChoisie);
  return (
    <ClerkProvider localization={lang === 'fr' ? frFR : enUS}>
      {children}
    </ClerkProvider>
  );
}
