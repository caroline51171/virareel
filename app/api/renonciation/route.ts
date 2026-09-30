import Stripe from 'stripe';
import { NextRequest, NextResponse } from 'next/server';
import { auth, clerkClient } from '@clerk/nextjs/server';
import { Resend } from 'resend';
import { enregistrerMessage, marquerCourrielEnvoye, type Message } from '@/lib/messages';
import { paysAvecRetractation } from '@/lib/consentement';
import { dansLeDelai, issueGlobale, courrielAccuse, dateHeure, type Issue } from '@/lib/renonciation';

// « Confirmer la renonciation » — voir lib/renonciation.ts pour les règles.
//
// Accessible SANS connexion (lien au bas de chaque page) : on retrouve l'abonnement par
// le courriel saisi. Connecté, on prend aussi le client Stripe du compte. Dans tous les
// cas, l'accusé part au courriel de l'ABONNEMENT (celui que Stripe connaît), pas à
// l'adresse tapée : quelqu'un qui taperait l'adresse d'un autre ne reçoit rien.
//
// La réponse est toujours la même (« demande reçue ») : la page ne dit jamais si une
// adresse a un abonnement ou non.
//
// Le remboursement passe par l'API Stripe, permis par Managed Payments (« You can issue
// refunds and update subscriptions in the Dashboard or with the API »). Link envoie
// lui-même son courriel de remboursement. L'annulation est faite ICI explicitement ;
// le webhook `charge.refunded` la ferait aussi, mais on ne dépend pas de son ordre
// d'arrivée. `customer.subscription.deleted` remet ensuite le compte en gratuit.

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);

const STATUTS_EN_COURS = new Set(['active', 'trialing', 'past_due', 'unpaid', 'incomplete']);

function idDe(ref: string | { id: string } | null | undefined): string | null {
  if (!ref) return null;
  return typeof ref === 'string' ? ref : ref.id;
}

interface Resultat {
  sub: string;
  issue: Issue;
  detail: string;
  courrielClient: string | null;
}

async function traiterAbonnement(sub: Stripe.Subscription, client: Stripe.Customer, maintenant: Date): Promise<Resultat> {
  const base = { sub: sub.id, courrielClient: client.email ?? null };

  // Toutes les factures PAYÉES de ce contrat (souscription, renouvellements,
  // ajustements de forfait) : un remboursement complet les rembourse toutes.
  const factures = (await stripe.invoices.list({ subscription: sub.id, limit: 100 })).data
    .filter(f => f.status === 'paid' && (f.amount_paid ?? 0) > 0 && f.id);
  if (!factures.length) return { ...base, issue: 'aucun_abonnement', detail: 'aucune facture payée' };

  // Premier paiement = la facture de souscription, sinon la plus ancienne payée.
  const premiere = factures.find(f => f.billing_reason === 'subscription_create')
    ?? factures[factures.length - 1];
  const payeLe = new Date((premiere.status_transitions?.paid_at ?? premiere.created) * 1000);

  // Pays de FACTURATION : celui de la carte (collecté par Link pour les taxes), sinon
  // l'adresse du client ou de la facture.
  const paiements = (await stripe.invoicePayments.list({ invoice: premiere.id!, limit: 10 })).data;
  let pays: string | null = null;
  for (const p of paiements) {
    const chargeId = idDe(p.payment?.charge)
      ?? idDe((await stripe.paymentIntents.retrieve(idDe(p.payment?.payment_intent) ?? '').catch(() => null))?.latest_charge);
    if (!chargeId) continue;
    const ch = await stripe.charges.retrieve(chargeId).catch(() => null);
    pays = ch?.billing_details?.address?.country ?? null;
    if (pays) break;
  }
  pays = pays ?? client.address?.country ?? premiere.customer_address?.country ?? null;

  const detail = `pays ${pays ?? 'inconnu'}, 1er paiement le ${dateHeure(payeLe, 'fr')}`;
  if (!dansLeDelai(payeLe, maintenant)) return { ...base, issue: 'hors_delai', detail };
  if (!pays) return { ...base, issue: 'a_traiter', detail: `${detail} — pays introuvable, à vérifier` };
  if (!paysAvecRetractation(pays)) return { ...base, issue: 'hors_zone', detail };

  try {
    for (const f of factures) {
      const ps = (await stripe.invoicePayments.list({ invoice: f.id!, limit: 10 })).data;
      for (const p of ps) {
        const pi = idDe(p.payment?.payment_intent);
        const ch = idDe(p.payment?.charge);
        if (!pi && !ch) continue;
        // Clé d'idempotence : un double clic ne rembourse jamais deux fois.
        await stripe.refunds.create(
          {
            ...(pi ? { payment_intent: pi } : { charge: ch! }),
            reason: 'requested_by_customer',
            metadata: { motif: 'renonciation_14_jours', abonnement: sub.id },
          },
          { idempotencyKey: `renonciation-${pi ?? ch}` },
        ).catch(async err => {
          // Déjà remboursé (demande refaite, ou remboursement fait à la main) : pas une panne.
          if (err?.code === 'charge_already_refunded') return;
          throw err;
        });
      }
    }
    await stripe.subscriptions.cancel(sub.id).catch(async err => {
      // Le webhook `charge.refunded` a pu l'annuler une fraction de seconde avant nous.
      const s = await stripe.subscriptions.retrieve(sub.id);
      if (s.status !== 'canceled') throw err;
    });
    return { ...base, issue: 'rembourse', detail: `${detail} — remboursé en entier, abonnement annulé` };
  } catch (err) {
    console.error('Renonciation : remboursement automatique impossible', sub.id, err);
    return { ...base, issue: 'a_traiter', detail: `${detail} — ÉCHEC du remboursement automatique : ${(err as Error).message}` };
  }
}

export async function POST(req: NextRequest) {
  let corps: { nom?: unknown; courriel?: unknown; lang?: unknown };
  try { corps = await req.json(); } catch { return NextResponse.json({ error: 'bad_request' }, { status: 400 }); }

  const nom = String(corps.nom ?? '').trim().slice(0, 200);
  const courriel = String(corps.courriel ?? '').trim().slice(0, 200);
  const lang: 'fr' | 'en' = corps.lang === 'en' ? 'en' : 'fr';
  if (!nom || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(courriel)) {
    return NextResponse.json({ error: 'missing_fields' }, { status: 400 });
  }

  const maintenant = new Date();
  const resultats: Resultat[] = [];

  try {
    // Clients Stripe concernés : celui du compte connecté + ceux de l'adresse saisie.
    // (Le filtre courriel de Stripe tient compte des majuscules : on essaie les deux.)
    const ids = new Set<string>();
    const { userId } = await auth();
    if (userId) {
      const u = await (await clerkClient()).users.getUser(userId).catch(() => null);
      const duCompte = u?.publicMetadata?.stripeCustomerId as string | undefined;
      if (duCompte) ids.add(duCompte);
    }
    for (const adresse of new Set([courriel, courriel.toLowerCase()])) {
      for (const c of (await stripe.customers.list({ email: adresse, limit: 10 })).data) ids.add(c.id);
    }

    for (const id of ids) {
      const client = await stripe.customers.retrieve(id);
      if (client.deleted) continue;
      const subs = (await stripe.subscriptions.list({ customer: id, status: 'all', limit: 20 })).data
        .filter(s => STATUTS_EN_COURS.has(s.status));
      for (const sub of subs) resultats.push(await traiterAbonnement(sub, client, maintenant));
    }
  } catch (err) {
    // Stripe injoignable : la demande est quand même reçue et enregistrée — Caroline la
    // traite à la main, dans le délai légal de 14 jours.
    console.error('Renonciation : lecture Stripe impossible', err);
    resultats.push({ sub: '?', issue: 'a_traiter', detail: `Stripe injoignable : ${(err as Error).message}`, courrielClient: null });
  }

  const issue = issueGlobale(resultats.map(r => r.issue));
  // L'accusé part à l'adresse que Stripe connaît pour l'abonnement ; à défaut
  // (aucun abonnement, Stripe muet), à l'adresse saisie.
  const destinataire = resultats.find(r => r.courrielClient)?.courrielClient ?? courriel;

  // Trace dans /admin (même liste que le formulaire Contact). Claire n'est PAS avisée :
  // l'accusé a déjà tout dit au client. Les cas « à traiter » sont signalés par courriel.
  const enregistre: Message = {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    date: maintenant.toISOString(),
    type: 'renonciation',
    nom,
    courriel,
    message: [
      `Issue : ${issue}`,
      `Accusé envoyé à : ${destinataire}`,
      ...(resultats.length ? resultats.map(r => `${r.sub} → ${r.issue} (${r.detail})`) : ['Aucun abonnement en cours trouvé.']),
    ].join('\n'),
    courrielEnvoye: false,
    langue: lang,
    claireAvisee: true,
  };
  await enregistrerMessage(enregistre);

  try {
    const resend = new Resend(process.env.RESEND_API_KEY);
    const { sujet, html } = courrielAccuse({ nom, courriel, date: maintenant, issue, lang });
    const { error } = await resend.emails.send({
      from: 'ViraReel AI <noreply@virareelai.com>',
      to: destinataire,
      replyTo: 'hello@virareelai.com',
      subject: sujet,
      html,
    });
    if (error) throw new Error(`${error.name}: ${error.message}`);
    await marquerCourrielEnvoye(enregistre.id);
  } catch (err) {
    console.error('Renonciation : accusé de réception NON envoyé', err);
  }

  // Avis à Caroline — surtout pour les cas « à traiter », qui ont un délai légal.
  try {
    const resend = new Resend(process.env.RESEND_API_KEY);
    await resend.emails.send({
      from: 'ViraReel AI <noreply@virareelai.com>',
      to: 'hello@virareelai.com',
      subject: `[ViraReel] ${issue === 'a_traiter' ? '⚠️ À TRAITER — ' : ''}Renonciation (${issue}) — ${nom}`,
      text: enregistre.message + `\n\nNom : ${nom}\nCourriel saisi : ${courriel}\nReçue le ${dateHeure(maintenant, 'fr')}`,
    });
  } catch (err) {
    console.error('Renonciation : avis à hello@ non envoyé', err);
  }

  return NextResponse.json({ ok: true, recueLe: maintenant.toISOString() });
}
