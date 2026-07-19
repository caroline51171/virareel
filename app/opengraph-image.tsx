import { ImageResponse } from 'next/og';

export const runtime = 'edge';
export const alt = 'ViraReel AI — Des scripts complets, prêts à publier, en quelques secondes';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

export default function Image() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '1200px',
          height: '630px',
          background: '#020617',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          fontFamily: 'sans-serif',
          padding: '60px',
        }}
      >
        {/* Badge */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            background: 'rgba(124, 58, 237, 0.2)',
            border: '1px solid rgba(139, 92, 246, 0.4)',
            borderRadius: '999px',
            padding: '8px 20px',
            marginBottom: '32px',
          }}
        >
          <span style={{ color: '#c4b5fd', fontSize: '18px', fontWeight: 500 }}>
            🚀 Générateur de contenu viral IA
          </span>
        </div>

        {/* Logo */}
        <div
          style={{
            fontSize: '80px',
            fontWeight: 900,
            background: 'linear-gradient(to right, #a78bfa, #f472b6)',
            backgroundClip: 'text',
            color: 'transparent',
            marginBottom: '20px',
            letterSpacing: '-2px',
          }}
        >
          ViraReel AI
        </div>

        {/* Subtitle */}
        <div
          style={{
            fontSize: '28px',
            color: '#94a3b8',
            textAlign: 'center',
            maxWidth: '700px',
            lineHeight: 1.4,
            marginBottom: '48px',
          }}
        >
          Des scripts complets, prêts à publier, en quelques secondes grâce à l&apos;IA
        </div>

        {/* Platforms */}
        <div style={{ display: 'flex', gap: '16px', marginBottom: '48px' }}>
          {['📸 Instagram', '🎵 TikTok', '👥 Facebook', '▶️ YouTube'].map((p) => (
            <div
              key={p}
              style={{
                background: 'rgba(30, 41, 59, 0.8)',
                border: '1px solid rgba(71, 85, 105, 0.6)',
                borderRadius: '999px',
                padding: '8px 18px',
                color: '#cbd5e1',
                fontSize: '16px',
              }}
            >
              {p}
            </div>
          ))}
        </div>

        {/* Domain */}
        <div style={{ color: '#475569', fontSize: '18px', letterSpacing: '1px' }}>
          virareelai.com
        </div>
      </div>
    ),
    { ...size }
  );
}
