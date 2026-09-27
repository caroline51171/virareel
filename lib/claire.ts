// Alerte instantanée vers Claire, l'assistante service client (un bot dans Grok).
//
// À chaque message du formulaire Contact, le serveur POSTe vers le webhook de Claire
// TOUS les messages qu'elle n'a pas encore reçus (d'habitude un seul). Si le webhook
// refuse ou tarde, les messages restent « en attente » dans Upstash et repartent au
// prochain réveil : le prochain message, ou le rattrapage du matin
// (app/api/cron/claire). Rien ne se perd, et plusieurs messages en attente ne coûtent
// qu'un seul réveil.
//
// Côté serveur seulement : l'adresse et la clé vivent dans les variables
// d'environnement Vercel, jamais dans le code ni dans le navigateur.

import { createHmac, timingSafeEqual } from 'crypto';
import { messagesPourClaire, marquerClaireAvisee } from '@/lib/messages';

// Jeton de statut : signature de l'id du message avec CLAIRE_STATUT_KEY. Claire le
// renvoie à /api/contact/statut ; il ne vaut que pour CE message. Ainsi Claire n'a
// aucune clé à garder (le champ sécurisé de Grok ne la lui transmettait pas).
export function jetonStatut(id: string): string | null {
  const cle = process.env.CLAIRE_STATUT_KEY;
  return cle ? createHmac('sha256', cle).update(id).digest('hex') : null;
}

export function jetonValide(id: string, jeton: unknown): boolean {
  const attendu = jetonStatut(id);
  if (!attendu || typeof jeton !== 'string') return false;
  const a = Buffer.from(attendu);
  const b = Buffer.from(jeton);
  return a.length === b.length && timingSafeEqual(a, b);
}

const DELAI_MS = 4000;

export async function avertirClaire(): Promise<void> {
  const url = process.env.CLAIRE_WEBHOOK_URL;
  const cle = process.env.CLAIRE_WEBHOOK_KEY?.trim();
  if (!url || !cle) return; // pas encore branché : les messages attendent

  const enAttente = await messagesPourClaire();
  if (!enAttente.length) return;

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        // Accepte la valeur complète de l'en-tête (« Bearer abc… ») ou la clé seule.
        Authorization: cle.includes(' ') ? cle : `Bearer ${cle}`,
      },
      body: JSON.stringify({
        source: 'formulaire-contact-virareelai.com',
        nombre: enAttente.length,
        messages: enAttente.map(m => ({
          id: m.id,
          date: m.date,
          type: m.type,
          nom: m.nom,
          courriel: m.courriel,
          message: m.message,
          langue: m.langue ?? null,
          jeton: jetonStatut(m.id),
        })),
      }),
      signal: AbortSignal.timeout(DELAI_MS),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    await marquerClaireAvisee(enAttente.map(m => m.id));
  } catch (err) {
    console.error(`Claire : webhook non joint, ${enAttente.length} message(s) en attente`, err);
  }
}
