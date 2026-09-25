import { NextRequest, NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import Stripe from 'stripe';
import { clerkClient } from '@clerk/nextjs/server';
import { MODELE_IA } from '@/lib/modele';
import { estAudi } from '@/lib/audi';

// Page de santé : vérifie que les services dont dépend le site RÉPONDENT vraiment.
//
// Pourquoi : la page d'accueil est servie depuis le cache de Vercel. Le site peut
// donc avoir l'air « en ligne » alors que l'IA (crédits épuisés), Redis (compteurs),
// Stripe ou Clerk sont en panne. Aucune page de statut des fournisseurs ne montre
// des crédits Anthropic épuisés ; seul un vrai appel le voit.
//
// Public : { statut: 'OK' } (200) ou { statut: 'PROBLEME' } (503), rien d'autre.
// Détail par service : seulement pour Audi (lib/audi.ts — en-tête `x-audi` ou son
// cookie). Sans la variable Vercel AUDI_SECRET, le détail n'est jamais montré.
//
// Coût : le résultat est gardé 10 minutes (en mémoire + dans Redis, partagé entre les
// serveurs). Peu importe combien de fois la page est appelée, Claude, Stripe et Clerk
// sont interrogés au plus ~6 fois par heure. L'appel à Claude = le MÊME modèle que le
// générateur, 1 jeton de réponse, jamais une vraie génération.
//
// Rien d'une personne n'est lu ni écrit, et rien n'est compté dans les stats (/api/
// n'est pas vu par Vercel Analytics ni par le journal de l'admin).

const UPSTASH_URL = process.env.KV_REST_API_URL;
const UPSTASH_TOKEN = process.env.KV_REST_API_TOKEN;

const CLE_CACHE = 'sante:resultat';
const DUREE_OK_S = 10 * 60;   // un résultat OK est gardé 10 minutes
const DUREE_PANNE_S = 60;     // une panne, 1 minute : le retour se voit vite
const DELAI_MS = 2500;        // par service, en parallèle → réponse en moins de 3 s

type Etat = 'ok' | 'panne';
interface Resultat {
  statut: 'OK' | 'PROBLEME';
  verifieLe: string;
  services: Record<string, { etat: Etat; ms: number; erreur?: string }>;
}

let cacheMemoire: { r: Resultat; expire: number } | null = null;

function avecDelai<T>(p: Promise<T>): Promise<T> {
  return Promise.race([
    p,
    new Promise<T>((_, rej) => setTimeout(() => rej(new Error(`délai dépassé (${DELAI_MS} ms)`)), DELAI_MS)),
  ]);
}

async function mesurer(verif: () => Promise<unknown>) {
  const debut = Date.now();
  try {
    await avecDelai(verif());
    return { etat: 'ok' as Etat, ms: Date.now() - debut };
  } catch (e) {
    // Le message d'erreur du fournisseur (ex. « credit balance is too low »), coupé
    // court : c'est lui qui dit à Audi QUOI réparer.
    const erreur = (e instanceof Error ? e.message : String(e)).slice(0, 200);
    return { etat: 'panne' as Etat, ms: Date.now() - debut, erreur };
  }
}

async function upstash(commandes: unknown[][]): Promise<{ result: unknown; error?: string }[]> {
  const res = await fetch(`${UPSTASH_URL}/pipeline`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${UPSTASH_TOKEN}` },
    body: JSON.stringify(commandes),
    cache: 'no-store',
  });
  if (!res.ok) throw new Error(`Redis HTTP ${res.status}`);
  return res.json();
}

async function verifierTout(): Promise<Resultat> {
  const cles = {
    ANTHROPIC_API_KEY: process.env.ANTHROPIC_API_KEY,
    STRIPE_SECRET_KEY: process.env.STRIPE_SECRET_KEY,
    CLERK_SECRET_KEY: process.env.CLERK_SECRET_KEY,
    KV_REST_API_URL: UPSTASH_URL,
    KV_REST_API_TOKEN: UPSTASH_TOKEN,
    ANON_SECRET: process.env.ANON_SECRET,
  };
  const manquantes = Object.entries(cles).filter(([, v]) => !v).map(([k]) => k);

  const [cles_, redis, ia, stripe, clerk] = await Promise.all([
    mesurer(async () => { if (manquantes.length) throw new Error(`manquantes : ${manquantes.join(', ')}`); }),
    mesurer(async () => {
      const [r] = await upstash([['PING']]);
      if (r?.result !== 'PONG') throw new Error(r?.error ?? 'réponse inattendue');
    }),
    mesurer(() => new Anthropic({ apiKey: cles.ANTHROPIC_API_KEY, maxRetries: 0 }).messages.create({
      model: MODELE_IA,
      max_tokens: 1,
      messages: [{ role: 'user', content: 'ok' }],
    })),
    mesurer(() => new Stripe(cles.STRIPE_SECRET_KEY!, { maxNetworkRetries: 0 }).balance.retrieve()),
    mesurer(async () => (await clerkClient()).users.getCount()),
  ]);

  const services = { cles: cles_, redis, ia, stripe, clerk };
  const toutOk = Object.values(services).every(s => s.etat === 'ok');
  return { statut: toutOk ? 'OK' : 'PROBLEME', verifieLe: new Date().toISOString(), services };
}

async function resultatAJour(): Promise<Resultat> {
  if (cacheMemoire && cacheMemoire.expire > Date.now()) return cacheMemoire.r;

  if (UPSTASH_URL && UPSTASH_TOKEN) {
    try {
      const [r] = await avecDelai(upstash([['GET', CLE_CACHE]]));
      if (typeof r?.result === 'string') {
        const garde = JSON.parse(r.result) as Resultat;
        const reste = (garde.statut === 'OK' ? DUREE_OK_S : DUREE_PANNE_S) * 1000
          - (Date.now() - new Date(garde.verifieLe).getTime());
        if (reste > 0) {
          cacheMemoire = { r: garde, expire: Date.now() + reste };
          return garde;
        }
      }
    } catch {
      // Redis en panne : on vérifie en direct (la vérification le signalera).
    }
  }

  const r = await verifierTout();
  const duree = r.statut === 'OK' ? DUREE_OK_S : DUREE_PANNE_S;
  cacheMemoire = { r, expire: Date.now() + duree * 1000 };
  if (UPSTASH_URL && UPSTASH_TOKEN && r.services.redis.etat === 'ok') {
    try { await avecDelai(upstash([['SET', CLE_CACHE, JSON.stringify(r), 'EX', duree]])); } catch {}
  }
  return r;
}

export async function GET(req: NextRequest) {
  const r = await resultatAJour();
  const detail = estAudi(req);

  return NextResponse.json(detail ? r : { statut: r.statut }, {
    status: r.statut === 'OK' ? 200 : 503,
    // Jamais gardé par Vercel : chaque appel reçoit l'état réel (au cache de 10 min près).
    headers: { 'Cache-Control': 'no-store' },
  });
}
