import type { Metadata } from 'next';
import Renonciation from '@/components/Renonciation';

export const metadata: Metadata = {
  title: 'Renoncer au contrat — ViraReel AI',
  robots: { index: false },
};

// Une seule adresse pour les deux langues, comme /cgv et /privacy : la langue est
// choisie dans le navigateur (lib/langue.ts). Voir components/Renonciation.tsx.
export default function Renoncer() {
  return <Renonciation />;
}
