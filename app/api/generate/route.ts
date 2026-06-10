import Anthropic from '@anthropic-ai/sdk';
import { NextRequest, NextResponse } from 'next/server';

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

export async function POST(req: NextRequest) {
  try {
    const { topic, platform, tone, variations, lang, region } = await req.json();

    if (!topic || topic.trim().length < 3) {
      return NextResponse.json({ error: 'Topic too short' }, { status: 400 });
    }

    const isFr = lang === 'fr';
    const count = variations ? 3 : 1;

    const platformName =
      platform === 'tiktok' ? 'TikTok' :
      platform === 'instagram' ? 'Instagram Reels' : 'Facebook Reels';

    const toneMap: Record<string, string> = {
      inspirational: isFr ? 'Inspirant et motivant' : 'Inspirational and motivating',
      funny: isFr ? 'Drôle et léger' : 'Funny and light',
      educational: isFr ? 'Éducatif et informatif' : 'Educational and informative',
      trendy: isFr ? 'Tendance et moderne' : 'Trendy and modern',
      emotional: isFr ? 'Émotionnel et touchant' : 'Emotional and touching',
    };

    const toneLabel = toneMap[tone] || (isFr ? 'Inspirant' : 'Inspirational');

    const regionContext: Record<string, string> = {
      'qc': 'pour une audience québécoise : utilise un français québécois naturel et professionnel — chaleureux, direct et accessible. Quelques expressions québécoises courantes sont bienvenues si elles sonnent naturelles, mais ABSOLUMENT AUCUN sacre, juron ou langage vulgaire. Pas de joual excessif ni de caricature. Le ton doit être engageant et moderne, comme un créateur de contenu québécois professionnel.',
      'fr': 'pour une audience française (France) : adopte un ton élégant et un peu plus sophistiqué, des références à la culture française, un humour subtil et pince-sans-rire. Évite les québécismes.',
      'be': 'pour une audience belge francophone (Belgique/Wallonie) : ton naturel et accessible, références à la culture belge si pertinent, humour autodérisoire bienvenu.',
      'other-fr': 'pour une audience francophone internationale : langue claire et universelle, sans régionalismes, accessible à tous les francophones.',
      'us': 'for a US American audience: high energy, motivational tone, American pop culture references if relevant, direct and punchy style. Think big, bold, optimistic.',
      'uk': 'for a British audience: dry wit welcome, understated humor, British cultural references if relevant, slightly more reserved tone than US content. Avoid Americanisms.',
      'au': 'for an Australian audience: casual and laid-back tone, self-deprecating humor welcome, Australian cultural references if relevant, friendly and unpretentious style.',
      'ca-en': 'for an English-speaking Canadian audience: friendly and inclusive tone, Canadian cultural references if relevant, balanced between US and UK influences, polite yet engaging.',
      'other-en': 'for a global English-speaking audience: use clear, neutral, and universally understood English. Avoid slang, idioms, or cultural references specific to one country. Accessible to all English speakers worldwide.',
    };

    const culturalInstruction = region && regionContext[region]
      ? (isFr ? `\nAdapte le contenu ${regionContext[region]}` : `\nAdapt the content ${regionContext[region]}`)
      : '';

    const systemPrompt = isFr
      ? `Tu es un expert en création de contenu viral pour les réseaux sociaux. Tu génères des scripts de Reels ultra-viraux, percutants et engageants.${culturalInstruction} Tu réponds TOUJOURS en JSON valide exactement selon le schéma demandé. Pas de texte en dehors du JSON.`
      : `You are an expert in creating viral content for social media. You generate ultra-viral, punchy and engaging Reel scripts.${culturalInstruction} You ALWAYS respond in valid JSON exactly according to the requested schema. No text outside the JSON.`;

    const userPrompt = isFr
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
  ${platform === 'tiktok' ? '"soundTrend": "suggestion de son tendance TikTok"' : '"soundTrend": null'}
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
      ${platform === 'tiktok' ? '"soundTrend": "son tendance 1"' : '"soundTrend": null'}
    },
    {
      "hook": "accroche 2 DIFFÉRENTE",
      "script": ["étape 1", "étape 2", "étape 3", "étape 4"],
      "screenText": ["MOT1", "MOT2", "MOT3"],
      "caption": "caption 2 différente",
      "bestTime": "ex: Vendredi-Dimanche, 19h-22h",
      ${platform === 'tiktok' ? '"duration": "7s ou 15s ou 30s",' : ''}
      ${platform === 'tiktok' ? '"soundTrend": "son tendance 2"' : '"soundTrend": null'}
    },
    {
      "hook": "accroche 3 DIFFÉRENTE",
      "script": ["étape 1", "étape 2", "étape 3"],
      "screenText": ["MOT1", "MOT2", "MOT3"],
      "caption": "caption 3 différente",
      "bestTime": "ex: Mardi-Jeudi, 7h-9h",
      ${platform === 'tiktok' ? '"duration": "7s ou 15s ou 60s",' : ''}
      ${platform === 'tiktok' ? '"soundTrend": "son tendance 3"' : '"soundTrend": null'}
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
  ${platform === 'tiktok' ? '"soundTrend": "trending TikTok sound suggestion"' : '"soundTrend": null'}
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
      ${platform === 'tiktok' ? '"soundTrend": "trending sound 1"' : '"soundTrend": null'}
    },
    {
      "hook": "DIFFERENT hook 2",
      "script": ["step 1", "step 2", "step 3", "step 4"],
      "screenText": ["WORD1", "WORD2", "WORD3"],
      "caption": "different caption 2",
      "bestTime": "e.g: Fri-Sun, 7pm-10pm",
      ${platform === 'tiktok' ? '"duration": "7s or 15s or 30s",' : ''}
      ${platform === 'tiktok' ? '"soundTrend": "trending sound 2"' : '"soundTrend": null'}
    },
    {
      "hook": "DIFFERENT hook 3",
      "script": ["step 1", "step 2", "step 3"],
      "screenText": ["WORD1", "WORD2", "WORD3"],
      "caption": "different caption 3",
      "bestTime": "e.g: Tue-Thu, 7am-9am",
      ${platform === 'tiktok' ? '"duration": "7s or 15s or 60s",' : ''}
      ${platform === 'tiktok' ? '"soundTrend": "trending sound 3"' : '"soundTrend": null'}
    }
  ]
}`
}`;

    const message = await client.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 2000,
      system: systemPrompt,
      messages: [{ role: 'user', content: userPrompt }],
    });

    const raw = (message.content[0] as { type: string; text: string }).text.trim();

    // Extract JSON from possible markdown code blocks
    const jsonMatch = raw.match(/```(?:json)?\s*([\s\S]*?)```/) || [null, raw];
    const jsonStr = jsonMatch[1].trim();

    const data = JSON.parse(jsonStr);
    return NextResponse.json(data);
  } catch (err) {
    console.error('Generate error:', err);
    return NextResponse.json({ error: 'Generation failed' }, { status: 500 });
  }
}
