'use client';

import { useEffect, useState } from 'react';
import { UserButton } from '@clerk/nextjs';
import Icon from '@/components/Icon';
import { ouvrirPortail } from '@/lib/portail';

// Menu de la photo de profil (barre du haut). Pour un abonné, il porte aussi
// « Gérer mon abonnement » et « Résilier mon abonnement » : la loi québécoise
// (LPC art. 187.28) veut un bouton de résiliation « facilement repérable ». Sous le
// générateur, il fallait défiler pour le trouver (remarque de Jean, 2026-09-30) ;
// ici, il est en haut de chaque visite. Les boutons de l'espace client restent.
export default function MenuCompte({ lang }: { lang: 'fr' | 'en' }) {
  const [plan, setPlan] = useState('free');
  useEffect(() => {
    fetch('/api/user/stats').then(r => r.json()).then(d => setPlan(d.plan || 'free')).catch(() => {});
  }, []);
  const isPaid = plan === 'creator' || plan === 'pro' || plan === 'solo';
  const fr = lang === 'fr';

  if (!isPaid) return <UserButton />;

  return (
    <UserButton>
      <UserButton.MenuItems>
        <UserButton.Action
          label={fr ? 'Gérer mon abonnement' : 'Manage my subscription'}
          labelIcon={<Icon name="settings" size={16} />}
          onClick={() => { void ouvrirPortail('gerer', lang); }}
        />
        <UserButton.Action
          label={fr ? 'Résilier mon abonnement' : 'Cancel my subscription'}
          labelIcon={<Icon name="x" size={16} />}
          onClick={() => { void ouvrirPortail('resilier', lang); }}
        />
      </UserButton.MenuItems>
    </UserButton>
  );
}
