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

import { messagesPourClaire, marquerClaireAvisee } from '@/lib/messages';

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
