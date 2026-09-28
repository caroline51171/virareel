'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { langueChoisie } from '@/lib/langue';
import { FOUNDER_ENABLED } from '@/lib/pricing';

// Les conditions vivent à UNE SEULE adresse, /cgv : pas de /en/cgv orpheline.
// Le français est ce que contient la page livrée (donc ce que Google indexe) ;
// l'anglais le remplace dans le navigateur quand l'interface est en anglais,
// selon la même règle que le reste du site (lib/langue.ts).
//
// Traduction du texte français du 21 septembre 2026 — même fond juridique, aucune
// différence de sens entre les deux versions. Toute modification d'un des deux
// textes doit être reportée dans l'autre le jour même.
export default function CgvEn({ fr }: { fr: React.ReactNode }) {
  const [lang, setLang] = useState<'fr' | 'en'>('fr');
  useEffect(() => setLang(langueChoisie()), []);
  // Titre d'onglet : les métadonnées du serveur sont en français (Next les insère
  // parfois APRÈS le chargement). On réécrit donc le texte de chaque balise <title>
  // de la page, et on recommence si Next en ajoute une.
  useEffect(() => {
    if (lang !== 'en') return;
    const titre = 'Terms of Service — ViraReel AI';
    const appliquer = () => document.querySelectorAll('title').forEach(el => { if (el.textContent !== titre) el.textContent = titre; });
    appliquer();
    const obs = new MutationObserver(appliquer);
    obs.observe(document.head, { childList: true, subtree: true, characterData: true });
    return () => obs.disconnect();
  }, [lang]);

  if (lang === 'fr') return <>{fr}</>;

  return (
    <div className="min-h-screen bg-slate-950 text-slate-300 px-4 py-16">
      <div className="max-w-3xl mx-auto">
        <Link href="/" className="text-violet-400 hover:text-violet-300 text-sm mb-8 inline-block">
          ← Back to ViraReel AI
        </Link>

        <h1 className="text-3xl font-black text-white mb-2">Terms of Service</h1>
        <p className="text-slate-500 text-sm mb-12">ViraReel AI — Last updated: 27 September 2026</p>

        <div className="space-y-10">

          <section>
            <h2 className="text-xl font-bold text-white mb-3">1. Purpose of the service</h2>
            <p>ViraReel AI provides an AI-powered service that helps create text content for social media (Instagram, TikTok, YouTube, Facebook). The Service is available free of charge for a limited trial, and as a paid subscription — monthly or annual, at your choice — for regular use.</p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-white mb-3">2. How plans and subscriptions work</h2>
            <ul className="list-disc pl-5 space-y-2">
              <li><strong className="text-white">Free trial:</strong> every visitor gets 12 free generations with no account and no credit card, then 6 additional generations by providing an email address.</li>
              <li><strong className="text-white">Solo plan:</strong> up to 60 generations per month.</li>
              <li><strong className="text-white">Creator plan:</strong> up to 160 generations per month.</li>
              <li><strong className="text-white">Agency plan:</strong> up to 1000 generations per month.</li>
            </ul>
            <p className="mt-3">Every plan is available monthly or annually, chosen at sign-up. The annual subscription is billed the equivalent of ten months: two months are free. In both cases, the subscription is sold by Sold through Link, LLC (Stripe), acting as merchant of record, as described in section 5.</p>
            <p className="mt-3">Prices shown in the Pricing section of the site are in Canadian dollars excluding taxes, or in euros including VAT depending on the country you connect from. Applicable taxes are calculated and collected by Link. The final amount and currency are shown on Link’s checkout page before you confirm. If you pay in a currency other than the one shown, the amount is converted at each payment and may vary slightly. While a promotional offer is running (in particular the &laquo;&nbsp;founding member&nbsp;&raquo; price), the price charged is the one displayed at the time of subscription; once the offer ends, the public price applies to new subscriptions.</p>
            <p className="mt-3">A &laquo;&nbsp;generation&nbsp;&raquo; is counted as soon as a text is created for a specific platform. The count therefore works as follows:</p>
            <ul className="list-disc pl-5 space-y-2 mt-3">
              <li>One script for one platform: <strong className="text-white">1 generation</strong>.</li>
              <li>The same script for all four platforms in one click: <strong className="text-white">4 generations</strong>.</li>
              <li>Three variations of the same script: <strong className="text-white">3 generations</strong>.</li>
              <li>The &laquo;&nbsp;4 ideas&nbsp;&raquo; mode runs four generations, one per idea: from <strong className="text-white">4 generations</strong> (a single platform) to <strong className="text-white">16</strong> (all four platforms).</li>
              <li>The button that suggests starting angles produces no publishable text: it uses <strong className="text-white">no generation</strong>.</li>
            </ul>
            <p className="mt-3">The generation quota renews every month, including on an annual subscription. Generations left unused during a month are permanently lost and are not carried over to the next month.</p>
            <p className="mt-3">A bonus trial covering a first batch of the &laquo;&nbsp;4 ideas&nbsp;&raquo; mode may be offered, once only and before any subscription, to users discovering the Service. It cannot be combined or carried over, does not apply to paid plans, and ViraReel AI may change or withdraw it at any time.</p>
            {FOUNDER_ENABLED && <p className="mt-3">The &laquo;&nbsp;founding member&nbsp;&raquo; price (locked for life) applies exclusively to the plan subscribed to at the time of joining the offer. If you switch to a different plan, the standard price of the new plan applies — this rate is not transferable.</p>}
          </section>

          <section>
            <h2 className="text-xl font-bold text-white mb-3">3. Payment and renewal</h2>
            <p>The subscription is billed on a recurring basis according to the periodicity chosen at sign-up — monthly or annual — on the anniversary date of that sign-up. Each payment, including renewals, is charged by Sold through Link, LLC (Stripe) and appears on your card statement as “LINK.COM*”. The subscription renews automatically at each period, unless cancelled by the user before the renewal date.</p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-white mb-3">4. Cancellation and termination</h2>
            <p>Users can cancel their subscription or change plans at any time, on their own, using the “Manage my subscription” button in their ViraReel AI account history, which opens Stripe’s subscription management portal. Depending on the options Link provides, they can also manage their subscription from their Link account, if they have one. If you cancel, access to the Service stays active until the end of the period already paid for (month or year, depending on the periodicity chosen), and the monthly quota continues to apply until that date. No further payment will be taken afterwards. Refunds are covered in section 5.</p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-white mb-3">5. Purchases, Refunds and Right of Withdrawal</h2>
            <p className="mb-3">Subscriptions are sold by Sold through Link, LLC (“Link”), which acts as the merchant of record: Link appears on the checkout page, on your receipts and on your card statement (“LINK.COM*”), and collects applicable taxes. Refunds, including the exercise of any right of withdrawal or cancellation the law grants you (in particular in the European Union and the United Kingdom), are governed by Link’s terms and refund policy, available from the checkout page and your receipts. For any request, go to support.link.com and contact Link’s support team; you can also write to us at <a href="mailto:hello@virareelai.com" className="text-violet-400 hover:text-violet-300">hello@virareelai.com</a> and we will point you in the right direction.</p>
            <p className="mb-3">The 12 free generations advertised, with no account or credit card required, let you try the Service before any purchase.</p>
            <p className="mb-3">A full refund ends the subscription: access to the Service and the quota stop at that time. In the case of a duplicate charge, only the extra payment is refunded and the subscription continues.</p>
            <p>To end a subscription and avoid any renewal, see section 4.</p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-white mb-3">6. Accounts and acceptable use</h2>
            <p className="mb-3">You are responsible for keeping your login credentials confidential. ViraReel AI reserves the right to suspend or delete any account in the event of proven abuse, in particular the creation of multiple accounts to bypass the free trial limit, or any attempt to defraud the Service.</p>
            <p className="mb-3">It is strictly forbidden to use ViraReel AI to generate content that is:</p>
            <ul className="list-disc pl-5 space-y-2">
              <li>Hateful, discriminatory, racist, sexist or harassing towards any person or group of people.</li>
              <li>Misleading, fraudulent or designed to defraud others (fake promotions, scams, phishing).</li>
              <li>Dangerous medical, financial or scientific misinformation.</li>
              <li>Promoting illegal activities, illicit substances, or criminal organisations.</li>
              <li>Harmful to the privacy or reputation of an identifiable person.</li>
              <li>Intended to psychologically manipulate vulnerable people.</li>
              <li>In breach of the terms of use of the targeted social media platforms (TikTok, Instagram, YouTube, Facebook).</li>
            </ul>
            <p className="mt-3">Any breach of these rules may result in the immediate and permanent suspension of the account. In that case, no refund is owed for the current period, subject to the rights granted to consumers by law and to the refund policy of Sold through Link, LLC. ViraReel AI reserves the right to report any manifest abuse to the competent authorities.</p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-white mb-3">7. Intellectual property and generated content</h2>
            <p className="mb-3">You keep full ownership of, and full responsibility for, the ideas and text you submit to the Service.</p>
            <p className="mb-3">To the extent ViraReel AI holds any rights in the scripts and text generated by the Service, it assigns them to you; ViraReel AI claims no ownership of that content. You may use, reproduce, modify, adapt, publish and commercially exploit it freely, worldwide and royalty-free, including on social networks, in ads, and for clients if you are a professional or an agency.</p>
            <p className="mb-3">When the Service offers an export (including TXT, Markdown or CSV), you may download and keep those files for the uses above. ViraReel AI does not guarantee that content is stored on its servers: history may remain on your device only, as described in how the Service works and in the Privacy Policy.</p>
            <p className="mb-3">You alone are responsible for checking that generated content does not infringe third-party rights (trade-marks, trade names, copyright, image or personality rights, etc.) and that it complies with the rules of the platforms where you publish it. The fact that the Service suggests text does not give you permission to misuse a third party&apos;s brand, logo or identity. ViraReel AI does not warrant that generated content is free of third-party rights.</p>
            <p>Trade-marks, names and logos of Meta, Instagram, Facebook, TikTok, YouTube and any other third party remain their owners&apos; property. Mentioning them in the Service or in generated content does not imply any affiliation or endorsement.</p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-white mb-3">8. Liability and availability of the service</h2>
            <p>ViraReel AI does everything it can to provide relevant scripts, but cannot guarantee the success, the virality or the performance of the videos you publish. The Service aims for 24/7 availability, but cannot be held liable for technical interruptions or for outages at its third-party providers (hosting, Anthropic AI API). You are solely responsible for the content you publish on your social media, and undertake to comply with the community guidelines of the platforms concerned (TikTok, Instagram, YouTube, Facebook).</p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-white mb-3">9. AI-generated content — warning and limitation of liability</h2>
            <p className="mb-3">ViraReel AI uses an artificial intelligence model (Anthropic Claude) to generate text content suggestions. You acknowledge and accept the following:</p>
            <ul className="list-disc pl-5 space-y-2">
              <li>Generated content is provided as a <strong className="text-white">creative suggestion only</strong>. It does not constitute professional advice (legal, medical, financial or otherwise).</li>
              <li>ViraReel AI <strong className="text-white">does not guarantee</strong> the accuracy, the relevance, the virality or the error-free nature of generated content.</li>
              <li>You are <strong className="text-white">solely responsible</strong> for reviewing, validating and adapting the content before publishing it on your social media.</li>
              <li>You are <strong className="text-white">solely responsible</strong> for the consequences of publishing generated content, in particular regarding copyright, defamation, misleading advertising or breaches of local law.</li>
              <li>ViraReel AI cannot be held liable if the AI model accidentally generates inaccurate, incomplete or unsuitable content despite the safeguards in place.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-bold text-white mb-3">10. Governing law</h2>
            <p>These terms are governed by the laws of the province of Quebec and of Canada. Any dispute will be submitted to the competent courts of that jurisdiction.</p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-white mb-3">11. Changes to these terms</h2>
            <p>ViraReel AI reserves the right to change its prices or these terms at any time. Subscribed users will be informed by email of any price change at least 30 days before it takes effect.</p>
          </section>

        </div>

        <div className="mt-16 pt-8 border-t border-slate-800 text-slate-500 text-sm">
          <p>Questions: <a href="mailto:hello@virareelai.com" className="text-violet-400 hover:text-violet-300">hello@virareelai.com</a></p>
        </div>
      </div>
    </div>
  );
}
