import { ImageResponse } from 'next/og';
import { lirePartage, premiereAccroche } from '@/lib/partage';

// Aperçu du lien dans Messages, Messenger, WhatsApp… : l'ACCROCHE de la génération
// partagée, dans les couleurs du site. Lien inconnu → l'aperçu générique de la marque.

export const alt = 'ViraReel AI';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

export default async function Image({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const p = await lirePartage(id);
  const fr = p?.lang !== 'en';
  const brute = p ? premiereAccroche(p) : '';
  const accroche = brute.length > 140 ? `${brute.slice(0, 137).trimEnd()}…` : brute;

  return new ImageResponse(
    (
      <div
        style={{
          width: '1200px',
          height: '630px',
          background: '#020617',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          fontFamily: 'sans-serif',
          padding: '64px 72px',
        }}
      >
        <div
          style={{
            fontSize: '48px',
            fontWeight: 900,
            background: 'linear-gradient(to right, #a78bfa, #f472b6)',
            backgroundClip: 'text',
            color: 'transparent',
            letterSpacing: '-1px',
          }}
        >
          ViraReel AI
        </div>

        <div
          style={{
            display: 'flex',
            fontSize: accroche.length > 80 ? '52px' : '64px',
            fontWeight: 800,
            color: '#ffffff',
            lineHeight: 1.2,
          }}
        >
          {accroche ? `« ${accroche} »` : (fr ? 'Des scripts complets, prêts à publier, en quelques secondes' : 'Complete scripts, ready to post, in seconds')}
        </div>

        <div style={{ display: 'flex', fontSize: '28px', color: '#c4b5fd' }}>
          {fr ? 'Script de Reel créé avec ViraReel AI — créez le vôtre gratuitement' : 'Reel script made with ViraReel AI — create yours for free'}
        </div>
      </div>
    ),
    { ...size },
  );
}
