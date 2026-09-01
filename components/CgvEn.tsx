'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { langueChoisie } from '@/lib/langue';

// Les conditions vivent à UNE SEULE adresse, /cgv : pas de /en/cgv orpheline.
// Le français est ce que contient la page livrée (donc ce que Google indexe) ;
// l'anglais le remplace dans le navigateur quand l'interface est en anglais,
// selon la même règle que le reste du site (lib/langue.ts).
//
// Traduction du texte français du 29 août 2026 — même fond juridique, aucune
// différence de sens entre les deux versions. Toute modification d'un des deux
// textes doit être reportée dans l'autre le jour même.
export default function CgvEn({ fr }: { fr: React.ReactNode }) {
  const [lang, setLang] = useState<'fr' | 'en'>('fr');
  useEffect(() => setLang(langueChoisie()), []);

  if (lang === 'fr') return <>{fr}</>;

  return (
    <div className="min-h-screen bg-slate-950 text-slate-300 px-4 py-16">
      <div className="max-w-3xl mx-auto">
        <Link href="/" className="text-violet-400 hover:text-violet-300 text-sm mb-8 inline-block">
          ← Back to ViraReel AI
        </Link>

        <h1 className="text-3xl font-black text-white mb-2">Terms of Service</h1>
        <p className="text-slate-500 text-sm mb-12">ViraReel AI — Last updated: 29 August 2026</p>

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
            <p className="mt-3">Every plan is available monthly or annually, chosen at sign-up. The annual subscription is billed the equivalent of ten months: two months are free. Payment is handled by Stripe in both cases.</p>
            <p className="mt-3">All prices are shown in <strong className="text-white">Canadian dollars (CAD)</strong> and are exclusive of any applicable taxes, unless stated otherwise. The amounts in force are those shown on the Pricing page and summarised on the Stripe payment page before you confirm. While a promotional offer is running (in particular the &laquo;&nbsp;founding member&nbsp;&raquo; price), the price charged is the one displayed at the time of subscription; once the offer ends, the public price applies to new subscriptions.</p>
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
            <p className="mt-3">The &laquo;&nbsp;founding member&nbsp;&raquo; price (locked for life) applies exclusively to the plan subscribed to at the time of joining the offer. If you switch to a different plan, the standard price of the new plan applies — this rate is not transferable.</p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-white mb-3">3. Payment and renewal</h2>
            <p>The subscription is billed on a recurring basis according to the periodicity chosen at sign-up — monthly or annual — on the anniversary date of that sign-up. Payment is handled securely by our provider Stripe. The subscription renews automatically at each period, unless cancelled by the user before the renewal date.</p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-white mb-3">4. Cancellation and termination</h2>
            <p>You may cancel your subscription at any time, entirely on your own, through the Stripe subscription management portal accessible from the history section of your ViraReel AI account. If you cancel, access to the Service stays active until the end of the period already paid for (month or year, depending on the periodicity chosen), and the monthly quota continues to apply until that date. No further payment will be taken afterwards. Refunds are covered in section 5.</p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-white mb-3">5. Refund policy</h2>
            <p className="mb-3">In accordance with the Consumer Protection Act, no refund is granted for subjective dissatisfaction with a generated text or for a user handling error: the 12 free generations with no account, plus the 6 additional generations obtained by providing an email address (18 in total), exist so you can test the tool and judge its quality before any purchase.</p>
            <p className="mb-3">A refund is nevertheless granted where the law requires it, or in the event of a technical error attributable to ViraReel AI (double billing, an outage preventing access to the Service, etc.). When a refund is granted, it is processed within 15 days. The amount may then take a further 5 to 10 business days to appear on the customer&apos;s bank or credit card statement, depending on the financial institution. A refund ends the subscription: access to the Service and the quota stop when the refund is granted, not at the end of the paid period.</p>
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
            <p className="mt-3">Any breach of these rules will result in immediate and permanent suspension of the account, without refund. ViraReel AI reserves the right to report any manifest abuse to the competent authorities.</p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-white mb-3">7. Intellectual property and generated content</h2>
            <p>You retain full ownership of, and responsibility for, the text ideas you submit to the Service. The scripts generated by ViraReel AI are made available exclusively to you, for your own social media. ViraReel AI claims no ownership over the content produced.</p>
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
