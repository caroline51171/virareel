import { NextRequest, NextResponse } from 'next/server';
import { avertirClaire } from '@/lib/claire';

// Rattrapage du matin (vercel.json → crons) : si des messages du formulaire n'ont pas
// pu joindre Claire (webhook en panne, refusé…), ils repartent ici, tous en un seul
// réveil. Vercel appelle cette route avec « Authorization: Bearer <CRON_SECRET> ».
export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get('authorization') !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  await avertirClaire();
  return NextResponse.json({ ok: true });
}
