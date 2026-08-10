import Anthropic from '@anthropic-ai/sdk';
import { NextRequest, NextResponse } from 'next/server';
import { auth, clerkClient } from '@clerk/nextjs/server';
import { getIP, hashIP, parseAnonCookie, makeAnonCookie, anonUsedFromRequest, ANON_LIMIT, EMAIL_GATE_LIMIT, FREE_ACCOUNT_LIMIT } from '@/lib/anonTracking';
import { recordAnonTrial } from '@/lib/anonStats';

export const maxDuration = 300;

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const ADMIN_EMAILS = ['caroline51171@gmail.com', 'caroline51171@hotmail.fr'];

// ⚠️ Quota PARTAGÉ avec app/api/generate/route.ts via le même cookie signé
// `virareel_anon` (lib/anonTracking.ts = source de vérité unique pour les 2 routes,
// pour ne plus jamais désynchroniser les chiffres ou perdre le drapeau "courriel donné").

// ─── Registre culturel par région cible (aligné sur generate/route.ts) ──────────
const regionContext: Record<string, string> = {
  'qc': "pour une audience québécoise éduquée et créative : français québécois soigné, chaleureux et moderne. Humour intelligent, subtil et autodérisoire, universellement compris. ABSOLUMENT AUCUN sacre, joual ou langage populaire. Ton raffiné mais jamais prétentieux.",
  'fr': "pour une audience française cultivée : ton élégant, esprit vif et pince-sans-rire. Humour subtil et ironique. Jamais vulgaire. Évite les québécismes et le langage familier.",
  'be': "pour une audience belge francophone éduquée : ton naturel, chaleureux et accessible. Humour autodérisoire et intelligent. Jamais vulgaire.",
  'other-fr': "pour une audience francophone internationale cultivée : langue claire, soignée et universelle, sans régionalismes. Humour intelligent et universellement compris.",
  'us': 'for an educated American audience: energetic, optimistic and smart. Witty and relatable humor. Bold but never crude or lowbrow.',
  'uk': 'for an educated British audience: dry wit, understatement and intelligent wordplay. Subtle, self-deprecating humor. Slightly reserved, never loud or brash.',
  'au': 'for an educated Australian audience: warm, self-deprecating and clever. Casual but intelligent humor. Friendly and unpretentious without being lowbrow.',
  'ca-en': 'for an educated English-speaking Canadian audience: friendly, inclusive and smart. Warm and witty humor. Balanced and polished.',
  'other-en': 'for a global English-speaking audience: clear, neutral, universally understood English. Avoid slang and country-specific references.',
};

const REGION_LABELS: Record<string, string> = {
  'qc': 'Québec (français)', 'fr': 'France (français)', 'be': 'Belgique (français)', 'other-fr': 'francophone international',
  'us': 'United States (English)', 'uk': 'United Kingdom (English)', 'au': 'Australia (English)', 'ca-en': 'Canada (English)', 'other-en': 'international English',
};

// ─── Filet screenText ↔ script (identique à generate) ───────────────────────────
function deriveScreenLine(scriptStep: unknown): string {
  let s = String(scriptStep ?? '').trim();
  s = s.replace(/^[^:]{1,40}:\s*/, '');
  const clause = (s.split(/[.!?;,–—:]/)[0] || s).trim() || s;
  return clause.split(/\s+/).filter(Boolean).slice(0, 8).join(' ');
}

function alignScreenText(obj: unknown): void {
  const o = obj as { script?: unknown; screenText?: unknown };
  if (!o || !Array.isArray(o.script) || !Array.isArray(o.screenText)) return;
  const script = o.script as unknown[];
  const src = o.screenText as unknown[];
  if (src.length === script.length) return;
  o.screenText = script.map((step, i) => {
    const line = src[i];
    return typeof line === 'string' && line.trim() ? line : deriveScreenLine(step);
  });
}

// ─── Route ──────────────────────────────────────────────────────────────────────
export async function POST(req: NextRequest) {
  try {
    const { reel, targetLang, targetRegion, platform } = await req.json();

    if (!reel || typeof reel !== 'object' || !reel.hook) {
      return NextResponse.json({ error: 'missing_reel' }, { status: 400 });
    }
    if (targetLang !== 'fr' && targetLang !== 'en') {
      return NextResponse.json({ error: 'bad_target_lang' }, { status: 400 });
    }

    const cost = 1; // une transcréation = 1 crédit, toujours
    const { userId } = await auth();
    let anonCookieValue: string | null = null;
    const anonSeed = anonUsedFromRequest(req);

    if (!userId) {
      const ipHash = hashIP(getIP(req));
      const anonData = parseAnonCookie(req.cookies.get('virareel_anon')?.value);
      const validAnon = anonData && anonData.ip === ipHash;
      const anonCount = validAnon ? anonData!.n : 0;
      const emailGiven = validAnon ? !!anonData!.e : false;

      if (anonCount + cost > ANON_LIMIT) {
        return NextResponse.json(
          { error: 'anonymous_limit', used: anonCount, limit: ANON_LIMIT },
          { status: 429 }
        );
      }
      if (!emailGiven && anonCount + cost > EMAIL_GATE_LIMIT) {
        return NextResponse.json(
          { error: 'email_required', used: anonCount, limit: EMAIL_GATE_LIMIT },
          { status: 428 }
        );
      }
      anonCookieValue = makeAnonCookie({ n: anonCount + cost, ip: ipHash, e: emailGiven });
      await recordAnonTrial(cost);
    } else {
      const clerk = await clerkClient();
      const user = await clerk.users.getUser(userId);
      const userEmail = user.emailAddresses[0]?.emailAddress?.toLowerCase() || '';
      const isAdminUser = ADMIN_EMAILS.includes(userEmail);
      const plan = (user.publicMetadata?.plan as string) || 'free';
      // TOUT compte connecté est plafonné, `free` compris — identique à generate.
      if (!isAdminUser) {
        const isPaidPlan = plan === 'creator' || plan === 'pro' || plan === 'solo';
        const generationsLimit = isPaidPlan
          ? ((user.privateMetadata?.generationsLimit as number) ?? -1)
          : FREE_ACCOUNT_LIMIT;
        if (generationsLimit !== -1) {
          const stored = (user.privateMetadata?.generationsUsed as number) || 0;
          const generationsUsed = isPaidPlan ? stored : Math.max(stored, anonSeed);
          if (generationsUsed + cost > generationsLimit) {
            return NextResponse.json(
              { error: 'limit_reached', generationsUsed, generationsLimit, plan },
              { status: 429 }
            );
          }
        }
      }
    }

    // ── Prompt de transcréation ───────────────────────────────────────────────
    const toFr = targetLang === 'fr';
    const regionText = (targetRegion && regionContext[targetRegion]) || '';
    const regionLabel = REGION_LABELS[targetRegion] || (toFr ? 'francophone' : 'English');
    const platformName =
      platform === 'tiktok' ? 'TikTok' :
      platform === 'instagram' ? 'Instagram Reels' :
      platform === 'youtube' ? 'YouTube Shorts' :
      platform === 'facebook' ? 'Facebook Reels' : (platform || 'Reels');

    const systemPrompt = toFr
      ? `Tu es un expert en TRANSCRÉATION de contenu viral pour les réseaux sociaux (2026). On te donne un Reel existant ; tu le recrées ENTIÈREMENT en français ${regionText ? regionText : 'soigné et universel'} pour ${platformName}.

TRANSCRÉATION ≠ traduction : garde l'IDÉE, la STRUCTURE, le MESSAGE et l'intention d'origine, mais réécris tout comme si un créateur natif de cette culture l'avait écrit dès le départ — expressions, tournures, humour et codes culturels de cette audience. JAMAIS de mot-à-mot ni de calque. Le résultat doit sonner 100% naturel et percutant.

RÈGLES : conserve EXACTEMENT le même nombre d'entrées dans "script" et "screenText", dans le même ordre (Hook, Promise, beats de Valeur, CTA). "screenText" reste le miroir de "script" (même longueur). Adapte les hashtags au marché/à la langue cible. Garde le même registre de ton. Reproduis les MÊMES champs que le reel source (si le source a ytTitle/seoDescription/keywords, transcrée-les aussi ; s'il a duration/soundTrend/visualInspo, garde-les et adapte).

Tu réponds UNIQUEMENT en JSON valide, exactement la même structure que le reel source. Aucun texte hors du JSON.`
      : `You are an expert in TRANSCREATION of viral social media content (2026). You are given an existing Reel; you fully recreate it in English ${regionText ? regionText : 'clear and universal'} for ${platformName}.

TRANSCREATION ≠ translation: keep the original IDEA, STRUCTURE, MESSAGE and intent, but rewrite everything as if a native creator from that culture had written it from scratch — the expressions, phrasing, humor and cultural codes of that audience. NEVER word-for-word or a calque. The result must sound 100% natural and punchy.

RULES: keep EXACTLY the same number of entries in "script" and "screenText", in the same order (Hook, Promise, Value beats, CTA). "screenText" stays the mirror of "script" (same length). Adapt hashtags to the target market/language. Keep the same tone register. Reproduce the SAME fields as the source reel (if the source has ytTitle/seoDescription/keywords, transcreate them too; if it has duration/soundTrend/visualInspo, keep and adapt them).

You respond ONLY in valid JSON, exactly the same structure as the source reel. No text outside the JSON.`;

    const userPrompt = `${toFr ? 'Reel source à transcréer' : 'Source Reel to transcreate'} (${toFr ? 'cible' : 'target'}: ${regionLabel}, ${platformName}) :

${JSON.stringify(reel, null, 2)}

${toFr
  ? 'Retourne EXACTEMENT le même objet JSON (mêmes clés), transcréé en français cible. Rien d\'autre que le JSON.'
  : 'Return EXACTLY the same JSON object (same keys), transcreated into the target English. Nothing but the JSON.'}`;

    const message = await client.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 3000,
      system: systemPrompt,
      messages: [{ role: 'user', content: userPrompt }],
    });

    // Coût réel Claude sonnet-4-6 : $3/MTok input, $15/MTok output.
    const realCostUSD = (message.usage.input_tokens / 1_000_000) * 3 + (message.usage.output_tokens / 1_000_000) * 15;

    const rawText = (message.content[0] as { type: string; text: string }).text.trim();
    const fence = rawText.match(/```(?:json)?\s*([\s\S]*?)```/);
    const jsonStr = (fence ? fence[1] : rawText.replace(/^```(?:json)?\s*/, '').replace(/```\s*$/, '')).trim();
    const data = JSON.parse(jsonStr);

    alignScreenText(data);

    // ── Incrément du compteur (payants) — identique à generate ────────────────
    try {
      if (userId) {
        const clerk = await clerkClient();
        const user = await clerk.users.getUser(userId);
        const userEmail = user.emailAddresses[0]?.emailAddress?.toLowerCase() || '';
        const isAdminUser = ADMIN_EMAILS.includes(userEmail);
        const plan = (user.publicMetadata?.plan as string) || 'free';
        if (!isAdminUser) {
          const isPaid = plan === 'creator' || plan === 'pro' || plan === 'solo';
          const stored = (user.privateMetadata?.generationsUsed as number) || 0;
          const generationsUsed = isPaid ? stored : Math.max(stored, anonSeed);
          const totalCostUSD = (user.privateMetadata?.totalCostUSD as number) || 0;
          await clerk.users.updateUserMetadata(userId, {
            privateMetadata: { generationsUsed: generationsUsed + cost, totalCostUSD: totalCostUSD + realCostUSD, history: null },
          });
        }
      }
    } catch {
      // ne pas bloquer la transcréation si la mise à jour échoue
    }

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
    console.error('Transcreate error:', err);
    return NextResponse.json({ error: 'transcreation_failed' }, { status: 500 });
  }
}
