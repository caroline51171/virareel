// FAUSSE IA LOCALE — remplace api.anthropic.com pendant l'audit.
//
// Pourquoi : l'audit doit pouvoir tourner 100 fois sans coûter un sou et sans
// consommer d'essais. Le SDK Anthropic accepte une adresse de serveur par
// variable d'environnement (ANTHROPIC_BASE_URL), donc on le pointe ici.
// => AUCUNE ligne du site n'est modifiée pour l'audit.
//
// Ce serveur répond exactement comme l'API de Claude : même enveloppe
// ({ content: [{ type:'text', text }], usage: {...} }) et même JSON de contenu
// que celui décrit dans les gabarits de app/api/generate/route.ts. Si le vrai
// format change là-bas, c'est ici qu'il faut suivre.

import { createServer } from 'node:http';

const PORT = Number(process.env.MOCK_AI_PORT || 4010);

// Détecte la plateforme demandée dans le prompt (« Plateforme: TikTok »).
function platformOf(prompt) {
  const p = prompt.toLowerCase();
  if (p.includes('tiktok')) return 'tiktok';
  if (p.includes('youtube')) return 'youtube';
  if (p.includes('facebook')) return 'facebook';
  return 'instagram';
}

// Récupère le sujet écrit par la personne : les tests vérifient qu'il ressort
// bien à l'écran (donc que la demande envoyée est celle qui s'affiche).
function topicOf(prompt) {
  const m = prompt.match(/(?:Sujet|Topic)\s*:\s*(.+)/);
  return (m ? m[1] : 'sujet inconnu').trim().slice(0, 60);
}

function reel(platform, topic, n, isFr) {
  const tag = `[TEST ${platform}${n ? ` v${n}` : ''}]`;
  const script = isFr
    ? [
        `Hook (0-3s) : ${tag} ${topic}`,
        'Promesse (3-8s) : ce que vous gagnez en restant',
        'Valeur 1 : premier argument de test',
        'Valeur 2 : deuxième argument de test',
        'CTA : envoyez ceci à une personne précise',
      ]
    : [
        `Hook (0-3s): ${tag} ${topic}`,
        'Promise (3-8s): what you gain by staying',
        'Value 1: first test argument',
        'Value 2: second test argument',
        'CTA: send this to one specific person',
      ];

  const out = {
    hook: `${tag} ${topic}`,
    script,
    // Miroir volontairement PARFAIT (même longueur que script) : c'est le cas
    // normal. Le filet alignScreenText() du serveur est testé à part.
    screenText: script.map((s, i) => `Texte écran ${i + 1}`),
    visualInspo: ['Plan de test 1', 'Plan de test 2'],
    caption: `Légende de test ${topic} #test #reels #virareel #audit #mock`,
    bestTime: isFr ? 'Mar-Jeu, 7h-9h' : 'Tue-Thu, 7am-9am',
    soundTrend: platform === 'tiktok' ? 'Son tendance de test' : null,
  };
  // duration + soundTrend = TikTok seulement (décision produit, cf. mémoire).
  if (platform === 'tiktok') out.duration = '30-45s';
  if (platform === 'youtube') {
    out.ytTitle = `Titre SEO de test — ${topic}`;
    out.seoDescription = `Description SEO de test pour ${topic}`;
    out.keywords = ['mot-cle-1', 'mot-cle-2', 'mot-cle-3', 'mot-cle-4', 'mot-cle-5'];
  }
  return out;
}

function answerFor(system, prompt) {
  const isFr = /Génère|Sujet\s*:/.test(prompt);

  // 1) Le petit appel « idée partagée » (multi-plateformes) attend du TEXTE BRUT.
  if (/directeur de création|creative director/i.test(system)) {
    return isFr
      ? `ANGLE : angle de test\nPROMESSE : promesse de test\nVALEUR 1 : test\nVALEUR 2 : test\nVALEUR 3 : test\nCHUTE : chute de test`
      : `ANGLE: test angle\nPROMISE: test promise\nVALUE 1: test\nVALUE 2: test\nVALUE 3: test\nPAYOFF: test payoff`;
  }

  // 2) Transcréation : réécriture dans l'autre langue, même forme qu'un reel.
  // Le marqueur [TRAD] permet aux tests de distinguer l'original de la version
  // transcréée dans l'onglet.
  // ⚠️ La détection porte sur la 1re ligne EXACTE du prompt de transcréation, et
  // surtout PAS sur le mot « transcr » : le prompt du générateur normal contient
  // « transcrit / transcribes », ce qui détournait toutes les générations vers
  // cette branche (bug attrapé par l'audit lui-même le 2026-08-11).
  const versFr = prompt.startsWith('Reel source à transcréer');
  if (versFr || prompt.startsWith('Source Reel to transcreate')) {
    const out = reel(platformOf(prompt), 'transcréation de test', 0, versFr);
    out.hook = `[TRAD] ${out.hook}`;
    return JSON.stringify(out);
  }

  // 3) Génération normale : 3 variations si le gabarit les demande, sinon 1 script.
  const platform = platformOf(prompt);
  const topic = topicOf(prompt);
  if (prompt.includes('"variations"')) {
    return JSON.stringify({ variations: [1, 2, 3].map(n => reel(platform, topic, n, isFr)) });
  }
  return JSON.stringify(reel(platform, topic, 0, isFr));
}

const server = createServer((req, res) => {
  if (!req.url.includes('/v1/messages')) {
    res.writeHead(404).end('not a mock route');
    return;
  }
  let body = '';
  req.on('data', c => { body += c; });
  req.on('end', () => {
    let system = '', prompt = '';
    try {
      const parsed = JSON.parse(body);
      system = typeof parsed.system === 'string' ? parsed.system : '';
      const first = parsed.messages?.[0]?.content;
      prompt = typeof first === 'string' ? first : (first?.[0]?.text ?? '');
    } catch { /* corps illisible : on répond quand même du contenu valide */ }

    const text = answerFor(system, prompt);
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      id: 'msg_mock',
      type: 'message',
      role: 'assistant',
      model: 'claude-sonnet-4-6',
      content: [{ type: 'text', text }],
      stop_reason: 'end_turn',
      stop_sequence: null,
      // Valeurs fixes : /admin calcule un coût à partir des tokens, l'audit peut
      // donc vérifier ce calcul sans jamais dépenser un vrai token.
      usage: { input_tokens: 1000, output_tokens: 500 },
    }));
  });
});

server.listen(PORT, '127.0.0.1', () => {
  console.log(`[mock-ai] fausse IA prête sur http://127.0.0.1:${PORT} — 0 $, 0 token réel`);
});
