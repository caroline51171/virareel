import { NextRequest, NextResponse } from 'next/server';
import { Resend } from 'resend';
import { enregistrerMessage, marquerCourrielEnvoye, type Message } from '@/lib/messages';

// Le message est ENREGISTRÉ AVANT d'être envoyé. Avant, il ne vivait que dans le
// courriel : si Resend échouait, le visiteur voyait une erreur et le message
// disparaissait sans que personne ne sache qu'il avait écrit. Maintenant le courriel
// n'est plus que la notification rapide — la source qui compte est le stockage,
// relu par /admin.

// Le nom, le courriel et le message d-un inconnu sont insérés dans du HTML : sans
// échappement, on peut y glisser des balises et fabriquer un courriel d-apparence
// trafiquée qui semble venir de notre propre domaine.
function echapper(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export async function POST(req: NextRequest) {
  try {
    const { type, name, email, message, lang } = await req.json();

    if (!name || !email || !message || !type) {
      return NextResponse.json({ error: 'Missing fields' }, { status: 400 });
    }

    const enregistre: Message = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      date: new Date().toISOString(),
      type: String(type),
      nom: String(name).slice(0, 200),
      courriel: String(email).slice(0, 200),
      message: String(message).slice(0, 5000),
      courrielEnvoye: false,
    };
    await enregistrerMessage(enregistre);

    const typeLabels: Record<string, string> = {
      comment: lang === 'fr' ? '💬 Commentaire / Suggestion' : '💬 Comment / Suggestion',
      question: lang === 'fr' ? '❓ Question générale' : '❓ General question',
      support: lang === 'fr' ? '🛠️ Support technique' : '🛠️ Technical support',
    };
    const etiquette = echapper(typeLabels[enregistre.type] || enregistre.type);

    try {
      const resend = new Resend(process.env.RESEND_API_KEY);
      await resend.emails.send({
        from: 'ViraReel AI <noreply@virareelai.com>',
        to: 'hello@virareelai.com',
        replyTo: enregistre.courriel,
        subject: `[ViraReel] ${typeLabels[enregistre.type] || enregistre.type} — ${enregistre.nom}`,
        html: `
          <h2>${etiquette}</h2>
          <p><strong>Nom :</strong> ${echapper(enregistre.nom)}</p>
          <p><strong>Courriel :</strong> ${echapper(enregistre.courriel)}</p>
          <p><strong>Message :</strong></p>
          <p>${echapper(enregistre.message).replace(/\n/g, '<br>')}</p>
        `,
      });
      await marquerCourrielEnvoye(enregistre.id);
    } catch {
      // Le courriel a échoué, mais le message est en sécurité et visible dans /admin
      // (marqué « courriel non envoyé »). On ne renvoie donc PAS d'erreur au visiteur :
      // de son point de vue son message est bien arrivé, et c'est vrai.
    }

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: 'Failed to send' }, { status: 500 });
  }
}
