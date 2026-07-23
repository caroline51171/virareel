import Anthropic from '@anthropic-ai/sdk';
import { createHmac } from 'crypto';
import { NextRequest, NextResponse } from 'next/server';
import { auth, clerkClient } from '@clerk/nextjs/server';

export const maxDuration = 300;

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const ADMIN_EMAILS = ['caroline51171@gmail.com', 'caroline51171@hotmail.fr'];
const ANON_LIMIT = 12;

// ⚠️ Logique de crédits volontairement identique à app/api/generate/route.ts
// (même cookie signé `virareel_anon`, même secret, mêmes métadonnées Clerk) pour que
// le quota soit PARTAGÉ entre génération et transcréation. Une transcréation = 1 crédit.
// (Source de vérité : generate/route.ts — à consolider dans un lib partagé un jour.)

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

    if (!userId) {
      const ipHash = hashIP(getIP(req));
      const anonData = parseAnonCookie(req.cookies.get('virareel_anon')?.value);
      const anonCount = (anonData && anonData.ip === ipHash) ? anonData.n : 0;
      if (anonCount + cost > ANON_LIMIT) {
        return NextResponse.json(
          { error: 'anonymous_limit', used: anonCount, limit: ANON_LIMIT },
          { status: 429 }
        );
      }
      anonCookieValue = makeAnonCookie(anonCount + cost, ipHash);
    } else {
      const clerk = await clerkClient();
      const user = await clerk.users.getUser(userId);
      const userEmail = user.emailAddresses[0]?.emailAddress?.toLowerCase() || '';
      const isAdminUser = ADMIN_EMAILS.includes(userEmail);
      const plan = (user.publicMetadata?.plan as string) || 'free';
      // Solo = forfait « lite » : pas de transcréation bilingue (réservée à Creator+)
      if (!isAdminUser && plan === 'solo') {
        return NextResponse.json({ error: 'solo_locked' }, { status: 403 });
      }
      if (!isAdminUser && (plan === 'creator' || plan === 'pro' || plan === 'solo')) {
        const generationsLimit = (user.privateMetadata?.generationsLimit as number) ?? -1;
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
        if (!isAdminUser && (plan === 'creator' || plan === 'pro' || plan === 'solo')) {
          const generationsUsed = (user.privateMetadata?.generationsUsed as number) || 0;
          await clerk.users.updateUserMetadata(userId, {
            privateMetadata: { generationsUsed: generationsUsed + cost, history: null },
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
