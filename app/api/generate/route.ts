import Anthropic from '@anthropic-ai/sdk';
import { createHmac } from 'crypto';
import { NextRequest, NextResponse } from 'next/server';
import { auth, clerkClient } from '@clerk/nextjs/server';

export const maxDuration = 300;

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

// ─── Alignement screenText ↔ script (filet de sécurité) ───────────────────────
// Le prompt demande UNE ligne de texte à l'écran par page du script (même nombre,
// même ordre). L'IA respecte ça la quasi-totalité du temps, mais peut à l'occasion
// fusionner/sauter une section → décalage visible dans l'UI. On garantit ici que
// screenText a TOUJOURS exactement la longueur de script : on garde les lignes
// fournies par l'IA, on complète les manquantes en les dérivant du beat de script
// correspondant, et on coupe les éventuelles lignes en trop.

function deriveScreenLine(scriptStep: unknown): string {
  let s = String(scriptStep ?? '').trim();
  // Retirer un préfixe de section en début (ex: "Hook (0-3s) :", "Valeur 1/3 :", "CTA :")
  s = s.replace(/^[^:]{1,40}:\s*/, '');
  // Garder la 1re proposition (jusqu'à la 1re ponctuation forte) pour une phrase NETTE,
  // jamais coupée en plein milieu.
  const clause = (s.split(/[.!?;,–—:]/)[0] || s).trim() || s;
  const words = clause.split(/\s+/).filter(Boolean);
  // Phrase-choc lisible sans son : plafonner à 8 mots seulement si la proposition est longue.
  return words.slice(0, 8).join(' ');
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

// ─── Route principale ─────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  try {
    const { topic, platform, platforms, tone, variations, lang, region, recentHooks } = await req.json();

    // ── PLATEFORMES DEMANDÉES ─────────────────────────────────────────────────
    // `platforms` (liste) est la nouvelle forme ; `platform` (texte) reste accepté
    // pour ne rien casser. 'all' = les 4. Une plateforme = un appel, lancés en
    // parallèle : chaque réponse est plus courte, donc moins de risque de coupure.
    const ALL_PLATFORMS = ['instagram', 'tiktok', 'facebook', 'youtube'] as const;
    const selected: string[] = (
      Array.isArray(platforms) && platforms.length > 0
        ? platforms
        : platform === 'all' ? [...ALL_PLATFORMS] : [platform]
    ).filter((p: string) => (ALL_PLATFORMS as readonly string[]).includes(p));
    if (selected.length === 0) selected.push('instagram');
    const multi = selected.length > 1;

    if (!topic || topic.trim().length < 3) {
      return NextResponse.json({ error: 'Topic too short' }, { status: 400 });
    }

    // 1 crédit par script livré : N plateformes = N, une seule avec variations = 3.
    let cost = multi ? selected.length : (variations ? 3 : 1);
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
        // Solo = forfait « lite » : une seule plateforme à la fois, pas de variations
        if (plan === 'solo' && (multi || variations)) {
          return NextResponse.json({ error: 'solo_locked' }, { status: 403 });
        }
        if (plan === 'creator' || plan === 'pro' || plan === 'solo') {
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

    // ── ROTATION DES FORMULES ET DES ANGLES ───────────────────────────────────
    // Avant : 5 formules figées, assignées à des places fixes (accroche 1 = toujours
    // Contrarian/Mistake). Un client régulier reconnaissait le moule au bout de
    // quelques générations. Maintenant : 14 formules tirées au hasard à chaque appel,
    // croisées avec 4 angles de voix -> ~56 combinaisons au lieu de 5.
    // Répertoire validé sur les sources de rétention 2026 (HypeNest, Socialync, Vexub).
    const FORMULAS = isFr ? [
      'Contrarian Claim : "X n\'est PAS ce que tu crois"',
      'Mistake Warning : "Tu fais cette erreur sans le savoir"',
      'List Tease : "3 raisons pour lesquelles tu..."',
      'POV / Miroir de la douleur : "POV : tu viens de découvrir..."',
      'Specific Outcome : "Comment je suis passé de X à Y en Z jours"',
      'Identity Call : "Si tu es [métier précis], ça te concerne"',
      'Open Loop : commence une histoire et ne la termine pas tout de suite',
      'Confession : "Je n\'aurais pas dû faire ça, mais..."',
      'Direct Question : une question à laquelle on répond dans sa tête, malgré soi',
      'Proof First : montre le résultat AVANT d\'expliquer quoi que ce soit',
      'Pattern Interrupt : une phrase qui ne devrait pas exister, à résoudre',
      'Speed-Run : "En 20 secondes, tu sauras faire X"',
      'Avant/Après : le contraste brutal entre les deux états',
      'Myth Bust : "Ce que personne ne te dit sur X"',
    ] : [
      'Contrarian Claim: "X is NOT what you think"',
      'Mistake Warning: "You\'re making this mistake without knowing it"',
      'List Tease: "3 reasons why you..."',
      'POV / Pain Mirror: "POV: you just discovered..."',
      'Specific Outcome: "How I went from X to Y in Z days"',
      'Identity Call: "If you\'re a [specific role], this is for you"',
      'Open Loop: start a story and leave it unfinished',
      'Confession: "I shouldn\'t have done this, but..."',
      'Direct Question: a question the viewer answers in their head despite themselves',
      'Proof First: show the result BEFORE explaining anything',
      'Pattern Interrupt: a sentence that shouldn\'t exist, begging to be resolved',
      'Speed-Run: "In 20 seconds you\'ll know how to do X"',
      'Before/After: the brutal contrast between the two states',
      'Myth Bust: "What nobody tells you about X"',
    ];
    const ANGLES = isFr ? [
      'l\'expert qui tranche — ton assuré, il sait et il le dit',
      'le pair qui confesse — il l\'a vécu, il le raconte sans se protéger',
      'le constat chiffré — il observe, il mesure, les faits parlent',
      'la scène vécue — un moment précis, raconté comme il s\'est passé',
    ] : [
      'the expert who settles it — assured tone, they know and they say it',
      'the peer who confesses — they lived it, told without self-protection',
      'the measured observation — they observe, they count, facts speak',
      'the lived scene — one precise moment, told as it happened',
    ];
    const shuffle = <T,>(a: T[]): T[] => {
      const c = [...a];
      for (let i = c.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [c[i], c[j]] = [c[j], c[i]];
      }
      return c;
    };
    const rotation = shuffle(FORMULAS);
    const angleRotation = shuffle(ANGLES);
    // Le menu affiché dans les consignes change à chaque génération
    const formulaMenu = rotation.slice(0, 5).map(f => `   - ${f}`).join('\n');
    // Formule imposée à la variation i (ou au script unique)
    const formulaAt = (i: number) => rotation[i % rotation.length];
    const angleAt = (i: number) => angleRotation[i % angleRotation.length];
    const angleLine = isFr
      ? `ANGLE DE VOIX imposé pour cette génération : ${angleAt(0)}. Tiens-le du début à la fin — c'est ce qui empêche deux générations sur le même sujet de se ressembler.`
      : `VOICE ANGLE imposed for this generation: ${angleAt(0)}. Hold it from start to finish — this is what keeps two generations on the same topic from sounding alike.`;

    const toneMap: Record<string, string> = {
      inspirational: isFr ? 'Inspirant et motivant' : 'Inspirational and motivating',
      funny: isFr ? 'Humoristique et divertissant' : 'Witty and entertaining',
      educational: isFr ? 'Éducatif et informatif' : 'Educational and informative',
      expert: isFr ? 'Expert et crédible' : 'Expert and credible',
      trendy: isFr ? 'Tendance et moderne' : 'Trendy and modern',
      emotional: isFr ? 'Émotionnel et touchant' : 'Emotional and touching',
    };
    const toneLabel = toneMap[tone] || (isFr ? 'Inspirant' : 'Inspirational');
    const isDense = tone === 'educational' || tone === 'expert';

    // ── ÉTAPE C : UNE IDÉE PARTAGÉE PAR TOUTES LES PLATEFORMES ────────────────
    // Avant : un appel par plateforme, chacun inventant son propre sujet — donc
    // 4 scripts sans lien entre eux. Maintenant, quand plusieurs plateformes sont
    // demandées, un 1er appel COURT fixe l'idée (angle, promesse, valeur, chute),
    // et chaque plateforme ADAPTE cette même idée à ses codes.
    // Si ce petit appel échoue, on continue exactement comme avant.
    let sharedBrief = '';
    if (multi) {
      try {
        const briefMsg = await client.messages.create({
          model: 'claude-sonnet-4-6',
          max_tokens: 400,
          system: isFr
            ? `Tu es directeur de création. Tu ne rédiges PAS de script : tu fixes l'idée en quelques lignes. Texte brut, aucune explication, aucun préambule.`
            : `You are a creative director. You do NOT write scripts: you set the idea in a few lines. Plain text, no explanation, no preamble.`,
          messages: [{
            role: 'user',
            content: isFr
              ? `Sujet : ${topic}
Ton : ${toneLabel}
Angle de voix : ${angleAt(0)}

Fixe UNE seule idée de contenu, qui servira de base à ${selected.length} scripts (un par plateforme).
Réponds exactement dans ce format, une phrase par ligne, rien d'autre :
ANGLE : de quoi on parle et sous quel angle
PROMESSE : ce que le viewer gagne en restant
VALEUR 1 :
VALEUR 2 :
VALEUR 3 :
CHUTE : le payoff final`
              : `Topic: ${topic}
Tone: ${toneLabel}
Voice angle: ${angleAt(0)}

Set ONE single content idea, which will be the base for ${selected.length} scripts (one per platform).
Answer exactly in this format, one sentence per line, nothing else:
ANGLE: what we talk about and from which angle
PROMISE: what the viewer gains by staying
VALUE 1:
VALUE 2:
VALUE 3:
PAYOFF: the final payoff`,
          }],
        });
        sharedBrief = (briefMsg.content[0] as { type: string; text: string }).text.trim();
      } catch { sharedBrief = ''; }
    }

    // Tout le moteur ci-dessous est inchangé : il est simplement enfermé dans une
    // fonction pour pouvoir tourner une fois par plateforme demandée, en parallèle.
    // La rotation des formules, elle, reste DEHORS : les plateformes d'une même
    // génération partagent donc les mêmes formules et le même angle.
    const runFor = async (platform: string, count: number) => {

    const platformName =
      platform === 'tiktok' ? 'TikTok' :
      platform === 'instagram' ? 'Instagram Reels' :
      platform === 'youtube' ? 'YouTube Shorts' :
      platform === 'all' ? 'Instagram Reels, TikTok, Facebook Reels et YouTube Shorts' : 'Facebook Reels';

    // Recette par ton pour Instagram (algorithme juillet 2026 : complétion + partages)
    const igToneRecipeMap: Record<string, { fr: string; en: string }> = {
      inspirational: {
        fr: `Ton INSPIRANT : mini-récit (galère → déclic → résultat) avec un texte réflexif et une chute qui donne de l'élan. Vise 25-40s. Optimise pour les SAUVEGARDES et les partages.`,
        en: `INSPIRATIONAL tone: mini-story (struggle → turning point → result) with reflective text and an uplifting ending. Aim 25-40s. Optimize for SAVES and shares.`,
      },
      funny: {
        fr: `Ton HUMORISTIQUE : prémisse absurde et ULTRA-précise, rythme rapide, punchlines qui s'enchaînent sans temps mort — mais reste assez long pour la portée (20-30s, JAMAIS sous 15s : les vidéos ultra-courtes s'effondrent en portée en 2026). Optimise pour "envoie ça à un ami" (partage DM).`,
        en: `WITTY tone: absurd and ULTRA-specific premise, fast pace, back-to-back punchlines with no dead time — but stay long enough for reach (20-30s, NEVER under 15s: ultra-short videos collapse in reach in 2026). Optimize for "send this to a friend" (DM share).`,
      },
      educational: {
        fr: `Ton ÉDUCATIF : structure problème → solution → 1-2 détails clés, laisse le temps de digérer, vise 25-40s. Optimise pour les SAUVEGARDES ("garde ça pour plus tard").`,
        en: `EDUCATIONAL tone: structure problem → solution → 1-2 key details, allow time to process, aim 25-40s. Optimize for SAVES ("save this for later").`,
      },
      expert: {
        fr: `Ton EXPERT : registre posé, crédible et autoritaire, appuyé sur des données/faits. Structure : affirmation d'autorité contre-intuitive → preuve (un chiffre ou un mécanisme) → cadre ou enseignement actionnable → CTA. Zéro argot, très peu d'emojis, jamais racoleur. Vise 30-45s. Optimise pour les SAUVEGARDES (valeur de référence) et les PARTAGES DM à un collègue/pair.`,
        en: `EXPERT tone: composed, credible and authoritative register, backed by data/facts. Structure: counter-intuitive authority claim → proof (a number or a mechanism) → actionable framework or takeaway → CTA. No slang, minimal emojis, never clickbait. Aim 30-45s. Optimize for SAVES (reference value) and DM SHARES to a colleague/peer.`,
      },
      trendy: {
        fr: `Ton TENDANCE : appuie-toi sur un format actuel et une énergie moderne, glisse une référence culturelle d'aujourd'hui. Le son ORIGINAL / la voix off est désormais favorisé par l'algo (à parité ou mieux qu'un son tendance) — ne dépends pas d'un son viral. Vise 20-30s.`,
        en: `TRENDY tone: lean on a current format and modern energy, drop a present-day cultural reference. ORIGINAL sound / voiceover is now favored by the algo (on par with or better than a trending sound) — don't depend on a viral audio. Aim 20-30s.`,
      },
      emotional: {
        fr: `Ton ÉMOTIONNEL : raconte une histoire authentique avec un arc émotionnel (tension → résolution), vise 25-40s. Optimise pour la connexion → partages et sauvegardes.`,
        en: `EMOTIONAL tone: tell an authentic story with an emotional arc (tension → resolution), aim 25-40s. Optimize for connection → shares and saves.`,
      },
    };
    const igToneRecipe = (igToneRecipeMap[tone] || igToneRecipeMap.inspirational)[isFr ? 'fr' : 'en'];

    const platformInstruction = isFr
      ? (platform === 'tiktok'
        ? `Script TikTok optimisé pour l'algorithme de juillet 2026 — la COMPLÉTION (~70% visé), les REVISIONNAGES et la vitesse d'engagement précoce sont les signaux n°1 ; tes abonnés servent de public test avant la diffusion large. 4 étapes : Hook (dès la 1re seconde, max 12 mots, doit accrocher en 2s), Promise (3-8s, dis ce que le viewer gagne en restant), Proof/Valeur (corps DENSE sans temps mort — intègre les mots-clés du sujet naturellement dans les phrases parlées car TikTok transcrit l'audio pour la recherche), CTA (pose une question qui provoque des COMMENTAIRES — ils pèsent désormais plus que les likes — et pousse partage DM/sauvegarde). ${isDense ?'70-90 mots.' : '50-75 mots.'} Fin qui reboucle naturellement sur le début pour favoriser le revisionnage. Contenu original et authentique — les contenus recyclés, filigranés ou produits en masse sont pénalisés.`
        : platform === 'instagram'
        ? `Script Instagram optimisé pour l'algorithme de juillet 2026 — le TAUX DE COMPLÉTION (regarder jusqu'au bout) et les PARTAGES EN DM sont les signaux n°1. Structure en 4 temps : 1) Hook dit à voix haute DÈS la 1re seconde — un POV, une prémisse ou une promesse ultra-précise ; une AFFIRMATION-choc OU une QUESTION / mystère visuel qui crée un manque à combler sont tous deux permis (doit se comprendre en 1 seconde par un inconnu). 2) Promise + repère de progression : annonce la récompense ET plante un jalon qui fait rester jusqu'au bout (ex: "reste jusqu'à la fin pour..."). 3) Proof/Valeur : corps DENSE, sans temps mort, ton authentique et humain (jamais robotique ni générique). 4) Payoff + CTA : livre un vrai "aha" satisfaisant À LA FIN (pas de conclusion molle), puis pousse au partage en DM à une personne précise (ex: "envoie ça à..." / "tag quelqu'un qui...") — les partages DM comptent 3 à 5x plus que les likes. RÈGLE D'OR : le hook doit rester COHÉRENT avec le contenu — ne promets jamais plus que ce que la vidéo livre, sinon l'abandon en cours de route fait chuter la portée. screenText : UNE phrase-choc par page du script (même nombre d'entrées, même ordre), lisibles SANS son, dont la 1re (le Hook) nomme la scène/situation EXACTE pour que la bonne personne se sente visée. Adapte le vocabulaire et les codes à la niche du sujet. ${igToneRecipe}`
        : platform === 'facebook'
        ? `Script Facebook optimisé pour l'algorithme 2026 — la COMPLÉTION est le signal n°1 (les Reels de 15-30s ont ~45% plus de complétion que les longs) et les SAUVEGARDES + PARTAGES pèsent plus que les likes. 4 étapes : Hook (0-3s, max 12 mots, ultra-choc), Promise (dis ce que le viewer gagne en restant), Proof/Valeur (storytelling COMPACT et dense — une seule idée forte, zéro longueur), CTA (pousse la sauvegarde ou le partage, ou pose une question qui fait réagir en commentaires). ${isDense ?'60-80 mots.' : '40-60 mots.'} Vise 15-30 secondes. Contenu original obligatoire (Meta rétrograde le contenu recyclé) et sujet/caption clairement alignés sur les intérêts de l'audience visée (le système UTIS de Meta matche le contenu aux intérêts déclarés des utilisateurs).`
        : platform === 'youtube'
        ? `Script YouTube Shorts optimisé pour l'algorithme 2026 — le WATCH TIME PAR IMPRESSION est roi (une vue de 6s sur un Short de 60s est un signal NÉGATIF ; rétention visée ~65% sous 30s, ~50% pour 30-60s) et l'algo décide dans les 30-60 premières minutes. 4 étapes : Hook (dès la 1re seconde, ABSOLUMENT max 10 mots — VARIE la formule à chaque génération, un filtre IA pénalise les hooks recyclés ou trop semblables aux tendances), Promise (3-8s, promesse claire + prononce les mots-clés principaux à voix haute dans les 5 premières secondes — les Shorts sont maintenant indexés séparément dans la recherche YouTube), Proof/Valeur (exemples concrets, structure claire, aucun temps mort), CTA (renvoie vers une vidéo longue de la même chaîne si pertinent — c'est LE signal le plus précieux en 2026 — sinon abonnement). ${isDense ?'100-130 mots.' : '70-100 mots.'} Vise 30-45 secondes (le sweet spot). Voix off et audio originaux favorisés par l'algo.`
        : `Adapte la longueur et l'énergie à chaque plateforme (algorithmes 2026 : COMPLÉTION + PARTAGES/SAUVEGARDES + contenu original partout) : TikTok = dense et énergique (50-75 mots, commentaires > likes, fin qui reboucle), Instagram = authentique (40-60 mots, payoff final + partage DM), Facebook = storytelling compact (40-60 mots, 15-30s, sauvegardes + partages), YouTube = structuré avec mots-clés parlés (70-100 mots, 30-45s, renvoi vers vidéo longue si pertinent). TOUTES les plateformes utilisent la structure 4 étapes : Hook / Promise / Proof/Valeur / CTA.`)
      : (platform === 'tiktok'
        ? `TikTok script optimized for the July 2026 algorithm — COMPLETION (~70% target), REWATCHES and early engagement velocity are the #1 signals; your followers act as the test audience before wide distribution. 4 steps: Hook (in the very first second, max 12 words, must hook in 2s), Promise (3-8s, tell viewer what they gain by staying), Proof/Value (DENSE body with no dead time — naturally integrate topic keywords in spoken sentences because TikTok transcribes audio for search), CTA (ask a question that sparks COMMENTS — they now outweigh likes — and push DM shares/saves). ${isDense ?'70-90 words.' : '50-75 words.'} Ending that loops naturally back to the start to drive rewatches. Original, authentic content — recycled, watermarked or mass-produced content is penalized.`
        : platform === 'instagram'
        ? `Instagram script optimized for the July 2026 algorithm — COMPLETION RATE (watching to the end) and DM SHARES are the #1 signals. 4-part structure: 1) Hook said out loud in the VERY FIRST second — a POV, a premise or an ultra-specific promise; a bold STATEMENT OR a QUESTION / visual mystery that creates a curiosity gap are both allowed (a stranger must get it in 1 second). 2) Promise + progression cue: state the payoff AND plant a marker that keeps them watching to the end (e.g. "stay till the end for..."). 3) Proof/Value: DENSE body, no dead time, authentic and human tone (never robotic or generic). 4) Payoff + CTA: deliver a real satisfying "aha" AT THE END (no weak wrap-up), then drive a DM share to one specific person (e.g. "send this to..." / "tag someone who...") — DM shares count 3-5x more than likes. GOLDEN RULE: the hook must stay COHERENT with the content — never promise more than the video delivers, or mid-video drop-off tanks reach. screenText: ONE punchy on-screen line per script page (same number of entries, same order), readable WITHOUT sound, the first one (the Hook) naming the EXACT scene/situation so the right person feels seen. Adapt vocabulary and codes to the topic's niche. ${igToneRecipe}`
        : platform === 'facebook'
        ? `Facebook script optimized for the 2026 algorithm — COMPLETION is the #1 signal (15-30s Reels get ~45% higher completion than longer ones) and SAVES + SHARES outweigh likes. 4 steps: Hook (0-3s, max 12 words, ultra-shocking), Promise (tell viewer what they gain by staying), Proof/Value (COMPACT, dense storytelling — one strong idea, zero filler), CTA (push saves or shares, or ask a question that sparks comments). ${isDense ?'60-80 words.' : '40-60 words.'} Aim for 15-30 seconds. Original content is mandatory (Meta demotes recycled content) and topic/caption clearly aligned with the target audience's interests (Meta's UTIS system matches content to users' declared interests).`
        : platform === 'youtube'
        ? `YouTube Shorts script optimized for the 2026 algorithm — WATCH TIME PER IMPRESSION is king (a 6s view on a 60s Short is a NEGATIVE signal; retention targets ~65% under 30s, ~50% for 30-60s) and the algo decides within the first 30-60 minutes. 4 steps: Hook (in the very first second, ABSOLUTELY max 10 words — VARY the formula every generation, an AI filter penalizes recycled or trend-copycat hooks), Promise (3-8s, clear promise + say main topic keywords out loud in the first 5 seconds — Shorts are now indexed separately in YouTube search), Proof/Value (concrete examples, clear structure, no dead time), CTA (point to a long-form video on the same channel if relevant — THE most valuable signal in 2026 — otherwise subscribe). ${isDense ?'100-130 words.' : '70-100 words.'} Aim for 30-45 seconds (the sweet spot). Original voiceover and audio favored by the algo.`
        : `Adapt length and energy to each platform (2026 algorithms: COMPLETION + SHARES/SAVES + original content everywhere): TikTok = dense and energetic (50-75 words, comments > likes, looping ending), Instagram = authentic (40-60 words, final payoff + DM share), Facebook = compact storytelling (40-60 words, 15-30s, saves + shares), YouTube = structured with spoken keywords (70-100 words, 30-45s, point to long-form video if relevant). ALL platforms use the 4-step structure: Hook / Promise / Proof/Value / CTA.`);

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

    // L'idée commune (étape C) : imposée, à adapter — jamais à remplacer.
    const briefLine = !sharedBrief ? '' : (isFr
      ? `IDÉE IMPOSÉE — la même pour toutes les plateformes de cette génération. Tu ne l'inventes pas, tu l'ADAPTES aux codes de ${platformName} : reformule, change le rythme, la longueur et le vocabulaire, mais garde le MÊME angle, la MÊME promesse et les MÊMES points de valeur. Ne change jamais de sujet.
${sharedBrief}
`
      : `IMPOSED IDEA — the same for every platform in this generation. You do not invent it, you ADAPT it to ${platformName}'s codes: rephrase, change the pace, length and vocabulary, but keep the SAME angle, the SAME promise and the SAME value points. Never change the subject.
${sharedBrief}
`);

    const systemPrompt = isFr
      ? `Tu es un expert en création de contenu viral pour les réseaux sociaux en 2026. Tu génères des scripts de Reels ultra-viraux, percutants et engageants.${culturalInstruction} Ton audience cible est composée de professionnels, créateurs et entrepreneurs cultivés. Le contenu doit être de haute qualité, intelligent et jamais simpliste, vulgaire ou racoleur — quel que soit le ton choisi.

Structure du script à TOUJOURS respecter (4 étapes) :
1. Hook (0-3s) : max 10-14 mots, ultra-choc, DOIT utiliser l'une de ces formules virales :
${formulaMenu}
2. Promise (3-8s) : 1 phrase — dis exactement ce que le viewer va gagner en restant jusqu'à la fin
3. Proof/Valeur : le corps du contenu — la substance, les conseils, les révélations concrètes
4. CTA (5-10 dernières secondes) : 1 seule action claire et directe

IMPORTANT — découpage du tableau "script" : l'étape Proof/Valeur doit être DÉCOUPÉE en 2 à 4 entrées SÉPARÉES du tableau (un "beat" par idée ou conseil, chacun assez court pour tenir sur une page-écran lisible en 2-3 secondes, max ~25 mots parlés). Le tableau "script" contient donc 5 à 7 entrées au total : Hook, Promise, 2-4 beats de Valeur, CTA. Préfixe chaque beat par "Valeur 1/3 :", "Valeur 2/3 :", etc. Ne fusionne JAMAIS toute la valeur en un seul gros bloc.

IMPORTANT — "screenText" est le MIROIR EXACT du tableau "script", ligne par ligne. RÈGLE ABSOLUE : "screenText" contient EXACTEMENT le MÊME nombre d'entrées que "script", dans le MÊME ordre, une par page-écran. Correspondance obligatoire section par section : screenText[1] = le texte à l'écran de la page HOOK, screenText[2] = celui de la PROMISE, puis UNE entrée pour CHAQUE beat de Valeur (Valeur 1/3, Valeur 2/3, ...), et la DERNIÈRE entrée = celle du CTA. Donc si "script" a 6 entrées, "screenText" a 6 entrées ; s'il en a 7, "screenText" en a 7. JAMAIS un nombre différent, JAMAIS une section fusionnée ou sautée. Compte tes entrées avant de répondre : les deux tableaux doivent avoir la même longueur. Chaque phrase RÉSUME sa page en 3 à 8 mots, lisible SANS le son (environ 85% regardent en muet, donc le texte à l'écran est le canal principal), impact fort. Ce ne sont PLUS 3 mots-clés isolés : ce sont des phrases-choc courtes, une par page du script.

IMPORTANT — "visualInspo" : 2 à 3 idées de PLANS / TOURNAGE très courtes (une phrase chacune) pour aider à filmer, adaptées aux CODES VISUELS de la plateforme : TikTok = brut, spontané, tourné au téléphone, plans rapides, lumière naturelle ; Instagram = "casual élevé" (soigné mais pas corporate, belle lumière, cadrage intentionnel, transitions fluides) ; Facebook = plans clairs, GROS texte lisible, rythme posé, explicite ; YouTube Shorts = 1re image ultra-forte, plans qui soutiennent l'info/la démo. Si l'utilisateur a décrit son visuel dans le sujet, PARS de cette scène. Reste concret et réalisable au téléphone. C'est un BONUS d'inspiration : garde-le COMPACT (2-3 idées max).

Stratégie hashtags : 1 hashtag large (#fyp ou équivalent plateforme) + 2-3 hashtags de catégorie + 2-3 hashtags niche-spécifiques = 5-8 hashtags au total. ÉVITER les hashtags avec des milliards de posts car ils noient le contenu.

Longueur et format : ${platformInstruction} Pas de remplissage inutile.

Visuel : si l'utilisateur décrit son visuel ou plan de tournage dans le sujet (ex: "visuel: je suis sur un bateau, bras dans les airs au vent"), exploite-le à fond — le hook, le script, le texte écran et la caption doivent coller à cette scène précise (la nommer, jouer avec, s'en servir comme mystère visuel ou pattern interrupt). Ne génère jamais un contenu générique qui ignore la scène décrite.

Cible : si l'utilisateur nomme sa cible dans le sujet (ex: "cible : propriétaires de petites agences", "pour coureurs débutants"), traite-la comme contraignante — le hook doit parler à la situation de cette personne précise, le script doit employer son vocabulaire et ses enjeux, et la caption doit sonner comme écrite pour elle. N'élargis jamais vers un public général.

${angleLine}
${briefLine}
${Array.isArray(recentHooks) && recentHooks.length > 0 ? `
DÉJÀ UTILISÉ — ne pas répéter : cet utilisateur a déjà reçu les accroches ci-dessous. Chaque accroche que tu écris maintenant doit être NEUVE : autre angle, autre formule d'ouverture, autre première phrase. Reformuler l'une d'elles compte comme une répétition. Même règle pour le texte à l'écran et la caption.
${recentHooks.filter((h: unknown) => typeof h === 'string').slice(0, 25).map((h: string) => `- ${h.slice(0, 120)}`).join('\n')}
` : ''}
Tu réponds TOUJOURS en JSON valide exactement selon le schéma demandé. Pas de texte en dehors du JSON.`
      : `You are an expert in creating viral content for social media in 2026. You generate ultra-viral, punchy and engaging Reel scripts.${culturalInstruction} Your target audience is made up of educated professionals, creatives and entrepreneurs. Content must be high quality, intelligent and never simplistic, vulgar or cheap — regardless of the chosen tone.

Script structure to ALWAYS follow (4 steps):
1. Hook (0-3s): max 10-14 words, ultra-shocking, MUST use one of these viral formulas:
${formulaMenu}
2. Promise (3-8s): 1 sentence — tell the viewer exactly what they'll gain by watching to the end
3. Proof/Value: the body of the content — the substance, tips, concrete revelations
4. CTA (last 5-10 seconds): 1 single clear and direct action

IMPORTANT — "script" array breakdown: the Proof/Value step must be SPLIT into 2 to 4 SEPARATE array entries (one "beat" per idea or tip, each short enough to fit on one on-screen page readable in 2-3 seconds, max ~25 spoken words). The "script" array therefore contains 5 to 7 entries total: Hook, Promise, 2-4 Value beats, CTA. Prefix each beat with "Value 1/3:", "Value 2/3:", etc. NEVER merge all the value into one big block.

IMPORTANT — "screenText" is the EXACT MIRROR of the "script" array, line by line. ABSOLUTE RULE: "screenText" contains EXACTLY the SAME number of entries as "script", in the SAME order, one per on-screen page. Mandatory section-by-section mapping: screenText[1] = the on-screen text of the HOOK page, screenText[2] = the PROMISE one, then ONE entry for EACH Value beat (Value 1/3, Value 2/3, ...), and the LAST entry = the CTA one. So if "script" has 6 entries, "screenText" has 6 entries; if it has 7, "screenText" has 7. NEVER a different number, NEVER a merged or skipped section. Count your entries before answering: both arrays must have the same length. Each line SUMS UP its page in 3 to 8 words, readable WITHOUT sound (about 85% watch muted, so on-screen text is the main channel), strong impact. These are NO LONGER 3 isolated keywords: they are short punchy lines, one per script page.

IMPORTANT — "visualInspo": 2 to 3 VERY SHORT shot/filming ideas (one sentence each) to help film the video, matching the platform's VISUAL CODES: TikTok = raw, spontaneous, phone-shot, fast cuts, natural light; Instagram = "elevated casual" (polished but not corporate, nice lighting, intentional framing, smooth transitions); Facebook = clear shots, LARGE readable text, steady pace, explicit; YouTube Shorts = ultra-strong first frame, shots that support the info/demo. If the user described their visual in the topic, START from that scene. Keep it concrete and phone-doable. It's a BONUS of inspiration: keep it COMPACT (2-3 ideas max).

Hashtag strategy: 1 broad hashtag (#fyp or platform equivalent) + 2-3 category hashtags + 2-3 niche-specific hashtags = 5-8 total. AVOID hashtags with billions of posts as they bury the content.

Length and format: ${platformInstruction} No filler.

Visual: if the user describes their visual or filming plan in the topic (e.g. "visual: I'm on a boat, arms up in the wind"), use it fully — the hook, script, screen text and caption must fit that exact scene (name it, play with it, use it as a visual mystery or pattern interrupt). Never generate generic content that ignores the described scene.

Audience: if the user names their target audience in the topic (e.g. "audience: small agency owners", "for beginner runners"), treat it as binding — the hook must speak to that exact person's situation, the script must use their vocabulary and their stakes, and the caption must sound written for them. Never widen it to a general audience.

${angleLine}
${briefLine}
${Array.isArray(recentHooks) && recentHooks.length > 0 ? `
ALREADY USED — do not repeat: this user has already received the hooks below. Every hook you write now must be NEW: a different angle, a different opening formula, a different first sentence. Rephrasing one of these counts as a repeat. Same rule for the screen text and the caption.
${recentHooks.filter((h: unknown) => typeof h === 'string').slice(0, 25).map((h: string) => `- ${h.slice(0, 120)}`).join('\n')}
` : ''}
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
    "hook": "accroche dite dès la 1re seconde — POV, prémisse ou promesse ultra-précise ; affirmation OU question/mystère, cohérente avec le payoff",
    "script": ["Hook (0-3s) : dit dès la 1re seconde, POV/prémisse/promesse", "Promise (3-8s) : ce que le viewer gagne en restant + repère de progression (ex: reste pour la chute finale)", "Proof/Valeur : corps DENSE sans temps mort, ton authentique et humain", "CTA : payoff satisfaisant à la fin, puis envie de l'envoyer par DM à une personne précise (ex: 'envoie ça à...', 'tag quelqu'un qui...')"],
    "screenText": ["texte à l'écran du HOOK — nomme la scène/situation EXACTE (3-8 mots, lisible sans son)", "texte à l'écran de la PROMISE", "puis UNE ligne pour CHAQUE beat de Valeur du script", "texte à l'écran du CTA — AU TOTAL exactement autant d'entrées que le tableau script ci-dessus, même ordre"],
    "visualInspo": ["idée de plan soigné et lumineux, cadrage intentionnel (style Instagram)", "2e idée de plan cohérente avec la scène"],
    "caption": "2-3 lignes de valeur après le hook de caption, puis question engageante pour commentaires. Emojis + 1 hashtag large + 2-3 hashtags catégorie + 2-3 hashtags niche = 5-8 hashtags. Note finale : 'Tip : teste ce Reel en Trial Reels pour atteindre de nouveaux audiences.'",
    "bestTime": "ex: Mardi-Jeudi, 18h-21h"
  },
  "tiktok": {
    "hook": "accroche ultra-choc max 12 mots, accroche en 2 secondes (formule imposée : ${formulaAt(0)})",
    "script": ["Hook (0-3s) : max 12 mots, accroche en 2s max", "Promise (3-8s) : ce que le viewer gagne en restant", "Proof/Valeur : corps DENSE avec mots-clés du sujet intégrés naturellement dans les phrases parlées (TikTok transcrit l'audio pour la recherche)", "CTA : question qui provoque des commentaires (ils pèsent plus que les likes) + partage/sauvegarde, fin qui reboucle sur le début pour le revisionnage"],
    "screenText": ["texte à l'écran du HOOK (3-7 mots, lisible à la vitesse du scroll)", "texte à l'écran de la PROMISE", "puis UNE ligne pour CHAQUE beat de Valeur du script", "texte à l'écran du CTA — AU TOTAL exactement autant d'entrées que le tableau script ci-dessus, même ordre"],
    "visualInspo": ["idée de plan brut, tourné au téléphone, énergie authentique (style TikTok)", "2e idée de plan rapide et dynamique"],
    "caption": "caption TikTok avec 1 hashtag large (#fyp ou #pourtoi) + 2-3 hashtags catégorie + 2-3 hashtags niche = 5-8 hashtags. Éviter les hashtags avec des milliards de posts.",
    "bestTime": "ex: Lundi-Vendredi, 19h-22h",
    "duration": "15-30s dense, ou 60s+ si le sujet le mérite",
    "soundTrend": "recommande en priorité un audio original (boosté par le nouvel algo 2026), avec 1 son tendance en option"
  },
  "facebook": {
    "hook": "accroche ultra-choc max 12 mots (formule imposée : ${formulaAt(1)})",
    "script": ["Hook (0-3s) : max 12 mots, formule virale", "Promise (3-8s) : ce que le viewer gagne en restant", "Proof/Valeur : storytelling COMPACT et dense — une seule idée forte, vise 15-30 secondes", "CTA : pousse la sauvegarde ou le partage, ou question qui fait réagir en commentaires"],
    "screenText": ["carte-titre du HOOK (5-8 mots, question ou affirmation forte, contraste fort)", "texte à l'écran de la PROMISE", "puis UNE ligne pour CHAQUE beat de Valeur du script", "texte à l'écran du CTA — AU TOTAL exactement autant d'entrées que le tableau script ci-dessus, même ordre"],
    "visualInspo": ["idée de plan clair avec GROS texte lisible, rythme posé (style Facebook)", "2e idée simple et explicite"],
    "caption": "caption Facebook engageante, clairement alignée sur les intérêts de l'audience visée. 1 hashtag large + 2-3 hashtags catégorie + 2-3 hashtags niche = 5-8 hashtags.",
    "bestTime": "ex: Mercredi-Vendredi, 12h-15h"
  },
  "youtube": {
    "hook": "accroche ultra-choc ABSOLUMENT max 10 mots — les 3 premières secondes décident si YouTube propulse ou enterre le Short (formule virale différente à chaque génération)",
    "script": ["Hook (0-3s) : ABSOLUMENT max 10 mots, formule virale — l'algo décide en 30-60 min", "Promise (3-8s) : promesse claire + prononce les mots-clés principaux à voix haute dans les 5 premières secondes", "Proof/Valeur : exemples concrets, structure claire, aucun temps mort", "CTA : renvoi vers une vidéo longue de la chaîne si pertinent (signal n°1 en 2026), sinon abonnement"],
    "screenText": ["texte à l'écran du HOOK dans les 3 premières secondes (3-7 mots, style 'H1')", "texte à l'écran de la PROMISE", "puis UNE ligne pour CHAQUE beat de Valeur du script", "texte à l'écran du CTA — AU TOTAL exactement autant d'entrées que le tableau script ci-dessus, même ordre"],
    "visualInspo": ["idée de 1re image ultra-forte + plan qui soutient la démo (style Shorts)", "2e idée de plan clair"],
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
    "hook": "hook said in the very first second — POV, premise or ultra-specific promise; statement OR question/mystery, coherent with the payoff",
    "script": ["Hook (0-3s): said in the very first second, POV/premise/promise", "Promise (3-8s): what viewer gains by staying + progression cue (e.g. stay for the final payoff)", "Proof/Value: DENSE body with no dead time, authentic and human tone", "CTA: satisfying payoff at the end, then make them want to send it by DM to one specific person (e.g. 'send this to...', 'tag someone who...')"],
    "screenText": ["on-screen text of the HOOK — names the EXACT scene/situation (3-8 words, readable without sound)", "on-screen text of the PROMISE", "then ONE line for EACH Value beat of the script", "on-screen text of the CTA — IN TOTAL exactly as many entries as the script array above, same order"],
    "visualInspo": ["a polished, well-lit shot idea with intentional framing (Instagram style)", "a 2nd shot idea matching the scene"],
    "caption": "2-3 lines of value after the caption hook, then engaging question for comments. Emojis + 1 broad hashtag + 2-3 category hashtags + 2-3 niche hashtags = 5-8 hashtags. Final note: 'Tip: test this Reel as Trial Reels to reach new audiences.'",
    "bestTime": "e.g: Tue-Thu, 6pm-9pm"
  },
  "tiktok": {
    "hook": "ultra-shocking hook max 12 words, hooks in 2 seconds (imposed formula: ${formulaAt(0)})",
    "script": ["Hook (0-3s): max 12 words, hooks in 2s max", "Promise (3-8s): what viewer gains by staying", "Proof/Value: DENSE body with topic keywords naturally integrated in spoken sentences (TikTok transcribes audio for search)", "CTA: question that sparks comments (they outweigh likes) + share/save, ending that loops back to the start for rewatches"],
    "screenText": ["on-screen text of the HOOK (3-7 words, readable at scroll speed)", "on-screen text of the PROMISE", "then ONE line for EACH Value beat of the script", "on-screen text of the CTA — IN TOTAL exactly as many entries as the script array above, same order"],
    "visualInspo": ["a raw, phone-shot idea with authentic energy (TikTok style)", "a 2nd fast, dynamic shot idea"],
    "caption": "TikTok caption with 1 broad hashtag (#fyp or #foryou) + 2-3 category hashtags + 2-3 niche hashtags = 5-8 hashtags. Avoid hashtags with billions of posts.",
    "bestTime": "e.g: Mon-Fri, 7pm-10pm",
    "duration": "dense 15-30s, or 60s+ if the topic deserves it",
    "soundTrend": "recommend original audio first (boosted by the 2026 algo), with 1 trending sound as an option"
  },
  "facebook": {
    "hook": "ultra-shocking hook max 12 words (imposed formula: ${formulaAt(1)})",
    "script": ["Hook (0-3s): max 12 words, viral formula", "Promise (3-8s): what viewer gains by staying", "Proof/Value: COMPACT, dense storytelling — one strong idea, aim 15-30 seconds", "CTA: push saves or shares, or a question that sparks comments"],
    "screenText": ["title card of the HOOK (5-8 words, strong question or statement, high contrast)", "on-screen text of the PROMISE", "then ONE line for EACH Value beat of the script", "on-screen text of the CTA — IN TOTAL exactly as many entries as the script array above, same order"],
    "visualInspo": ["a clear shot with LARGE readable text, steady pace (Facebook style)", "a 2nd simple, explicit idea"],
    "caption": "engaging Facebook caption clearly aligned with the target audience's interests. 1 broad hashtag + 2-3 category hashtags + 2-3 niche hashtags = 5-8 hashtags.",
    "bestTime": "e.g: Wed-Fri, 12pm-3pm"
  },
  "youtube": {
    "hook": "ultra-shocking hook ABSOLUTELY max 10 words — first 3 seconds decide if YouTube propels or buries the Short (use a different viral formula each generation)",
    "script": ["Hook (0-3s): ABSOLUTELY max 10 words, viral formula — algo decides in 30-60 min", "Promise (3-8s): clear promise + say main topic keywords out loud in the first 5 seconds", "Proof/Value: concrete examples, clear structure, no dead time", "CTA: point to a long-form video on the same channel if relevant (the #1 signal in 2026), otherwise subscribe"],
    "screenText": ["on-screen text of the HOOK within the first 3 seconds (3-7 words, 'H1' style)", "on-screen text of the PROMISE", "then ONE line for EACH Value beat of the script", "on-screen text of the CTA — IN TOTAL exactly as many entries as the script array above, same order"],
    "visualInspo": ["a strong first-frame idea + a shot that supports the demo (Shorts style)", "a 2nd clear shot idea"],
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
  "hook": "${platform === 'instagram' ? 'accroche dite dès la 1re seconde — POV, prémisse ou promesse ultra-précise ; affirmation OU question/mystère ; cohérente avec le payoff' : `accroche ultra-choc max 12 mots (formule imposée : ${formulaAt(0)})`}",
  "script": ["Hook (0-3s) : ${platform === 'instagram' ? 'dit dès la 1re seconde, POV/prémisse/promesse' : 'max 12 mots, formule virale'}", "Promise (3-8s) : ce que le viewer gagne en restant${platform === 'instagram' ? ' + repère de progression (ex: reste pour la chute finale...)' : ''}", "Proof/Valeur : le corps du contenu${platform === 'tiktok' ? ' — mots-clés du sujet intégrés dans les phrases parlées' : platform === 'youtube' ? ' — mots-clés prononcés dans les 5 premières secondes' : ''}", "CTA : ${platform === 'instagram' ? "payoff satisfaisant à la fin, puis envie de l'envoyer par DM à une personne précise (ex: 'envoie ça à...', 'tag quelqu'un qui...')" : platform === 'youtube' ? 'renvoi vers une vidéo longue de la chaîne ou abonnement' : platform === 'tiktok' ? 'question qui provoque des commentaires + partage/sauvegarde' : platform === 'facebook' ? 'pousse la sauvegarde ou le partage' : '1 action directe et claire'}"],
  "screenText": [${platform === 'instagram' ? '"texte écran du HOOK — nomme la scène EXACTE (3-8 mots, lisible sans son)", "texte écran de la PROMISE", "puis UNE ligne pour CHAQUE beat de Valeur", "texte écran du CTA — AU TOTAL autant de lignes que le tableau script ci-dessus, même ordre"' : platform === 'facebook' ? '"carte-titre du HOOK (5-8 mots, question ou affirmation forte)", "texte écran de la PROMISE", "puis UNE ligne pour CHAQUE beat de Valeur", "texte écran du CTA — AU TOTAL autant de lignes que le tableau script ci-dessus, même ordre"' : '"texte écran du HOOK (3-7 mots, lisible sans son)", "texte écran de la PROMISE", "puis UNE ligne pour CHAQUE beat de Valeur", "texte écran du CTA — AU TOTAL autant de lignes que le tableau script ci-dessus, même ordre"'}],
  "visualInspo": ["idée de plan/tournage courte adaptée à la plateforme", "2e idée de plan"],
  "caption": "${platform === 'instagram' ? '2-3 lignes de valeur + question engageante. Emojis + 1 hashtag large + 2-3 hashtags catégorie + 2-3 hashtags niche = 5-8 hashtags. Terminer par : Tip : teste ce Reel en Trial Reels pour atteindre de nouveaux audiences.' : platform === 'tiktok' ? '1 hashtag large (#fyp ou #pourtoi) + 2-3 hashtags catégorie + 2-3 hashtags niche = 5-8 hashtags. Éviter les hashtags avec des milliards de posts.' : '1 hashtag large + 2-3 hashtags catégorie + 2-3 hashtags niche = 5-8 hashtags.'}",
  "bestTime": "ex: Mardi-Jeudi, 18h-21h",
  ${platform === 'tiktok' ? '"duration": "15-30s dense, ou 60s+ si le sujet le mérite (les vidéos longues bien retenues surperforment en 2026)",' : ''}
  ${platform === 'tiktok' ? '"soundTrend": "recommande en priorité un audio original (boosté par le nouvel algo 2026), avec 1 son tendance en option"' : '"soundTrend": null'}${platform === 'youtube' ? `,
  "ytTitle": "titre optimisé SEO YouTube de 60 caractères max avec mot-clé principal",
  "seoDescription": "description YouTube de 150-200 mots optimisée SEO avec mots-clés naturellement intégrés, appel à l'action, et timestamps si pertinent",
  "keywords": ["mot-clé 1", "mot-clé 2", "mot-clé 3", "mot-clé 4", "mot-clé 5", "mot-clé 6", "mot-clé 7", "mot-clé 8"]` : ''}
}`
  : `Retourne EXACTEMENT ce JSON (et rien d'autre) avec 3 variations — chaque hook doit utiliser la formule virale IMPOSÉE ci-dessous, et elles sont toutes différentes :
{
  "variations": [
    {
      "hook": "accroche 1 — formule imposée : ${formulaAt(0)} — angle : ${angleAt(0)}",
      "script": ["Hook (0-3s) : max 12 mots, formule virale", "Promise (3-8s) : ce que le viewer gagne en restant", "Proof/Valeur : le corps${platform === 'tiktok' ? ' — mots-clés intégrés dans les phrases parlées' : platform === 'youtube' ? ' — mots-clés prononcés dans les 5 premières secondes' : ''}", "CTA : ${platform === 'instagram' ? "envie de l'envoyer par DM à une personne précise" : '1 action directe'}"],
      "screenText": ["texte à l'écran du HOOK (3-8 mots, lisible sans son)", "texte à l'écran de la PROMISE", "puis UNE ligne pour CHAQUE beat de Valeur du script", "texte à l'écran du CTA — AU TOTAL exactement autant d'entrées que le tableau script ci-dessus, même ordre"],
      "visualInspo": ["idée de plan/tournage courte adaptée à la plateforme", "2e idée de plan"],
      "caption": "caption 1 avec emojis + 1 hashtag large + 2-3 hashtags catégorie + 2-3 hashtags niche = 5-8 hashtags",
      "bestTime": "ex: Lundi-Mercredi, 12h-14h",
      ${platform === 'tiktok' ? '"duration": "15-30s dense ou 60s+",' : ''}
      ${platform === 'tiktok' ? '"soundTrend": "audio original ou son tendance 1"' : '"soundTrend": null'}${platform === 'youtube' ? `,
      "ytTitle": "titre YouTube optimisé SEO variation 1",
      "seoDescription": "description SEO YouTube variation 1",
      "keywords": ["mot-clé 1", "mot-clé 2", "mot-clé 3", "mot-clé 4", "mot-clé 5"]` : ''}
    },
    {
      "hook": "accroche 2 DIFFÉRENTE — formule imposée : ${formulaAt(1)} — angle : ${angleAt(1)}",
      "script": ["Hook (0-3s) : max 12 mots, formule virale différente", "Promise (3-8s) : ce que le viewer gagne en restant", "Proof/Valeur : le corps${platform === 'tiktok' ? ' — mots-clés intégrés dans les phrases parlées' : platform === 'youtube' ? ' — mots-clés prononcés dans les 5 premières secondes' : ''}", "CTA : ${platform === 'instagram' ? "envie différente de l'envoyer par DM à une personne précise" : '1 action directe'}"],
      "screenText": ["texte à l'écran du HOOK (3-8 mots, lisible sans son)", "texte à l'écran de la PROMISE", "puis UNE ligne pour CHAQUE beat de Valeur du script", "texte à l'écran du CTA — AU TOTAL exactement autant d'entrées que le tableau script ci-dessus, même ordre"],
      "visualInspo": ["idée de plan/tournage courte adaptée à la plateforme", "2e idée de plan"],
      "caption": "caption 2 différente avec 1 hashtag large + 2-3 hashtags catégorie + 2-3 hashtags niche = 5-8 hashtags",
      "bestTime": "ex: Vendredi-Dimanche, 19h-22h",
      ${platform === 'tiktok' ? '"duration": "15-30s dense ou 60s+",' : ''}
      ${platform === 'tiktok' ? '"soundTrend": "audio original ou son tendance 2"' : '"soundTrend": null'}${platform === 'youtube' ? `,
      "ytTitle": "titre YouTube optimisé SEO variation 2",
      "seoDescription": "description SEO YouTube variation 2",
      "keywords": ["mot-clé 1", "mot-clé 2", "mot-clé 3", "mot-clé 4", "mot-clé 5"]` : ''}
    },
    {
      "hook": "accroche 3 DIFFÉRENTE — formule imposée : ${formulaAt(2)} — angle : ${angleAt(2)}",
      "script": ["Hook (0-3s) : max 12 mots, troisième formule virale", "Promise (3-8s) : ce que le viewer gagne en restant", "Proof/Valeur : le corps${platform === 'tiktok' ? ' — mots-clés intégrés dans les phrases parlées' : platform === 'youtube' ? ' — mots-clés prononcés dans les 5 premières secondes' : ''}", "CTA : ${platform === 'instagram' ? "envie originale de l'envoyer par DM à une personne précise" : '1 action directe'}"],
      "screenText": ["texte à l'écran du HOOK (3-8 mots, lisible sans son)", "texte à l'écran de la PROMISE", "puis UNE ligne pour CHAQUE beat de Valeur du script", "texte à l'écran du CTA — AU TOTAL exactement autant d'entrées que le tableau script ci-dessus, même ordre"],
      "visualInspo": ["idée de plan/tournage courte adaptée à la plateforme", "2e idée de plan"],
      "caption": "caption 3 différente avec 1 hashtag large + 2-3 hashtags catégorie + 2-3 hashtags niche = 5-8 hashtags",
      "bestTime": "ex: Mardi-Jeudi, 7h-9h",
      ${platform === 'tiktok' ? '"duration": "15-30s dense ou 60s+",' : ''}
      ${platform === 'tiktok' ? '"soundTrend": "audio original ou son tendance 3"' : '"soundTrend": null'}${platform === 'youtube' ? `,
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
  "hook": "${platform === 'instagram' ? 'hook said in the very first second — POV, premise or ultra-specific promise; statement OR question/mystery; coherent with the payoff' : `ultra-shocking hook max 12 words (imposed formula: ${formulaAt(0)})`}",
  "script": ["Hook (0-3s): ${platform === 'instagram' ? 'said in the very first second, POV/premise/promise' : 'max 12 words, viral formula'}", "Promise (3-8s): what viewer gains by staying${platform === 'instagram' ? ' + progression cue (e.g. stay till the end for...)' : ''}", "Proof/Value: body${platform === 'tiktok' ? ' — topic keywords naturally integrated in spoken sentences' : platform === 'youtube' ? ' — keywords spoken out loud in first 5 seconds' : ''}", "CTA: ${platform === 'instagram' ? "satisfying payoff at the end, then make them want to send it by DM to one specific person (e.g. 'send this to...', 'tag someone who...')" : platform === 'youtube' ? 'point to a long-form video on the channel or subscribe' : platform === 'tiktok' ? 'question that sparks comments + share/save' : platform === 'facebook' ? 'push saves or shares' : '1 direct and clear action'}"],
  "screenText": [${platform === 'instagram' ? '"on-screen text of the HOOK — names the EXACT scene (3-8 words, readable without sound)", "on-screen text of the PROMISE", "then ONE line for EACH Value beat", "on-screen text of the CTA — IN TOTAL as many lines as the script array above, same order"' : platform === 'facebook' ? '"title card of the HOOK (5-8 words, strong question or statement)", "on-screen text of the PROMISE", "then ONE line for EACH Value beat", "on-screen text of the CTA — IN TOTAL as many lines as the script array above, same order"' : '"on-screen text of the HOOK (3-7 words, readable without sound)", "on-screen text of the PROMISE", "then ONE line for EACH Value beat", "on-screen text of the CTA — IN TOTAL as many lines as the script array above, same order"'}],
  "visualInspo": ["short shot/filming idea matching the platform's visual codes", "2nd shot idea"],
  "caption": "${platform === 'instagram' ? '2-3 lines of value + engaging question. Emojis + 1 broad hashtag + 2-3 category hashtags + 2-3 niche hashtags = 5-8 hashtags. End with: Tip: test this Reel as Trial Reels to reach new audiences.' : platform === 'tiktok' ? '1 broad hashtag (#fyp or #foryou) + 2-3 category hashtags + 2-3 niche hashtags = 5-8 hashtags. Avoid hashtags with billions of posts.' : '1 broad hashtag + 2-3 category hashtags + 2-3 niche hashtags = 5-8 hashtags.'}",
  "bestTime": "e.g: Tue-Thu, 6pm-9pm",
  ${platform === 'tiktok' ? '"duration": "dense 15-30s, or 60s+ if the topic deserves it (well-retained longer videos outperform in 2026)",' : ''}
  ${platform === 'tiktok' ? '"soundTrend": "recommend original audio first (boosted by the 2026 algo), with 1 trending sound as an option"' : '"soundTrend": null'}${platform === 'youtube' ? `,
  "ytTitle": "SEO-optimized YouTube title max 60 chars with main keyword",
  "seoDescription": "YouTube description 150-200 words SEO-optimized with keywords naturally integrated, call to action, and timestamps if relevant",
  "keywords": ["keyword 1", "keyword 2", "keyword 3", "keyword 4", "keyword 5", "keyword 6", "keyword 7", "keyword 8"]` : ''}
}`
  : `Return EXACTLY this JSON (nothing else) with 3 variations — each hook must use the IMPOSED viral formula below, and they are all different:
{
  "variations": [
    {
      "hook": "hook 1 — imposed formula: ${formulaAt(0)} — angle: ${angleAt(0)}",
      "script": ["Hook (0-3s): max 12 words, viral formula", "Promise (3-8s): what viewer gains by staying", "Proof/Value: body${platform === 'tiktok' ? ' — keywords integrated in spoken sentences' : platform === 'youtube' ? ' — keywords spoken in first 5 seconds' : ''}", "CTA: ${platform === 'instagram' ? "make them want to send it by DM to one specific person" : '1 direct action'}"],
      "screenText": ["on-screen text of the HOOK (3-8 words, readable without sound)", "on-screen text of the PROMISE", "then ONE line for EACH Value beat of the script", "on-screen text of the CTA — IN TOTAL exactly as many entries as the script array above, same order"],
      "visualInspo": ["short shot/filming idea matching the platform's visual codes", "2nd shot idea"],
      "caption": "caption 1 with emojis + 1 broad hashtag + 2-3 category hashtags + 2-3 niche hashtags = 5-8 hashtags",
      "bestTime": "e.g: Mon-Wed, 12pm-2pm",
      ${platform === 'tiktok' ? '"duration": "dense 15-30s or 60s+",' : ''}
      ${platform === 'tiktok' ? '"soundTrend": "original audio or trending sound 1"' : '"soundTrend": null'}${platform === 'youtube' ? `,
      "ytTitle": "SEO-optimized YouTube title variation 1",
      "seoDescription": "SEO YouTube description variation 1",
      "keywords": ["keyword 1", "keyword 2", "keyword 3", "keyword 4", "keyword 5"]` : ''}
    },
    {
      "hook": "DIFFERENT hook 2 — imposed formula: ${formulaAt(1)} — angle: ${angleAt(1)}",
      "script": ["Hook (0-3s): max 12 words, different viral formula", "Promise (3-8s): what viewer gains by staying", "Proof/Value: body${platform === 'tiktok' ? ' — keywords integrated in spoken sentences' : platform === 'youtube' ? ' — keywords spoken in first 5 seconds' : ''}", "CTA: ${platform === 'instagram' ? "a different reason to send it by DM to one specific person" : '1 direct action'}"],
      "screenText": ["on-screen text of the HOOK (3-8 words, readable without sound)", "on-screen text of the PROMISE", "then ONE line for EACH Value beat of the script", "on-screen text of the CTA — IN TOTAL exactly as many entries as the script array above, same order"],
      "visualInspo": ["short shot/filming idea matching the platform's visual codes", "2nd shot idea"],
      "caption": "different caption 2 with 1 broad hashtag + 2-3 category hashtags + 2-3 niche hashtags = 5-8 hashtags",
      "bestTime": "e.g: Fri-Sun, 7pm-10pm",
      ${platform === 'tiktok' ? '"duration": "dense 15-30s or 60s+",' : ''}
      ${platform === 'tiktok' ? '"soundTrend": "original audio or trending sound 2"' : '"soundTrend": null'}${platform === 'youtube' ? `,
      "ytTitle": "SEO-optimized YouTube title variation 2",
      "seoDescription": "SEO YouTube description variation 2",
      "keywords": ["keyword 1", "keyword 2", "keyword 3", "keyword 4", "keyword 5"]` : ''}
    },
    {
      "hook": "DIFFERENT hook 3 — imposed formula: ${formulaAt(2)} — angle: ${angleAt(2)}",
      "script": ["Hook (0-3s): max 12 words, third viral formula", "Promise (3-8s): what viewer gains by staying", "Proof/Value: body${platform === 'tiktok' ? ' — keywords integrated in spoken sentences' : platform === 'youtube' ? ' — keywords spoken in first 5 seconds' : ''}", "CTA: ${platform === 'instagram' ? "an original reason to send it by DM to one specific person" : '1 direct action'}"],
      "screenText": ["on-screen text of the HOOK (3-8 words, readable without sound)", "on-screen text of the PROMISE", "then ONE line for EACH Value beat of the script", "on-screen text of the CTA — IN TOTAL exactly as many entries as the script array above, same order"],
      "visualInspo": ["short shot/filming idea matching the platform's visual codes", "2nd shot idea"],
      "caption": "different caption 3 with 1 broad hashtag + 2-3 category hashtags + 2-3 niche hashtags = 5-8 hashtags",
      "bestTime": "e.g: Tue-Thu, 7am-9am",
      ${platform === 'tiktok' ? '"duration": "dense 15-30s or 60s+",' : ''}
      ${platform === 'tiktok' ? '"soundTrend": "original audio or trending sound 3"' : '"soundTrend": null'}${platform === 'youtube' ? `,
      "ytTitle": "SEO-optimized YouTube title variation 3",
      "seoDescription": "SEO YouTube description variation 3",
      "keywords": ["keyword 1", "keyword 2", "keyword 3", "keyword 4", "keyword 5"]` : ''}
    }
  ]
}`
}`);

    const message = await client.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: count > 1 ? 6000 : 3000,
      system: systemPrompt,
      messages: [{ role: 'user', content: userPrompt }],
    });

    const raw = (message.content[0] as { type: string; text: string }).text.trim();
    const fence = raw.match(/```(?:json)?\s*([\s\S]*?)```/);
    // Si pas de bloc fermé, retirer quand même une clôture ``` ouvrante/finale éventuelle
    const jsonStr = (fence ? fence[1] : raw.replace(/^```(?:json)?\s*/, '').replace(/```\s*$/, '')).trim();
    return JSON.parse(jsonStr);

    }; // ── fin de runFor ────────────────────────────────────────────────────────

    // Une seule plateforme : comportement d'avant, à l'identique.
    // Plusieurs : un appel par plateforme, tous lancés en même temps. Si l'une
    // échoue, on livre les autres plutôt que de tout perdre.
    let data;
    if (!multi) {
      data = await runFor(selected[0], variations ? 3 : 1);
    } else {
      const settled = await Promise.all(
        selected.map(p => runFor(p, 1).then(d => [p, d] as const).catch(() => [p, null] as const)),
      );
      const ok = settled.filter(([, d]) => d !== null);
      if (ok.length === 0) throw new Error('toutes les plateformes ont échoué');
      data = Object.fromEntries(ok);
      // On ne facture que les plateformes réellement livrées.
      cost = ok.length;
    }

    // ── Filet de sécurité : screenText DOIT avoir autant de pages que script ──
    if (Array.isArray(data?.variations)) {
      data.variations.forEach(alignScreenText);
    } else if (data?.instagram || data?.tiktok || data?.facebook || data?.youtube) {
      (['instagram', 'tiktok', 'facebook', 'youtube'] as const).forEach((p) => alignScreenText(data[p]));
    } else {
      alignScreenText(data);
    }

    // ── Incrément du compteur de générations (abonnés payants) ────────────────
    // L'historique complet vit maintenant sur l'appareil du client (localStorage,
    // voir lib/localHistory.ts) — plus aucune sauvegarde d'historique côté serveur.
    // `history: null` purge progressivement les anciens résumés stockés dans Clerk
    // (limite de métadonnées 8KB) au fil des générations.
    try {
      if (userId) {
        const clerk = await clerkClient();
        const user = await clerk.users.getUser(userId);
        const userEmail = user.emailAddresses[0]?.emailAddress?.toLowerCase() || '';
        const isAdminUser = ADMIN_EMAILS.includes(userEmail);
        const plan = (user.publicMetadata?.plan as string) || 'free';

        const isPaid = !isAdminUser && (plan === 'creator' || plan === 'pro' || plan === 'solo');
        const hasLegacyHistory = user.privateMetadata?.history !== undefined;

        if (isPaid) {
          const generationsUsed = (user.privateMetadata?.generationsUsed as number) || 0;
          await clerk.users.updateUserMetadata(userId, {
            privateMetadata: { generationsUsed: generationsUsed + cost, history: null },
          });
        } else if (hasLegacyHistory) {
          await clerk.users.updateUserMetadata(userId, {
            privateMetadata: { history: null },
          });
        }
      }
    } catch {
      // Ne pas bloquer la génération si la mise à jour échoue
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
