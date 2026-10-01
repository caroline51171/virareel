'use client';

import { ClerkProvider } from '@clerk/nextjs';
import { frFR, enUS } from '@clerk/localizations';
import { useState, useEffect } from 'react';
import { langueChoisie, LANGUE_EVENT } from '@/lib/langue';

// Les fenêtres de Clerk (connexion, inscription, vérification du courriel) parlaient
// anglais à tout le monde : Clerk n'a aucune traduction par défaut.
//
// Le choix se fait ICI, dans le navigateur, et surtout PAS côté serveur : le layout
// racine est servi identique à tout le monde (donc mis en cache, donc rapide), et lui
// faire lire la langue de chaque visiteur lui ferait perdre cette mise en cache.
//
// Même règle que le reste du site : le choix manuel FR/EN mémorisé l'emporte, sinon
// c'est la langue du navigateur.

// Les codes à 6 chiffres de Clerk peuvent tomber dans les indésirables (domaine encore
// jeune pour Gmail, même avec SPF/DKIM/DMARC en place) : Caroline a attendu un code
// qui y était déjà (2026-09-30). On l'ajoute sous chaque fenêtre « entrez le code ».
type Localisation = typeof frFR;
function avecIndesirables(base: Localisation, rappel: string): Localisation {
  const ajout = (texte?: string) => (texte ? `${texte.replace(/\.$/, '')}. ${rappel}` : rappel);
  return {
    ...base,
    signIn: {
      ...base.signIn,
      emailCode: { ...base.signIn?.emailCode, subtitle: ajout(base.signIn?.emailCode?.subtitle) },
      emailCodeMfa: { ...base.signIn?.emailCodeMfa, subtitle: ajout(base.signIn?.emailCodeMfa?.subtitle) },
      forgotPassword: {
        ...base.signIn?.forgotPassword,
        subtitle_email: ajout(base.signIn?.forgotPassword?.subtitle_email),
      },
    },
    signUp: {
      ...base.signUp,
      emailCode: { ...base.signUp?.emailCode, subtitle: ajout(base.signUp?.emailCode?.subtitle) },
    },
  };
}
const FR = avecIndesirables(frFR, 'Pas reçu ? Vérifiez vos courriels indésirables.');
const EN = avecIndesirables(enUS, "Didn't get it? Check your spam folder.");

export default function ClerkLangProvider({ children }: { children: React.ReactNode }) {
  // Lu au premier rendu, puis mis à jour quand le visiteur change de langue avec le
  // bouton FR/EN (LANGUE_EVENT). Ce bouton est hors de la fenêtre : elle ne peut donc
  // pas changer de langue sous les yeux de quelqu'un qui est en train de la remplir.
  const [lang, setLang] = useState(langueChoisie);
  useEffect(() => {
    const suivre = () => setLang(langueChoisie());
    window.addEventListener(LANGUE_EVENT, suivre);
    return () => window.removeEventListener(LANGUE_EVENT, suivre);
  }, []);
  return (
    <ClerkProvider localization={lang === 'fr' ? FR : EN}>
      {children}
    </ClerkProvider>
  );
}
