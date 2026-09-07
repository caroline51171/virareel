import crypto from 'crypto';
import { META_PIXEL_ID } from './pixel';

// Envoi d'un événement à l'API Conversions de Meta, côté serveur.
//
// Pourquoi ce fichier existe : l'envoi vivait uniquement dans app/api/capi/route.ts,
// donc la seule façon pour une autre route de l'utiliser était de s'appeler elle-même
// en HTTP. C'est ce que fait le webhook Stripe pour l'Achat — et ça a un défaut réel :
// la route lisait l'adresse IP et le navigateur DE CETTE REQUÊTE INTERNE, c'est-à-dire
// ceux de Vercel, jamais ceux du client. On envoyait donc de fausses données
// d'appariement à Meta pour chaque Achat.
//
// Ici, tout ce qui identifie la personne est passé EXPLICITEMENT par l'appelant. Une
// route touchée par le navigateur du client donne ses vraies valeurs ; le webhook
// Stripe, qui n'en a aucune, n'en donne aucune plutôt que celles de Vercel.
//
// ⚠️ Le consentement n'est PAS vérifié ici : c'est à l'appelant de le faire, parce
// que lui seul sait de qui vient la requête (voir lib/consentement.ts). Cette
// fonction envoie ce qu'on lui donne.

const API = 'https://graph.facebook.com/v21.0';

function sha256(v: string): string {
  return crypto.createHash('sha256').update(v.trim().toLowerCase()).digest('hex');
}

export interface EvenementCapi {
  /** Nom Meta exact : 'PageView', 'Lead', 'InitiateCheckout', 'Purchase'. */
  event: string;
  /**
   * DOIT être identique à celui de la copie envoyée par le navigateur, sinon Meta
   * compte l'événement deux fois. Meta déduplique sur (nom + id) pendant 48 h.
   */
  eventId: string;
  url?: string;
  value?: number;
  currency?: string;
  /** Jamais transmis en clair à Meta : seule son empreinte SHA-256 part. */
  email?: string;
  /** Cookies posés par le pixel dans le navigateur. Font monter l'appariement. */
  fbp?: string;
  fbc?: string;
  /** Ceux DU CLIENT. À omettre plutôt qu'à remplir avec ceux de notre serveur. */
  clientIp?: string;
  clientUserAgent?: string;
}

/**
 * Renvoie `true` si Meta a accepté l'événement. Ne lance jamais : un problème de
 * mesure ne doit jamais casser le parcours d'un client qui paie.
 */
export async function envoyerACapi(e: EvenementCapi): Promise<boolean> {
  const token = process.env.META_CAPI_TOKEN;
  if (!token || !e.event || !e.eventId) return false;

  const userData: Record<string, unknown> = {};
  if (e.clientUserAgent) userData.client_user_agent = e.clientUserAgent;
  if (e.clientIp) userData.client_ip_address = e.clientIp;
  if (e.email) userData.em = [sha256(e.email)];
  if (e.fbp) userData.fbp = e.fbp;
  if (e.fbc) userData.fbc = e.fbc;

  const customData: Record<string, unknown> = {};
  if (typeof e.value === 'number' && e.value > 0) {
    customData.value = e.value;
    customData.currency = e.currency || 'CAD';
  }

  try {
    const res = await fetch(`${API}/${META_PIXEL_ID}/events?access_token=${token}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        data: [{
          event_name: e.event,
          event_time: Math.floor(Date.now() / 1000),
          event_id: e.eventId,
          event_source_url: e.url,
          action_source: 'website',
          user_data: userData,
          ...(Object.keys(customData).length ? { custom_data: customData } : {}),
        }],
      }),
    });
    if (!res.ok) console.error(`CAPI ${e.event} refusé par Meta : ${res.status}`);
    return res.ok;
  } catch (err) {
    console.error(`CAPI ${e.event} : envoi impossible`, err);
    return false;
  }
}

/**
 * Ce que la requête du CLIENT nous apprend sur lui. À n'appeler que sur une requête
 * venue de son navigateur — jamais sur un webhook, qui donnerait l'IP de Stripe.
 */
export function identitéDepuisRequete(req: {
  headers: { get(nom: string): string | null };
  cookies: { get(nom: string): { value: string } | undefined };
}): Pick<EvenementCapi, 'clientIp' | 'clientUserAgent' | 'fbp' | 'fbc'> {
  return {
    clientIp: (req.headers.get('x-forwarded-for') || '').split(',')[0].trim() || undefined,
    clientUserAgent: req.headers.get('user-agent') || undefined,
    fbp: req.cookies.get('_fbp')?.value,
    fbc: req.cookies.get('_fbc')?.value,
  };
}
