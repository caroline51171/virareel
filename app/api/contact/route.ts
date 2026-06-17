import { NextRequest, NextResponse } from 'next/server';
import { Resend } from 'resend';

export async function POST(req: NextRequest) {
  const resend = new Resend(process.env.RESEND_API_KEY);
  try {
    const { type, name, email, message, lang } = await req.json();

    if (!name || !email || !message || !type) {
      return NextResponse.json({ error: 'Missing fields' }, { status: 400 });
    }

    const typeLabels: Record<string, string> = {
      comment: lang === 'fr' ? '💬 Commentaire / Suggestion' : '💬 Comment / Suggestion',
      question: lang === 'fr' ? '❓ Question générale' : '❓ General question',
      support: lang === 'fr' ? '🛠️ Support technique' : '🛠️ Technical support',
    };

    await resend.emails.send({
      from: 'ViraReel AI <noreply@virareelai.com>',
      to: 'hello@virareelai.com',
      replyTo: email,
      subject: `[ViraReel] ${typeLabels[type] || type} — ${name}`,
      html: `
        <h2>${typeLabels[type] || type}</h2>
        <p><strong>Nom :</strong> ${name}</p>
        <p><strong>Courriel :</strong> ${email}</p>
        <p><strong>Message :</strong></p>
        <p>${message.replace(/\n/g, '<br>')}</p>
      `,
    });

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: 'Failed to send' }, { status: 500 });
  }
}
