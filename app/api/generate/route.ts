import Anthropic from '@anthropic-ai/sdk';
import { createHmac } from 'crypto';
import { NextRequest, NextResponse } from 'next/server';
import { auth, clerkClient } from '@clerk/nextjs/server';

export const maxDuration = 60;

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const ADMIN_EMAILS = ['caroline51171@gmail.com', 'caroline51171@hotmail.fr'];
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
    const isEducational = tone === 'educational';

    // Recette par ton pour Instagram (algorithme juillet 2026 : complétion + partages)
    const igToneRecipeMap: Record<string, { fr: string; en: string }> = {
      inspirational: {
        fr: `Ton INSPIRANT : mini-récit (galère → déclic → résultat) avec un texte réflexif et une chute qui donne de l'élan. Vise 20-35s. Optimise pour les SAUVEGARDES et les partages.`,
        en: `INSPIRATIONAL tone: mini-story (struggle → turning point → result) with reflective text and an uplifting ending. Aim 20-35s. Optimize for SAVES and shares.`,
      },
      funny: {
        fr: `Ton DRÔLE : garde très court (7-15s), prémisse absurde et ULTRA-précise, rythme rapide, payoff immédiat. Optimise pour "envoie ça à un ami".`,
        en: `FUNNY tone: keep it very short (7-15s), absurd and ULTRA-specific premise, fast pace, immediate payoff. Optimize for "send this to a friend".`,
      },
      educational: {
        fr: `Ton ÉDUCATIF : structure problème → solution → 1-2 détails clés, laisse le temps de digérer, vise 20-40s. Optimise pour les SAUVEGARDES ("garde ça pour plus tard").`,
        en: `EDUCATIONAL tone: structure problem → solution → 1-2 key details, allow time to process, aim 20-40s. Optimize for SAVES ("save this for later").`,
      },
      trendy: {
        fr: `Ton TENDANCE : appuie-toi sur un format ou un son du moment, reste vif (10-20s), glisse une référence culturelle actuelle, énergie moderne.`,
        en: `TRENDY tone: lean on a current format or trending sound, stay snappy (10-20s), drop a current cultural reference, modern energy.`,
      },
      emotional: {
        fr: `Ton ÉMOTIONNEL : raconte une histoire authentique avec un arc émotionnel (tension → résolution), vise 20-35s. Optimise pour la connexion → partages et sauvegardes.`,
        en: `EMOTIONAL tone: tell an authentic story with an emotional arc (tension → resolution), aim 20-35s. Optimize for connection → shares and saves.`,
      },
    };
    const igToneRecipe = (igToneRecipeMap[tone] || igToneRecipeMap.inspirational)[isFr ? 'fr' : 'en'];

    const platformInstruction = isFr
      ? (platform === 'tiktok'
        ? `Script TikTok — 4 étapes : Hook (0-3s, max 12 mots, ultra-choc, doit accrocher en 2 secondes max), Promise (3-8s, dis ce que le viewer va gagner en restant), Proof/Valeur (le corps — intègre les mots-clés du sujet naturellement dans les phrases parlées car TikTok transcrit l'audio), CTA (5-10 dernières secondes). ${isEducational ? '70-90 mots.' : '50-75 mots.'} Énergie maximale, ton énergique, chaque mot compte.`
        : platform === 'instagram'
        ? `Script Instagram optimisé pour l'algorithme de juillet 2026 — le TAUX DE COMPLÉTION (regarder jusqu'au bout) et les PARTAGES EN DM sont les signaux n°1. Structure en 4 temps : 1) Hook dit à voix haute DÈS la 1re seconde — un POV, une prémisse ou une promesse ultra-précise ; une AFFIRMATION-choc OU une QUESTION / mystère visuel qui crée un manque à combler sont tous deux permis (doit se comprendre en 1 seconde par un inconnu). 2) Promise + repère de progression : annonce la récompense ET plante un jalon qui fait rester jusqu'au bout (ex: "reste jusqu'à la fin pour..."). 3) Proof/Valeur : corps DENSE, sans temps mort, ton authentique et humain (jamais robotique ni générique). 4) Payoff + CTA : livre un vrai "aha" satisfaisant À LA FIN (pas de conclusion molle), puis pousse au partage en DM à une personne précise (ex: "envoie ça à..." / "tag quelqu'un qui...") — les partages DM comptent 3 à 5x plus que les likes. RÈGLE D'OR : le hook doit rester COHÉRENT avec le contenu — ne promets jamais plus que ce que la vidéo livre, sinon l'abandon en cours de route fait chuter la portée. screenText : 2-4 courtes phrases-choc lisibles SANS son, dont la 1re nomme la scène/situation EXACTE pour que la bonne personne se sente visée. Adapte le vocabulaire et les codes à la niche du sujet. ${igToneRecipe}`
        : platform === 'facebook'
        ? `Script Facebook — 4 étapes : Hook (0-3s, max 12 mots, ultra-choc), Promise (dis ce que le viewer gagne en restant), Proof/Valeur (développé avec storytelling, audience plus patiente), CTA (appel à l'action engageant — commentaire ou partage). ${isEducational ? '90-120 mots.' : '60-90 mots.'} Plus de profondeur, narration solide.`
        : platform === 'youtube'
        ? `Script YouTube Shorts — 4 étapes CRITIQUES : Hook (0-3s, ABSOLUMENT max 10 mots, les 3 premières secondes décident si l'algo propulse ou enterre le Short), Promise (3-8s, promesse claire), Proof/Valeur (prononce les mots-clés principaux du sujet à voix haute dans les 5 premières secondes, exemples concrets), CTA (abonnement ou action). ${isEducational ? '100-130 mots.' : '70-100 mots.'} Varie la formule du hook à chaque fois.`
        : `Adapte la longueur et l'énergie à chaque plateforme : TikTok = énergique (50-75 mots), Instagram = authentique (40-60 mots), Facebook = storytelling (60-90 mots), YouTube = structuré avec mots-clés parlés (70-100 mots). TOUTES les plateformes utilisent la structure 4 étapes : Hook / Promise / Proof/Valeur / CTA.`)
      : (platform === 'tiktok'
        ? `TikTok script — 4 steps: Hook (0-3s, max 12 words, ultra-shocking, must hook in 2 seconds max), Promise (3-8s, tell viewer what they gain by staying), Proof/Value (body — naturally integrate topic keywords in spoken sentences because TikTok transcribes audio for search), CTA (last 5-10 seconds). ${isEducational ? '70-90 words.' : '50-75 words.'} Maximum energy, energetic tone, every word counts.`
        : platform === 'instagram'
        ? `Instagram script optimized for the July 2026 algorithm — COMPLETION RATE (watching to the end) and DM SHARES are the #1 signals. 4-part structure: 1) Hook said out loud in the VERY FIRST second — a POV, a premise or an ultra-specific promise; a bold STATEMENT OR a QUESTION / visual mystery that creates a curiosity gap are both allowed (a stranger must get it in 1 second). 2) Promise + progression cue: state the payoff AND plant a marker that keeps them watching to the end (e.g. "stay till the end for..."). 3) Proof/Value: DENSE body, no dead time, authentic and human tone (never robotic or generic). 4) Payoff + CTA: deliver a real satisfying "aha" AT THE END (no weak wrap-up), then drive a DM share to one specific person (e.g. "send this to..." / "tag someone who...") — DM shares count 3-5x more than likes. GOLDEN RULE: the hook must stay COHERENT with the content — never promise more than the video delivers, or mid-video drop-off tanks reach. screenText: 2-4 short punchy on-screen lines readable WITHOUT sound, the first one naming the EXACT scene/situation so the right person feels seen. Adapt vocabulary and codes to the topic's niche. ${igToneRecipe}`
        : platform === 'facebook'
        ? `Facebook script — 4 steps: Hook (0-3s, max 12 words, ultra-shocking), Promise (tell viewer what they gain by staying), Proof/Value (developed with storytelling, more patient audience), CTA (engaging call to action — comment or share). ${isEducational ? '90-120 words.' : '60-90 words.'} More depth, solid narrative.`
        : platform === 'youtube'
        ? `YouTube Shorts script — 4 CRITICAL steps: Hook (0-3s, ABSOLUTELY max 10 words, first 3 seconds decide if algo promotes or buries the Short), Promise (3-8s, clear promise), Proof/Value (say main topic keywords out loud in the first 5 seconds, concrete examples), CTA (subscribe or action). ${isEducational ? '100-130 words.' : '70-100 words.'} Vary the hook formula every time.`
        : `Adapt length and energy to each platform: TikTok = energetic (50-75 words), Instagram = authentic (40-60 words), Facebook = storytelling (60-90 words), YouTube = structured with spoken keywords (70-100 words). ALL platforms use the 4-step structure: Hook / Promise / Proof/Value / CTA.`);

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
      ? `Tu es un expert en création de contenu viral pour les réseaux sociaux en 2026. Tu génères des scripts de Reels ultra-viraux, percutants et engageants.${culturalInstruction} Ton audience cible est composée de professionnels, créateurs et entrepreneurs cultivés. Le contenu doit être de haute qualité, intelligent et jamais simpliste, vulgaire ou racoleur — quel que soit le ton choisi.

Structure du script à TOUJOURS respecter (4 étapes) :
1. Hook (0-3s) : max 10-14 mots, ultra-choc, DOIT utiliser l'une de ces formules virales :
   - Contrarian Claim : "X n'est PAS ce que tu crois"
   - Mistake Warning : "Tu fais cette erreur sans le savoir"
   - List Tease : "3 raisons pour lesquelles tu..."
   - POV : "POV : tu viens de découvrir..."
   - Specific Outcome : "Comment je suis passé de X à Y en Z jours"
2. Promise (3-8s) : 1 phrase — dis exactement ce que le viewer va gagner en restant jusqu'à la fin
3. Proof/Valeur : le corps du contenu — la substance, les conseils, les révélations concrètes
4. CTA (5-10 dernières secondes) : 1 seule action claire et directe

Stratégie hashtags : 1 hashtag large (#fyp ou équivalent plateforme) + 2-3 hashtags de catégorie + 2-3 hashtags niche-spécifiques = 5-8 hashtags au total. ÉVITER les hashtags avec des milliards de posts car ils noient le contenu.

Longueur et format : ${platformInstruction} Pas de remplissage inutile.

Tu réponds TOUJOURS en JSON valide exactement selon le schéma demandé. Pas de texte en dehors du JSON.`
      : `You are an expert in creating viral content for social media in 2026. You generate ultra-viral, punchy and engaging Reel scripts.${culturalInstruction} Your target audience is made up of educated professionals, creatives and entrepreneurs. Content must be high quality, intelligent and never simplistic, vulgar or cheap — regardless of the chosen tone.

Script structure to ALWAYS follow (4 steps):
1. Hook (0-3s): max 10-14 words, ultra-shocking, MUST use one of these viral formulas:
   - Contrarian Claim: "X is NOT what you think"
   - Mistake Warning: "You're making this mistake without knowing it"
   - List Tease: "3 reasons why you..."
   - POV: "POV: you just discovered..."
   - Specific Outcome: "How I went from X to Y in Z days"
2. Promise (3-8s): 1 sentence — tell the viewer exactly what they'll gain by watching to the end
3. Proof/Value: the body of the content — the substance, tips, concrete revelations
4. CTA (last 5-10 seconds): 1 single clear and direct action

Hashtag strategy: 1 broad hashtag (#fyp or platform equivalent) + 2-3 category hashtags + 2-3 niche-specific hashtags = 5-8 total. AVOID hashtags with billions of posts as they bury the content.

Length and format: ${platformInstruction} No filler.

You ALWAYS respond in valid JSON exactly according to the requested schema. No text outside the JSON.`;

    const userPrompt = platform === 'all'
      ? (isFr
        ? `Génère du contenu viral DIFFÉRENT et ADAPTÉ pour chacune des 4 plateformes simultanément.

Sujet: ${topic}
Ton/Style: ${toneLabel}

Adapte chaque contenu aux spécificités de la plateforme (algorithme, audience, format).

Retourne EXACTEMENT ce JSON (et rien d'autre) :
{
  "instagram": {
    "hook": "accroche ultra-choc max 12 mots (formule virale : Contrarian/Mistake/List/POV/Outcome)",
    "script": ["Hook (0-3s) : max 12 mots, formule virale", "Promise (3-8s) : ce que le viewer gagne en restant", "Proof/Valeur : le corps, ton authentique et direct", "CTA : donne envie de l'envoyer par DM à une personne précise (ex: 'envoie ça à...', 'tag quelqu'un qui...')"],
    "screenText": ["MOT1", "MOT2", "MOT3"],
    "caption": "2-3 lignes de valeur après le hook de caption, puis question engageante pour commentaires. Emojis + 1 hashtag large + 2-3 hashtags catégorie + 2-3 hashtags niche = 5-8 hashtags. Note finale : 'Tip : teste ce Reel en Trial Reels pour atteindre de nouveaux audiences.'",
    "bestTime": "ex: Mardi-Jeudi, 18h-21h"
  },
  "tiktok": {
    "hook": "accroche ultra-choc max 12 mots, accroche en 2 secondes (formule virale : Contrarian/Mistake/List/POV/Outcome)",
    "script": ["Hook (0-3s) : max 12 mots, accroche en 2s max", "Promise (3-8s) : ce que le viewer gagne en restant", "Proof/Valeur : corps avec mots-clés du sujet intégrés naturellement dans les phrases parlées (TikTok transcrit l'audio pour la recherche)", "CTA : action directe et énergique"],
    "screenText": ["MOT1", "MOT2", "MOT3"],
    "caption": "caption TikTok avec 1 hashtag large (#fyp ou #pourtoi) + 2-3 hashtags catégorie + 2-3 hashtags niche = 5-8 hashtags. Éviter les hashtags avec des milliards de posts.",
    "bestTime": "ex: Lundi-Vendredi, 19h-22h",
    "duration": "15s ou 30s selon le sujet",
    "soundTrend": "suggestion de son tendance TikTok"
  },
  "facebook": {
    "hook": "accroche ultra-choc max 12 mots (formule virale : Contrarian/Mistake/List/POV/Outcome)",
    "script": ["Hook (0-3s) : max 12 mots, formule virale", "Promise (3-8s) : ce que le viewer gagne en restant", "Proof/Valeur : développé avec storytelling, audience plus patiente", "CTA : commentaire ou partage engageant"],
    "screenText": ["MOT1", "MOT2", "MOT3"],
    "caption": "caption Facebook plus longue et engageante. 1 hashtag large + 2-3 hashtags catégorie + 2-3 hashtags niche = 5-8 hashtags.",
    "bestTime": "ex: Mercredi-Vendredi, 12h-15h"
  },
  "youtube": {
    "hook": "accroche ultra-choc ABSOLUMENT max 10 mots — les 3 premières secondes décident si YouTube propulse ou enterre le Short (formule virale différente à chaque génération)",
    "script": ["Hook (0-3s) : ABSOLUMENT max 10 mots, formule virale — l'algo décide en 30-60 min", "Promise (3-8s) : promesse claire + prononce les mots-clés principaux à voix haute dans les 5 premières secondes", "Proof/Valeur : exemples concrets, structure claire", "CTA : abonnement ou action"],
    "screenText": ["MOT1", "MOT2", "MOT3"],
    "caption": "caption YouTube avec 1 hashtag large + 2-3 hashtags catégorie + 2-3 hashtags niche = 5-8 hashtags.",
    "bestTime": "ex: Samedi-Dimanche, 15h-20h",
    "ytTitle": "titre optimisé SEO YouTube de 60 caractères max avec mot-clé principal",
    "seoDescription": "description YouTube 150-200 mots optimisée SEO avec mots-clés naturellement intégrés, appel à l'action, et timestamps si pertinent",
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
    "hook": "ultra-shocking hook max 12 words (viral formula: Contrarian/Mistake/List/POV/Outcome)",
    "script": ["Hook (0-3s): max 12 words, viral formula", "Promise (3-8s): what viewer gains by staying", "Proof/Value: body, authentic and direct tone", "CTA: make them want to send it by DM to one specific person (e.g. 'send this to...', 'tag someone who...')"],
    "screenText": ["WORD1", "WORD2", "WORD3"],
    "caption": "2-3 lines of value after the caption hook, then engaging question for comments. Emojis + 1 broad hashtag + 2-3 category hashtags + 2-3 niche hashtags = 5-8 hashtags. Final note: 'Tip: test this Reel as Trial Reels to reach new audiences.'",
    "bestTime": "e.g: Tue-Thu, 6pm-9pm"
  },
  "tiktok": {
    "hook": "ultra-shocking hook max 12 words, hooks in 2 seconds (viral formula: Contrarian/Mistake/List/POV/Outcome)",
    "script": ["Hook (0-3s): max 12 words, hooks in 2s max", "Promise (3-8s): what viewer gains by staying", "Proof/Value: body with topic keywords naturally integrated in spoken sentences (TikTok transcribes audio for search)", "CTA: direct and energetic action"],
    "screenText": ["WORD1", "WORD2", "WORD3"],
    "caption": "TikTok caption with 1 broad hashtag (#fyp or #foryou) + 2-3 category hashtags + 2-3 niche hashtags = 5-8 hashtags. Avoid hashtags with billions of posts.",
    "bestTime": "e.g: Mon-Fri, 7pm-10pm",
    "duration": "15s or 30s based on topic",
    "soundTrend": "trending TikTok sound suggestion"
  },
  "facebook": {
    "hook": "ultra-shocking hook max 12 words (viral formula: Contrarian/Mistake/List/POV/Outcome)",
    "script": ["Hook (0-3s): max 12 words, viral formula", "Promise (3-8s): what viewer gains by staying", "Proof/Value: developed with storytelling, more patient audience", "CTA: engaging comment or share"],
    "screenText": ["WORD1", "WORD2", "WORD3"],
    "caption": "longer engaging Facebook caption. 1 broad hashtag + 2-3 category hashtags + 2-3 niche hashtags = 5-8 hashtags.",
    "bestTime": "e.g: Wed-Fri, 12pm-3pm"
  },
  "youtube": {
    "hook": "ultra-shocking hook ABSOLUTELY max 10 words — first 3 seconds decide if YouTube propels or buries the Short (use a different viral formula each generation)",
    "script": ["Hook (0-3s): ABSOLUTELY max 10 words, viral formula — algo decides in 30-60 min", "Promise (3-8s): clear promise + say main topic keywords out loud in the first 5 seconds", "Proof/Value: concrete examples, clear structure", "CTA: subscribe or action"],
    "screenText": ["WORD1", "WORD2", "WORD3"],
    "caption": "YouTube caption with 1 broad hashtag + 2-3 category hashtags + 2-3 niche hashtags = 5-8 hashtags.",
    "bestTime": "e.g: Sat-Sun, 3pm-8pm",
    "ytTitle": "SEO-optimized YouTube title max 60 chars with main keyword",
    "seoDescription": "YouTube description 150-200 words SEO-optimized with keywords naturally integrated, call to action, and timestamps if relevant",
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
  "hook": "${platform === 'instagram' ? 'accroche dite dès la 1re seconde — POV, prémisse ou promesse ultra-précise ; affirmation OU question/mystère ; cohérente avec le payoff' : 'accroche ultra-choc max 12 mots (formule virale : Contrarian/Mistake/List/POV/Outcome)'}",
  "script": ["Hook (0-3s) : ${platform === 'instagram' ? 'dit dès la 1re seconde, POV/prémisse/promesse' : 'max 12 mots, formule virale'}", "Promise (3-8s) : ce que le viewer gagne en restant${platform === 'instagram' ? ' + repère de progression (ex: reste pour la chute finale...)' : ''}", "Proof/Valeur : le corps du contenu${platform === 'tiktok' ? ' — mots-clés du sujet intégrés dans les phrases parlées' : platform === 'youtube' ? ' — mots-clés prononcés dans les 5 premières secondes' : ''}", "CTA : ${platform === 'instagram' ? "payoff satisfaisant à la fin, puis envie de l'envoyer par DM à une personne précise (ex: 'envoie ça à...', 'tag quelqu'un qui...')" : platform === 'youtube' ? 'abonnement ou action claire' : '1 action directe et claire'}"],
  "screenText": [${platform === 'instagram' ? '"phrase-choc nommant la scène EXACTE (lisible sans son)", "2e phrase courte", "3e phrase courte"' : '"MOT1", "MOT2", "MOT3"'}],
  "caption": "${platform === 'instagram' ? '2-3 lignes de valeur + question engageante. Emojis + 1 hashtag large + 2-3 hashtags catégorie + 2-3 hashtags niche = 5-8 hashtags. Terminer par : Tip : teste ce Reel en Trial Reels pour atteindre de nouveaux audiences.' : platform === 'tiktok' ? '1 hashtag large (#fyp ou #pourtoi) + 2-3 hashtags catégorie + 2-3 hashtags niche = 5-8 hashtags. Éviter les hashtags avec des milliards de posts.' : '1 hashtag large + 2-3 hashtags catégorie + 2-3 hashtags niche = 5-8 hashtags.'}",
  "bestTime": "ex: Mardi-Jeudi, 18h-21h",
  ${platform === 'tiktok' ? '"duration": "15s ou 30s selon ton analyse",' : ''}
  ${platform === 'tiktok' ? '"soundTrend": "suggestion de son tendance TikTok"' : '"soundTrend": null'}${platform === 'youtube' ? `,
  "ytTitle": "titre optimisé SEO YouTube de 60 caractères max avec mot-clé principal",
  "seoDescription": "description YouTube de 150-200 mots optimisée SEO avec mots-clés naturellement intégrés, appel à l'action, et timestamps si pertinent",
  "keywords": ["mot-clé 1", "mot-clé 2", "mot-clé 3", "mot-clé 4", "mot-clé 5", "mot-clé 6", "mot-clé 7", "mot-clé 8"]` : ''}
}`
  : `Retourne EXACTEMENT ce JSON (et rien d'autre) avec 3 variations — chaque hook doit utiliser une formule virale DIFFÉRENTE (Contrarian, Mistake, List, POV, Outcome) :
{
  "variations": [
    {
      "hook": "accroche 1 — formule Contrarian ou Mistake",
      "script": ["Hook (0-3s) : max 12 mots, formule virale", "Promise (3-8s) : ce que le viewer gagne en restant", "Proof/Valeur : le corps${platform === 'tiktok' ? ' — mots-clés intégrés dans les phrases parlées' : platform === 'youtube' ? ' — mots-clés prononcés dans les 5 premières secondes' : ''}", "CTA : ${platform === 'instagram' ? "envie de l'envoyer par DM à une personne précise" : '1 action directe'}"],
      "screenText": ["MOT1", "MOT2", "MOT3"],
      "caption": "caption 1 avec emojis + 1 hashtag large + 2-3 hashtags catégorie + 2-3 hashtags niche = 5-8 hashtags",
      "bestTime": "ex: Lundi-Mercredi, 12h-14h",
      ${platform === 'tiktok' ? '"duration": "15s ou 30s",' : ''}
      ${platform === 'tiktok' ? '"soundTrend": "son tendance 1"' : '"soundTrend": null'}${platform === 'youtube' ? `,
      "ytTitle": "titre YouTube optimisé SEO variation 1",
      "seoDescription": "description SEO YouTube variation 1",
      "keywords": ["mot-clé 1", "mot-clé 2", "mot-clé 3", "mot-clé 4", "mot-clé 5"]` : ''}
    },
    {
      "hook": "accroche 2 DIFFÉRENTE — formule List ou POV",
      "script": ["Hook (0-3s) : max 12 mots, formule virale différente", "Promise (3-8s) : ce que le viewer gagne en restant", "Proof/Valeur : le corps${platform === 'tiktok' ? ' — mots-clés intégrés dans les phrases parlées' : platform === 'youtube' ? ' — mots-clés prononcés dans les 5 premières secondes' : ''}", "CTA : ${platform === 'instagram' ? "envie différente de l'envoyer par DM à une personne précise" : '1 action directe'}"],
      "screenText": ["MOT1", "MOT2", "MOT3"],
      "caption": "caption 2 différente avec 1 hashtag large + 2-3 hashtags catégorie + 2-3 hashtags niche = 5-8 hashtags",
      "bestTime": "ex: Vendredi-Dimanche, 19h-22h",
      ${platform === 'tiktok' ? '"duration": "15s ou 30s",' : ''}
      ${platform === 'tiktok' ? '"soundTrend": "son tendance 2"' : '"soundTrend": null'}${platform === 'youtube' ? `,
      "ytTitle": "titre YouTube optimisé SEO variation 2",
      "seoDescription": "description SEO YouTube variation 2",
      "keywords": ["mot-clé 1", "mot-clé 2", "mot-clé 3", "mot-clé 4", "mot-clé 5"]` : ''}
    },
    {
      "hook": "accroche 3 DIFFÉRENTE — formule Specific Outcome ou autre",
      "script": ["Hook (0-3s) : max 12 mots, troisième formule virale", "Promise (3-8s) : ce que le viewer gagne en restant", "Proof/Valeur : le corps${platform === 'tiktok' ? ' — mots-clés intégrés dans les phrases parlées' : platform === 'youtube' ? ' — mots-clés prononcés dans les 5 premières secondes' : ''}", "CTA : ${platform === 'instagram' ? "envie originale de l'envoyer par DM à une personne précise" : '1 action directe'}"],
      "screenText": ["MOT1", "MOT2", "MOT3"],
      "caption": "caption 3 différente avec 1 hashtag large + 2-3 hashtags catégorie + 2-3 hashtags niche = 5-8 hashtags",
      "bestTime": "ex: Mardi-Jeudi, 7h-9h",
      ${platform === 'tiktok' ? '"duration": "15s ou 30s",' : ''}
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
  "hook": "${platform === 'instagram' ? 'hook said in the very first second — POV, premise or ultra-specific promise; statement OR question/mystery; coherent with the payoff' : 'ultra-shocking hook max 12 words (viral formula: Contrarian/Mistake/List/POV/Outcome)'}",
  "script": ["Hook (0-3s): ${platform === 'instagram' ? 'said in the very first second, POV/premise/promise' : 'max 12 words, viral formula'}", "Promise (3-8s): what viewer gains by staying${platform === 'instagram' ? ' + progression cue (e.g. stay till the end for...)' : ''}", "Proof/Value: body${platform === 'tiktok' ? ' — topic keywords naturally integrated in spoken sentences' : platform === 'youtube' ? ' — keywords spoken out loud in first 5 seconds' : ''}", "CTA: ${platform === 'instagram' ? "satisfying payoff at the end, then make them want to send it by DM to one specific person (e.g. 'send this to...', 'tag someone who...')" : platform === 'youtube' ? 'subscribe or clear action' : '1 direct and clear action'}"],
  "screenText": [${platform === 'instagram' ? '"punchy line naming the EXACT scene (readable without sound)", "2nd short line", "3rd short line"' : '"WORD1", "WORD2", "WORD3"'}],
  "caption": "${platform === 'instagram' ? '2-3 lines of value + engaging question. Emojis + 1 broad hashtag + 2-3 category hashtags + 2-3 niche hashtags = 5-8 hashtags. End with: Tip: test this Reel as Trial Reels to reach new audiences.' : platform === 'tiktok' ? '1 broad hashtag (#fyp or #foryou) + 2-3 category hashtags + 2-3 niche hashtags = 5-8 hashtags. Avoid hashtags with billions of posts.' : '1 broad hashtag + 2-3 category hashtags + 2-3 niche hashtags = 5-8 hashtags.'}",
  "bestTime": "e.g: Tue-Thu, 6pm-9pm",
  ${platform === 'tiktok' ? '"duration": "15s or 30s based on your analysis",' : ''}
  ${platform === 'tiktok' ? '"soundTrend": "trending TikTok sound suggestion"' : '"soundTrend": null'}${platform === 'youtube' ? `,
  "ytTitle": "SEO-optimized YouTube title max 60 chars with main keyword",
  "seoDescription": "YouTube description 150-200 words SEO-optimized with keywords naturally integrated, call to action, and timestamps if relevant",
  "keywords": ["keyword 1", "keyword 2", "keyword 3", "keyword 4", "keyword 5", "keyword 6", "keyword 7", "keyword 8"]` : ''}
}`
  : `Return EXACTLY this JSON (nothing else) with 3 variations — each hook must use a DIFFERENT viral formula (Contrarian, Mistake, List, POV, Outcome):
{
  "variations": [
    {
      "hook": "hook 1 — Contrarian or Mistake formula",
      "script": ["Hook (0-3s): max 12 words, viral formula", "Promise (3-8s): what viewer gains by staying", "Proof/Value: body${platform === 'tiktok' ? ' — keywords integrated in spoken sentences' : platform === 'youtube' ? ' — keywords spoken in first 5 seconds' : ''}", "CTA: ${platform === 'instagram' ? "make them want to send it by DM to one specific person" : '1 direct action'}"],
      "screenText": ["WORD1", "WORD2", "WORD3"],
      "caption": "caption 1 with emojis + 1 broad hashtag + 2-3 category hashtags + 2-3 niche hashtags = 5-8 hashtags",
      "bestTime": "e.g: Mon-Wed, 12pm-2pm",
      ${platform === 'tiktok' ? '"duration": "15s or 30s",' : ''}
      ${platform === 'tiktok' ? '"soundTrend": "trending sound 1"' : '"soundTrend": null'}${platform === 'youtube' ? `,
      "ytTitle": "SEO-optimized YouTube title variation 1",
      "seoDescription": "SEO YouTube description variation 1",
      "keywords": ["keyword 1", "keyword 2", "keyword 3", "keyword 4", "keyword 5"]` : ''}
    },
    {
      "hook": "DIFFERENT hook 2 — List or POV formula",
      "script": ["Hook (0-3s): max 12 words, different viral formula", "Promise (3-8s): what viewer gains by staying", "Proof/Value: body${platform === 'tiktok' ? ' — keywords integrated in spoken sentences' : platform === 'youtube' ? ' — keywords spoken in first 5 seconds' : ''}", "CTA: ${platform === 'instagram' ? "a different reason to send it by DM to one specific person" : '1 direct action'}"],
      "screenText": ["WORD1", "WORD2", "WORD3"],
      "caption": "different caption 2 with 1 broad hashtag + 2-3 category hashtags + 2-3 niche hashtags = 5-8 hashtags",
      "bestTime": "e.g: Fri-Sun, 7pm-10pm",
      ${platform === 'tiktok' ? '"duration": "15s or 30s",' : ''}
      ${platform === 'tiktok' ? '"soundTrend": "trending sound 2"' : '"soundTrend": null'}${platform === 'youtube' ? `,
      "ytTitle": "SEO-optimized YouTube title variation 2",
      "seoDescription": "SEO YouTube description variation 2",
      "keywords": ["keyword 1", "keyword 2", "keyword 3", "keyword 4", "keyword 5"]` : ''}
    },
    {
      "hook": "DIFFERENT hook 3 — Specific Outcome or other formula",
      "script": ["Hook (0-3s): max 12 words, third viral formula", "Promise (3-8s): what viewer gains by staying", "Proof/Value: body${platform === 'tiktok' ? ' — keywords integrated in spoken sentences' : platform === 'youtube' ? ' — keywords spoken in first 5 seconds' : ''}", "CTA: ${platform === 'instagram' ? "an original reason to send it by DM to one specific person" : '1 direct action'}"],
      "screenText": ["WORD1", "WORD2", "WORD3"],
      "caption": "different caption 3 with 1 broad hashtag + 2-3 category hashtags + 2-3 niche hashtags = 5-8 hashtags",
      "bestTime": "e.g: Tue-Thu, 7am-9am",
      ${platform === 'tiktok' ? '"duration": "15s or 30s",' : ''}
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
