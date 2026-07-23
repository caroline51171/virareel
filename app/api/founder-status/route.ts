import Stripe from 'stripe';
import { NextResponse } from 'next/server';
import { getFounderStatus, FounderStatus } from '@/lib/founder';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);

// Cache mémoire court : le compteur de places n'a pas besoin d'être à la seconde
// près, et ça évite d'interroger Stripe à chaque affichage de la page tarifs.
let cache: { at: number; data: FounderStatus } | null = null;
const TTL = 60_000; // 60 s

export async function GET() {
  const now = Date.now();
  if (cache && now - cache.at < TTL) {
    return NextResponse.json(cache.data);
  }
  const data = await getFounderStatus(stripe);
  cache = { at: now, data };
  return NextResponse.json(data);
}
