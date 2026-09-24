import { NextRequest, NextResponse } from 'next/server';
import { auth, clerkClient } from '@clerk/nextjs/server';
import Stripe from 'stripe';
import { Resend } from 'resend';
import { isAdminEmail } from '@/lib/access';
import { ecrireDepense, lireDepenses, lireJournal } from '@/lib/journal';
import { nomDuForfait } from '@/lib/historiqueForfaits';
import { decoderOrigine, type Origine } from '@/lib/origine';
import type { Evenement } from '@/lib/performance';

// Onglet Performance d'/admin : la liste BRUTE des événements du tunnel. Le navigateur
// filtre et regroupe lui-même (lib/performance.ts).
//
// Chaque événement vient de la source qui fait foi :
//   signup            → Clerk (date de création du compte)
//   lead_email        → Resend (liste des courriels du mur) + journal pour la provenance
//   first_trial       → journal (lib/journal.ts)
//   initiate_checkout → journal
//   purchase / refund → Stripe directement : un webhook manqué ne fausse jamais le revenu,
//                       et l'historique remonte au premier paiement.
// Les comptes de Caroline (ADMIN_EMAILS) sont exclus partout.

export const dynamic = 'force-dynamic';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);

async function verifierAdmin(): Promise<NextResponse | null> {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  const me = await (await clerkClient()).users.getUser(userId);
  if (!isAdminEmail(me.emailAddresses[0]?.emailAddress)) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  }
  return null;
}

function aplatir(o: Origine | null | undefined): Partial<Evenement> {
  if (!o) return {};
  return {
    utm_source: o.utm_source,
    utm_medium: o.utm_medium,
    utm_campaign: o.utm_campaign,
    utm_content: o.utm_content,
    fbclid: o.fbclid,
    landing_path: o.landing_path,
  };
}

// Montant en cents CAD réellement versé sur le compte Stripe. La page de paiement peut
// facturer en euros (prix adaptatif) : la transaction de solde, elle, est en dollars
// canadiens. Repli sur le montant facturé si elle n'existe pas encore.
function centsCad(bt: string | Stripe.BalanceTransaction | null | undefined, repli: number): number {
  if (bt && typeof bt === 'object' && bt.currency === 'cad') return Math.abs(bt.amount);
  return Math.abs(repli);
}

interface Compte {
  email: string;
  origine: Origine | null;
}

export async function GET() {
  const refus = await verifierAdmin();
  if (refus) return refus;
  const clerk = await clerkClient();
  const evenements: Evenement[] = [];

  // ── Comptes (Clerk), paginés : getUserList plafonne à 500 par page ──────────
  const comptes = new Map<string, Compte>();
  const admins = new Set<string>();
  const clientVersCompte = new Map<string, string>(); // client Stripe → userId
  for (let offset = 0; ; offset += 500) {
    const { data } = await clerk.users.getUserList({ limit: 500, offset });
    for (const u of data) {
      const email = (u.emailAddresses[0]?.emailAddress || '').toLowerCase();
      if (isAdminEmail(email)) { admins.add(u.id); continue; }
      const origine = decoderOrigine(u.privateMetadata?.origine);
      comptes.set(u.id, { email, origine });
      const cus = u.publicMetadata?.stripeCustomerId;
      if (typeof cus === 'string') clientVersCompte.set(cus, u.id);
      evenements.push({
        t: new Date(u.createdAt).toISOString(),
        type: 'signup',
        userId: u.id,
        email,
        ...aplatir(origine),
      });
    }
    if (data.length < 500) break;
  }

  // Un événement rattaché à un compte prend le courriel et la provenance DU COMPTE :
  // supprimer le compte les efface donc aussi d'ici (voir /privacy).
  const duCompte = (userId: string | undefined): Partial<Evenement> => {
    const c = userId ? comptes.get(userId) : undefined;
    return c ? { email: c.email, ...aplatir(c.origine) } : {};
  };

  // ── Journal : essais démarrés, clics forfait, et provenance des courriels ────
  const journal = await lireJournal();
  const provenanceLead = new Map<string, { t: string; origine?: Origine }>();
  for (const e of journal) {
    if (e.userId && admins.has(e.userId)) continue;
    if (e.type === 'lead_email') {
      if (!e.email || isAdminEmail(e.email)) continue;
      const deja = provenanceLead.get(e.email);
      if (!deja || e.t < deja.t) provenanceLead.set(e.email, { t: e.t, origine: e.origine });
      continue;
    }
    evenements.push({
      t: e.t,
      type: e.type,
      userId: e.userId,
      plan: e.plan ? nomDuForfait(e.plan) : undefined,
      ...(e.userId ? duCompte(e.userId) : aplatir(e.origine)),
    });
  }

  // ── Courriels du mur (Resend) : l'historique complet, un par adresse ────────
  const leads = new Map(provenanceLead);
  if (process.env.RESEND_API_KEY && process.env.RESEND_AUDIENCE_ID) {
    try {
      const resend = new Resend(process.env.RESEND_API_KEY);
      let after: string | undefined;
      for (let page = 0; page < 100; page++) {
        const { data } = await resend.contacts.list({
          audienceId: process.env.RESEND_AUDIENCE_ID,
          limit: 100,
          ...(after ? { after } : {}),
        });
        const contacts = data?.data || [];
        for (const c of contacts) {
          const email = (c.email || '').toLowerCase();
          if (!email || isAdminEmail(email) || !c.created_at) continue;
          const t = new Date(c.created_at).toISOString();
          const deja = leads.get(email);
          // La date la plus ancienne gagne ; la provenance vient du journal.
          if (!deja) leads.set(email, { t });
          else if (t < deja.t) leads.set(email, { ...deja, t });
        }
        if (!data?.has_more || contacts.length === 0) break;
        after = contacts[contacts.length - 1].id;
      }
    } catch (err) {
      // Non bloquant : les courriels du journal restent comptés.
      console.error('Performance : liste Resend illisible', err);
    }
  }
  for (const [email, l] of leads) {
    evenements.push({ t: l.t, type: 'lead_email', email, ...aplatir(l.origine) });
  }

  // ── Stripe : abonnements (qui est qui, quel forfait), paiements, remboursements ─
  const abonnements: { client: string; cree: number; userId?: string; plan?: string }[] = [];
  for await (const sub of stripe.subscriptions.list({ status: 'all', limit: 100 })) {
    const client = typeof sub.customer === 'string' ? sub.customer : sub.customer.id;
    const userId = sub.metadata?.userId || undefined;
    const plan = sub.items.data[0]?.price?.metadata?.checkoutKey || sub.metadata?.plan || undefined;
    abonnements.push({ client, cree: sub.created, userId, plan });
    if (userId && !clientVersCompte.has(client)) clientVersCompte.set(client, userId);
  }
  // Le forfait d'un paiement = celui de l'abonnement le plus récent de ce client À CETTE DATE.
  const forfaitA = (client: string, quand: number): string | undefined => {
    const candidats = abonnements.filter(a => a.client === client && a.cree <= quand + 60);
    const a = candidats.sort((x, y) => y.cree - x.cree)[0] ?? abonnements.find(x => x.client === client);
    return a?.plan ? nomDuForfait(a.plan) : undefined;
  };
  const estAdmin = (client: string, email: string | null | undefined) =>
    admins.has(clientVersCompte.get(client) ?? '') || isAdminEmail(email);

  const charges: Stripe.Charge[] = [];
  for await (const ch of stripe.charges.list({ limit: 100, expand: ['data.balance_transaction'] })) {
    if (ch.status === 'succeeded') charges.push(ch);
  }
  charges.sort((a, b) => a.created - b.created);
  const dejaPaye = new Set<string>();
  for (const ch of charges) {
    const client = typeof ch.customer === 'string' ? ch.customer : ch.customer?.id ?? '';
    if (estAdmin(client, ch.billing_details?.email)) continue;
    const userId = clientVersCompte.get(client);
    // Le 1er paiement d'un client est une conversion ; les suivants, des renouvellements.
    const renouvellement = !!client && dejaPaye.has(client);
    if (client) dejaPaye.add(client);
    evenements.push({
      t: new Date(ch.created * 1000).toISOString(),
      type: 'purchase',
      userId,
      email: ch.billing_details?.email?.toLowerCase() || undefined,
      plan: forfaitA(client, ch.created),
      montantCents: centsCad(ch.balance_transaction, ch.amount),
      stripeId: ch.payment_intent ? (typeof ch.payment_intent === 'string' ? ch.payment_intent : ch.payment_intent.id) : ch.id,
      client: client || undefined,
      renouvellement,
      ...duCompte(userId),
    });
  }

  for await (const r of stripe.refunds.list({ limit: 100, expand: ['data.balance_transaction', 'data.charge'] })) {
    if (r.status !== 'succeeded') continue;
    const ch = typeof r.charge === 'object' ? r.charge : null;
    const client = ch ? (typeof ch.customer === 'string' ? ch.customer : ch.customer?.id ?? '') : '';
    if (estAdmin(client, ch?.billing_details?.email)) continue;
    const userId = clientVersCompte.get(client);
    evenements.push({
      t: new Date(r.created * 1000).toISOString(),
      type: 'refund',
      userId,
      email: ch?.billing_details?.email?.toLowerCase() || undefined,
      plan: forfaitA(client, r.created),
      montantCents: centsCad(r.balance_transaction, r.amount),
      stripeId: r.id,
      client: client || undefined,
      ...duCompte(userId),
    });
  }

  return NextResponse.json({ evenements, depenses: await lireDepenses() });
}

// Dépense Meta d'UN jour, saisie dans le tableau. `montant` vide = case effacée.
export async function POST(req: NextRequest) {
  const refus = await verifierAdmin();
  if (refus) return refus;
  const { jour, montant } = await req.json().catch(() => ({}));
  if (typeof jour !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(jour)) {
    return NextResponse.json({ error: 'jour' }, { status: 400 });
  }
  const valeur = montant === null || montant === '' ? null : Number(montant);
  if (valeur !== null && (!Number.isFinite(valeur) || valeur < 0 || valeur > 100000)) {
    return NextResponse.json({ error: 'montant' }, { status: 400 });
  }
  const ok = await ecrireDepense(jour, valeur === null ? null : Math.round(valeur * 100) / 100);
  return NextResponse.json({ ok }, { status: ok ? 200 : 503 });
}
