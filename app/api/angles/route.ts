import Anthropic from '@anthropic-ai/sdk';
import { NextRequest, NextResponse } from 'next/server';

export const maxDuration = 60;

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

// ─── « Propose-moi 4 angles » ───────────────────────────────────────────────────
// AIDE À LA SAISIE, pas une livraison : cette route ne rend AUCUN script, donc
// elle ne consomme ni crédit ni essai et ne touche pas au cookie de quota.
// Elle remplit seulement les 4 champs « idée » du mode 4 idées, qui restent
// entièrement modifiables ensuite.
//
// ⚠️ RÈGLE PRODUIT/SERVICE : cet appel parle d'un produit sans écrire de script.
// C'est exactement le profil de l'appel « directeur de création » qui avait
// inventé une fonction inexistante le 2026-08-17. La garde « aucune invention »
// est donc obligatoire ici dès le premier jour.

const MAX_ANGLE = 160;  // identique au maxLength du champ idée dans Generator.tsx

export async function POST(req: NextRequest) {
  try {
    const { topic, lang } = await req.json();

    if (!topic || String(topic).trim().length < 3) {
      return NextResponse.json({ error: 'topic too short' }, { status: 400 });
    }
    const isFr = lang === 'fr';

    const system = isFr
      ? `Tu es directeur de création publicitaire. On te donne un sujet, tu proposes QUATRE ANGLES pour en parler — pas quatre sujets différents, quatre façons d'attaquer le MÊME sujet.

Les quatre angles doivent couvrir le tunnel au complet, dans cet ordre :
1. LA DOULEUR — le moment précis où la personne bloque.
2. LE COÛT — ce que le problème lui prend (temps, argent, énergie).
3. L'OBJECTION — la raison pour laquelle elle hésiterait, retournée en sa faveur.
4. L'OFFRE — la raison d'essayer maintenant, sans risque.

Chaque angle est NEUF par rapport aux trois autres : autre entrée, autre première idée. Reformuler un angle voisin compte comme une répétition.

INTERDICTION ABSOLUE D'INVENTER : n'attribue au produit ou au service AUCUNE fonction, capacité, chiffre ou résultat qui ne soit pas écrit noir sur blanc dans le sujet. Si le sujet dit qu'un outil écrit des textes, tu ne peux pas laisser entendre qu'il analyse des images, lit des vidéos ou garantit des résultats. Aucun fait personnel inventé non plus.

FORMAT : ${MAX_ANGLE} caractères MAXIMUM par angle, une ligne chacun, pas de guillemets, pas de numéro, pas de point final. Du concret, pas du slogan.`
      : `You are an advertising creative director. Given a topic, you propose FOUR ANGLES on it — not four different topics, four ways to attack the SAME topic.

The four angles must cover the whole funnel, in this order:
1. THE PAIN — the exact moment the person gets stuck.
2. THE COST — what the problem takes from them (time, money, energy).
3. THE OBJECTION — why they would hesitate, turned in their favour.
4. THE OFFER — the reason to try now, risk-free.

Each angle must be NEW compared to the other three: different entry, different first idea. Rewording a neighbouring angle counts as a repetition.

ABSOLUTELY NO INVENTION: do not attribute to the product or service ANY feature, capability, number or result that is not written explicitly in the topic. If the topic says a tool writes text, you cannot imply it analyses images, reads videos or guarantees results. No invented personal facts either.

FORMAT: ${MAX_ANGLE} characters MAXIMUM per angle, one line each, no quotes, no numbering, no final period. Concrete, not slogans.`;

    const msg = await client.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 300,
      system,
      messages: [{
        role: 'user',
        content: isFr
          ? `Sujet :\n${String(topic).slice(0, 1200)}\n\nDonne les 4 angles, un par ligne, rien d'autre.`
          : `Topic:\n${String(topic).slice(0, 1200)}\n\nGive the 4 angles, one per line, nothing else.`,
      }],
    });

    const raw = msg.content[0]?.type === 'text' ? msg.content[0].text : '';

    // Le modèle peut glisser une numérotation ou un tiret malgré la consigne :
    // on nettoie avant de remplir les champs, sinon on écrit « 1. » dans l'input.
    const angles = raw
      .split('\n')
      .map(l => l.trim())
      .filter(Boolean)
      .map(l => l.replace(/^\s*(?:\d+[.)]|[-–—•*])\s*/, '').replace(/^["'«»\s]+|["'«»\s]+$/g, ''))
      .filter(Boolean)
      .slice(0, 4)
      .map(l => l.slice(0, MAX_ANGLE));

    if (angles.length < 4) {
      return NextResponse.json({ error: 'incomplete' }, { status: 502 });
    }

    return NextResponse.json({ angles });
  } catch {
    return NextResponse.json({ error: 'server error' }, { status: 500 });
  }
}
