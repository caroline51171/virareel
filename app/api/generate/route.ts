import Anthropic from '@anthropic-ai/sdk';
import { createHmac } from 'crypto';
import { NextRequest, NextResponse } from 'next/server';
import { auth, clerkClient } from '@clerk/nextjs/server';

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const ADMIN_EMAILS = ['caroline51171@hotmail.fr'];
const ANON_LIMIT = 12;

// ─── Tracking anonyme (cookie signé + IP) ────────────────────────────────────

const ANON_SECRET =
  process.env.ANON_SECRET ||
  (process.env.CLERK_SECRET_KEY?.slice(0, 32) ?? 'virareel-anon-2026');

function getIP(req: NextRequest): string {
  return (
    req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    req.headers.get('x-real-ip') ||
    '0.0.0.0'
  );
}

function hashIP(ip: string): string {
  return createHmac('sha256', ANON_SECRET).update(ip).digest('hex').slice(0, 16);
}

interface AnonData { n: number; ip: string }

function parseAnonCookie(val: string | undefined): AnonData | null {
  if (!val) return null;
  try {
    const dot = val.lastIndexOf('.');
    if (dot < 0) return null;
    const payload = val.slice(0, dot);
    const sig = val.slice(dot + 1);
    const expected = createHmac('sha256', ANON_SECRET).update(payload).digest('hex').slice(0, 16);
    if (sig !== expected) return null;
    const data = JSON.parse(Buffer.from(payload, 'base64').toString('utf8'));
    if (typeof data.n !== 'number' || typeof data.ip !== 'string') return null;
    return data as AnonData;
  } catch { return null; }
}

function makeAnonCookie(n: number, ip: string): string {
  const payload = Buffer.from(JSON.stringify({ n, ip })).toString('base64');
  const sig = createHmac('sha256', ANON_SECRET).update(payload).digest('hex').slice(0, 16);
  return `${payload}.${sig}`;
}

// ─── Utilitaire date reset ────────────────────────────────────────────────────

function getNextResetDate(): string {
  const now = new Date();
  const next = new Date(now.getFullYear(), now.getMonth() + 1, 1);
  return next.toISOString().split('T')[0];
}

// ─── Route principale ─────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  try {
    const { topic, platform, tone, variations, lang, region } = await req.json();

    if (!topic || topic.trim().length < 3) {
      return NextResponse.json({ error: 'Topic too short' }, { status: 400 });
    }

    const cost = platform === 'all' ? 4 : 1;
    const { userId } = await auth();

    // Valeur du cookie à setter après génération réussie (uniquement pour les anonymes)
    let anonCookieValue: string | null = null;

    if (!userId) {
      // ── Utilisateur anonyme : cookie signé + IP ───────────────────────────
      const ip = getIP(req);
      const ipHash = hashIP(ip);
      const anonData = parseAnonCookie(req.cookies.get('virareel_anon')?.value);

      // Les deux doivent correspondre pour identifier le même utilisateur
      const anonCount = (anonData && anonData.ip === ipHash) ? anonData.n : 0;

      if (anonCount + cost > ANON_LIMIT) {
        return NextResponse.json(
          { error: 'anonymous_limit', used: anonCount, limit: ANON_LIMIT },
          { status: 429 }
        );
      }
      anonCookieValue = makeAnonCookie(anonCount + cost, ipHash);

    } else {
      // ── Utilisateur connecté ──────────────────────────────────────────────
      const clerk = await clerkClient();
      const user = await clerk.users.getUser(userId);
      const userEmail = user.emailAddresses[0]?.emailAddress?.toLowerCase() || '';
      const isAdminUser = ADMIN_EMAILS.includes(userEmail);
      const plan = (user.publicMetadata?.plan as string) || 'free';

      if (!isAdminUser) {
        if (plan === 'creator' || plan === 'pro') {
          const generationsLimit = (user.privateMetadata?.generationsLimit as number) ?? -1;

          // Vérifier limite uniquement si pas illimité (-1)
          if (generationsLimit !== -1) {
            const generationsUsed = (user.privateMetadata?.generationsUsed as number) || 0;

            if (generationsUsed + cost > generationsLimit) {
              return NextResponse.json(
                { error: 'limit_reached', generationsUsed, generationsLimit },
                { status: 429 }
              );
            }
          }
        }
      }
    }

    // ── Prompt Claude ─────────────────────────────────────────────────────────

    const isFr = lang === 'fr';
    const count = variations ? 3 : 1;

    const platformName =
      platform === 'tiktok' ? 'TikTok' :
      platform === 'instagram' ? 'Instagram Reels' :
      platform === 'youtube' ? 'YouTube Shorts' :
      platform === 'all' ? 'Instagram Reels, TikTok, Facebook Reels et YouTube Shorts' : 'Facebook Reels';

    const toneMap: Record<string, string> = {
      inspirational: isFr ? 'Inspirant et motivant' : 'Inspirational and motivating',
      funny: isFr ? 'Drôle et léger' : 'Funny and light',
      educational: isFr ? 'Éducatif et informatif' : 'Educational and informative',
      trendy: isFr ? 'Tendance et moderne' : 'Trendy and modern',
      emotional: isFr ? 'Émotionnel et touchant' : 'Emotional and touching',
    };
    const toneLabel = toneMap[tone] || (isFr ? 'Inspirant' : 'Inspirational');

    const regionContext: Record<string, string> = {
      'qc': 'pour une audience québécoise éduquée et créative : français québécois soigné, chaleureux et moderne. Vise des professionnels, entrepreneurs et créateurs cultivés. Humour intelligent, subtil et autodérisoire, universellement compris — aucune référence à des artistes, films ou tendances spécifiques. ABSOLUMENT AUCUN sacre, joual ou langage populaire. Ton raffiné mais jamais prétentieux.',
      'fr': 'pour une audience française cultivée : ton élégant, esprit vif et pince-sans-rire. Vise des professionnels et créateurs urbains. Humour subtil et ironique, universellement compris — aucune référence culturelle spécifique. Jamais vulgaire ni grossier. Évite les québécismes et le langage familier.',
      'be': 'pour une audience belge francophone éduquée : ton naturel, chaleureux et accessible. Vise des professionnels et créateurs cultivés. Humour autodérisoire et intelligent, universellement compris — aucune référence culturelle spécifique. Jamais vulgaire ni grossier.',
      'other-fr': 'pour une audience francophone internationale cultivée : langue claire, soignée et universelle, sans régionalismes. Humour intelligent et universellement compris — aucune référence culturelle spécifique. Accessible à tous les francophones éduqués.',
      'us': 'for an educated American audience: energetic, optimistic and smart. Target professionals, entrepreneurs and creatives. Witty and relatable humor, universally understood — no references tied to specific music, movies or trends. Bold but never crude or lowbrow.',
      'uk': 'for an educated British audience: dry wit, understatement and intelligent wordplay. Target professionals and creatives. Subtle, self-deprecating humor, universally understood — no references tied to specific music, films or trends. Never crude or lowbrow. Slightly reserved, never loud or brash.',
      'au': 'for an educated Australian audience: warm, self-deprecating and clever. Target professionals and creatives. Casual but intelligent humor, universally understood — no references tied to specific music, films or trends. Never vulgar or crude. Friendly and unpretentious without being lowbrow.',
      'ca-en': 'for an educated English-speaking Canadian audience: friendly, inclusive and smart. Target professionals and creatives. Warm and witty humor, universally understood — no references tied to specific music, films or trends. Never crude. Balanced and polished.',
      'other-en': 'for a global English-speaking audience: use clear, neutral, and universally understood English. Avoid slang, idioms, or cultural references specific to one country. Accessible to all educated English speakers worldwide.',
    };

    const culturalInstruction = region && regionContext[region]
      ? (isFr ? `\nAdapte le contenu ${regionContext[region]}` : `\nAdapt the content ${regionContext[region]}`)
      : '';

    const systemPrompt = isFr
      ? `Tu es un expert en création de contenu viral pour les réseaux sociaux. Tu génères des scripts de Reels ultra-viraux, percutants et engageants.${culturalInstruction} Tu réponds TOUJOURS en JSON valide exactement selon le schéma demandé. Pas de texte en dehors du JSON.`
      : `You are an expert in creating viral content for social media. You generate ultra-viral, punchy and engaging Reel scripts.${culturalInstruction} You ALWAYS respond in valid JSON exactly according to the requested schema. No text outside the JSON.`;

    const userPrompt = platform === 'all'
      ? (isFr
        ? `Génère du contenu viral DIFFÉRENT et ADAPTÉ pour chacune des 4 plateformes simultanément.

Sujet: ${topic}
Ton/Style: ${toneLabel}

Adapte chaque contenu aux spécificités de la plateforme (algorithme, audience, format).

Retourne EXACTEMENT ce JSON (et rien d'autre) :
{
  "instagram": {
    "hook": "accroche percutante de moins de 10 mots",
    "script": ["étape 1", "étape 2", "étape 3", "étape 4", "étape 5"],
    "screenText": ["MOT1", "MOT2", "MOT3"],
    "caption": "caption avec emojis et 5-8 hashtags Instagram",
    "bestTime": "ex: Mardi-Jeudi, 18h-21h"
  },
  "tiktok": {
    "hook": "accroche ultra-courte et accrocheuse TikTok",
    "script": ["étape 1", "étape 2", "étape 3", "étape 4"],
    "screenText": ["MOT1", "MOT2", "MOT3"],
    "caption": "caption TikTok avec hashtags tendance",
    "bestTime": "ex: Lundi-Vendredi, 19h-22h",
    "duration": "15s ou 30s ou 60s selon le sujet",
    "soundTrend": "suggestion de son tendance TikTok"
  },
  "facebook": {
    "hook": "accroche engageante pour Facebook",
    "script": ["étape 1", "étape 2", "étape 3", "étape 4", "étape 5"],
    "screenText": ["MOT1", "MOT2", "MOT3"],
    "caption": "caption Facebook plus longue et engageante avec hashtags",
    "bestTime": "ex: Mercredi-Vendredi, 12h-15h"
  },
  "youtube": {
    "hook": "accroche percutante pour YouTube Shorts",
    "script": ["étape 1", "étape 2", "étape 3", "étape 4", "étape 5"],
    "screenText": ["MOT1", "MOT2", "MOT3"],
    "caption": "caption YouTube avec hashtags",
    "bestTime": "ex: Samedi-Dimanche, 15h-20h",
    "ytTitle": "titre optimisé SEO YouTube de 60 caractères max",
    "seoDescription": "description YouTube 150-200 mots optimisée SEO",
    "keywords": ["mot-clé 1", "mot-clé 2", "mot-clé 3", "mot-clé 4", "mot-clé 5", "mot-clé 6", "mot-clé 7", "mot-clé 8"]
  }
}`
        : `Generate DIFFERENT viral content ADAPTED for each of the 4 platforms simultaneously.

Topic: ${topic}
Tone/Style: ${toneLabel}

Adapt each content to the platform's specifics (algorithm, audience, format).

Return EXACTLY this JSON (nothing else):
{
  "instagram": {
    "hook": "punchy hook under 10 words",
    "script": ["step 1", "step 2", "step 3", "step 4", "step 5"],
    "screenText": ["WORD1", "WORD2", "WORD3"],
    "caption": "caption with emojis and 5-8 Instagram hashtags",
    "bestTime": "e.g: Tue-Thu, 6pm-9pm"
  },
  "tiktok": {
    "hook": "ultra-short catchy TikTok hook",
    "script": ["step 1", "step 2", "step 3", "step 4"],
    "screenText": ["WORD1", "WORD2", "WORD3"],
    "caption": "TikTok caption with trending hashtags",
    "bestTime": "e.g: Mon-Fri, 7pm-10pm",
    "duration": "15s or 30s or 60s based on topic",
    "soundTrend": "trending TikTok sound suggestion"
  },
  "facebook": {
    "hook": "engaging hook for Facebook",
    "script": ["step 1", "step 2", "step 3", "step 4", "step 5"],
    "screenText": ["WORD1", "WORD2", "WORD3"],
    "caption": "longer engaging Facebook caption with hashtags",
    "bestTime": "e.g: Wed-Fri, 12pm-3pm"
  },
  "youtube": {
    "hook": "punchy YouTube Shorts hook",
    "script": ["step 1", "step 2", "step 3", "step 4", "step 5"],
    "screenText": ["WORD1", "WORD2", "WORD3"],
    "caption": "YouTube caption with hashtags",
    "bestTime": "e.g: Sat-Sun, 3pm-8pm",
    "ytTitle": "SEO-optimized YouTube title max 60 chars",
    "seoDescription": "YouTube description 150-200 words SEO-optimized",
    "keywords": ["keyword 1", "keyword 2", "keyword 3", "keyword 4", "keyword 5", "keyword 6", "keyword 7", "keyword 8"]
  }
}`)
      : (isFr
      ? `Génère ${count === 1 ? 'UN script' : '3 scripts DIFFÉRENTS'} de Reel viral pour ${platformName}.

Sujet: ${topic}
Ton/Style: ${toneLabel}
Plateforme: ${platformName}

${count === 1
  ? `Retourne EXACTEMENT ce JSON (et rien d'autre) :
{
  "hook": "accroche percutante de moins de 10 mots",
  "script": ["étape 1", "étape 2", "étape 3", "étape 4", "étape 5"],
  "screenText": ["MOT1", "MOT2", "MOT3"],
  "caption": "caption complète avec emojis et 5-8 hashtags",
  "bestTime": "ex: Mardi-Jeudi, 18h-21h",
  ${platform === 'tiktok' ? '"duration": "15s ou 30s ou 60s selon ton analyse",' : ''}
  ${platform === 'tiktok' ? '"soundTrend": "suggestion de son tendance TikTok"' : '"soundTrend": null'}${platform === 'youtube' ? `,
  "ytTitle": "titre optimisé SEO YouTube de 60 caractères max avec mot-clé principal",
  "seoDescription": "description YouTube de 150-200 mots optimisée SEO avec mots-clés naturellement intégrés, appel à l'action, et timestamps si pertinent",
  "keywords": ["mot-clé 1", "mot-clé 2", "mot-clé 3", "mot-clé 4", "mot-clé 5", "mot-clé 6", "mot-clé 7", "mot-clé 8"]` : ''}
}`
  : `Retourne EXACTEMENT ce JSON (et rien d'autre) avec 3 variations :
{
  "variations": [
    {
      "hook": "accroche 1",
      "script": ["étape 1", "étape 2", "étape 3", "étape 4"],
      "screenText": ["MOT1", "MOT2", "MOT3"],
      "caption": "caption 1 avec emojis et hashtags",
      "bestTime": "ex: Lundi-Mercredi, 12h-14h",
      ${platform === 'tiktok' ? '"duration": "7s ou 15s ou 30s",' : ''}
      ${platform === 'tiktok' ? '"soundTrend": "son tendance 1"' : '"soundTrend": null'}${platform === 'youtube' ? `,
      "ytTitle": "titre YouTube optimisé SEO variation 1",
      "seoDescription": "description SEO YouTube variation 1",
      "keywords": ["mot-clé 1", "mot-clé 2", "mot-clé 3", "mot-clé 4", "mot-clé 5"]` : ''}
    },
    {
      "hook": "accroche 2 DIFFÉRENTE",
      "script": ["étape 1", "étape 2", "étape 3", "étape 4"],
      "screenText": ["MOT1", "MOT2", "MOT3"],
      "caption": "caption 2 différente",
      "bestTime": "ex: Vendredi-Dimanche, 19h-22h",
      ${platform === 'tiktok' ? '"duration": "7s ou 15s ou 30s",' : ''}
      ${platform === 'tiktok' ? '"soundTrend": "son tendance 2"' : '"soundTrend": null'}${platform === 'youtube' ? `,
      "ytTitle": "titre YouTube optimisé SEO variation 2",
      "seoDescription": "description SEO YouTube variation 2",
      "keywords": ["mot-clé 1", "mot-clé 2", "mot-clé 3", "mot-clé 4", "mot-clé 5"]` : ''}
    },
    {
      "hook": "accroche 3 DIFFÉRENTE",
      "script": ["étape 1", "étape 2", "étape 3"],
      "screenText": ["MOT1", "MOT2", "MOT3"],
      "caption": "caption 3 différente",
      "bestTime": "ex: Mardi-Jeudi, 7h-9h",
      ${platform === 'tiktok' ? '"duration": "7s ou 15s ou 60s",' : ''}
      ${platform === 'tiktok' ? '"soundTrend": "son tendance 3"' : '"soundTrend": null'}${platform === 'youtube' ? `,
      "ytTitle": "titre YouTube optimisé SEO variation 3",
      "seoDescription": "description SEO YouTube variation 3",
      "keywords": ["mot-clé 1", "mot-clé 2", "mot-clé 3", "mot-clé 4", "mot-clé 5"]` : ''}
    }
  ]
}`
}`
      : `Generate ${count === 1 ? 'ONE script' : '3 DIFFERENT scripts'} for a viral ${platformName} Reel.

Topic: ${topic}
Tone/Style: ${toneLabel}
Platform: ${platformName}

${count === 1
  ? `Return EXACTLY this JSON (nothing else):
{
  "hook": "punchy hook under 10 words",
  "script": ["step 1", "step 2", "step 3", "step 4", "step 5"],
  "screenText": ["WORD1", "WORD2", "WORD3"],
  "caption": "full caption with emojis and 5-8 hashtags",
  "bestTime": "e.g: Tue-Thu, 6pm-9pm",
  ${platform === 'tiktok' ? '"duration": "15s or 30s or 60s based on your analysis",' : ''}
  ${platform === 'tiktok' ? '"soundTrend": "trending TikTok sound suggestion"' : '"soundTrend": null'}${platform === 'youtube' ? `,
  "ytTitle": "SEO-optimized YouTube title max 60 chars with main keyword",
  "seoDescription": "YouTube description 150-200 words SEO-optimized with keywords naturally integrated, call to action, and timestamps if relevant",
  "keywords": ["keyword 1", "keyword 2", "keyword 3", "keyword 4", "keyword 5", "keyword 6", "keyword 7", "keyword 8"]` : ''}
}`
  : `Return EXACTLY this JSON (nothing else) with 3 variations:
{
  "variations": [
    {
      "hook": "hook 1",
      "script": ["step 1", "step 2", "step 3", "step 4"],
      "screenText": ["WORD1", "WORD2", "WORD3"],
      "caption": "caption 1 with emojis and hashtags",
      "bestTime": "e.g: Mon-Wed, 12pm-2pm",
      ${platform === 'tiktok' ? '"duration": "7s or 15s or 30s",' : ''}
      ${platform === 'tiktok' ? '"soundTrend": "trending sound 1"' : '"soundTrend": null'}${platform === 'youtube' ? `,
      "ytTitle": "SEO-optimized YouTube title variation 1",
      "seoDescription": "SEO YouTube description variation 1",
      "keywords": ["keyword 1", "keyword 2", "keyword 3", "keyword 4", "keyword 5"]` : ''}
    },
    {
      "hook": "DIFFERENT hook 2",
      "script": ["step 1", "step 2", "step 3", "step 4"],
      "screenText": ["WORD1", "WORD2", "WORD3"],
      "caption": "different caption 2",
      "bestTime": "e.g: Fri-Sun, 7pm-10pm",
      ${platform === 'tiktok' ? '"duration": "7s or 15s or 30s",' : ''}
      ${platform === 'tiktok' ? '"soundTrend": "trending sound 2"' : '"soundTrend": null'}${platform === 'youtube' ? `,
      "ytTitle": "SEO-optimized YouTube title variation 2",
      "seoDescription": "SEO YouTube description variation 2",
      "keywords": ["keyword 1", "keyword 2", "keyword 3", "keyword 4", "keyword 5"]` : ''}
    },
    {
      "hook": "DIFFERENT hook 3",
      "script": ["step 1", "step 2", "step 3"],
      "screenText": ["WORD1", "WORD2", "WORD3"],
      "caption": "different caption 3",
      "bestTime": "e.g: Tue-Thu, 7am-9am",
      ${platform === 'tiktok' ? '"duration": "7s or 15s or 60s",' : ''}
      ${platform === 'tiktok' ? '"soundTrend": "trending sound 3"' : '"soundTrend": null'}${platform === 'youtube' ? `,
      "ytTitle": "SEO-optimized YouTube title variation 3",
      "seoDescription": "SEO YouTube description variation 3",
      "keywords": ["keyword 1", "keyword 2", "keyword 3", "keyword 4", "keyword 5"]` : ''}
    }
  ]
}`
}`);

    const message = await client.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: platform === 'all' ? 5000 : 2000,
      system: systemPrompt,
      messages: [{ role: 'user', content: userPrompt }],
    });

    const raw = (message.content[0] as { type: string; text: string }).text.trim();
    const jsonMatch = raw.match(/```(?:json)?\s*([\s\S]*?)```/) || [null, raw];
    const jsonStr = jsonMatch[1].trim();
    const data = JSON.parse(jsonStr);

    // ── Sauvegarde historique + incrément compteur ────────────────────────────
    try {
      if (userId) {
        const clerk = await clerkClient();
        const user = await clerk.users.getUser(userId);
        const userEmail = user.emailAddresses[0]?.emailAddress?.toLowerCase() || '';
        const isAdminUser = ADMIN_EMAILS.includes(userEmail);
        const plan = (user.publicMetadata?.plan as string) || 'free';

        const existing = (user.privateMetadata?.history as any[]) || [];
        const entry = {
          id: Date.now(),
          date: new Date().toISOString(),
          topic: topic.slice(0, 100),
          platform,
          lang,
          hook: data.hook || data.variations?.[0]?.hook || '',
          caption: data.caption || data.variations?.[0]?.caption || '',
        };
        // Pro : historique 100 entrées (90 jours géré côté affichage) ; autres : 20
        const historyLimit = plan === 'pro' ? 100 : 20;
        const updatedHistory = [entry, ...existing].slice(0, historyLimit);

        if (!isAdminUser) {
          if (plan === 'creator' || plan === 'pro') {
            const generationsUsed = (user.privateMetadata?.generationsUsed as number) || 0;
            await clerk.users.updateUserMetadata(userId, {
              privateMetadata: { history: updatedHistory, generationsUsed: generationsUsed + cost },
            });
          } else {
            // Plan gratuit : sauvegarder l'historique seulement
            await clerk.users.updateUserMetadata(userId, {
              privateMetadata: { history: updatedHistory },
            });
          }
        } else {
          await clerk.users.updateUserMetadata(userId, {
            privateMetadata: { history: updatedHistory },
          });
        }
      }
    } catch {
      // Ne pas bloquer la génération si la sauvegarde échoue
    }

    // ── Réponse : cookie anonyme si applicable ────────────────────────────────
    const response = NextResponse.json(data);
    if (anonCookieValue) {
      response.cookies.set('virareel_anon', anonCookieValue, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        maxAge: 60 * 60 * 24 * 365,
        sameSite: 'lax',
        path: '/',
      });
    }
    return response;

  } catch (err) {
    console.error('Generate error:', err);
    return NextResponse.json({ error: 'Generation failed' }, { status: 500 });
  }
}
