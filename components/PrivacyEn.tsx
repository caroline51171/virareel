'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { langueChoisie } from '@/lib/langue';

// La politique de confidentialité vit à UNE SEULE adresse, /privacy : pas de
// /en/privacy orpheline. Le français est ce que contient la page livrée (donc ce
// que Google indexe) ; l'anglais le remplace dans le navigateur quand l'interface
// est en anglais, selon la même règle que le reste du site (lib/langue.ts).
//
// Traduction du texte français du 21 septembre 2026 — même fond juridique, aucune
// différence de sens entre les deux versions.
export default function PrivacyEn({ fr }: { fr: React.ReactNode }) {
  const [lang, setLang] = useState<'fr' | 'en'>('fr');
  useEffect(() => setLang(langueChoisie()), []);

  if (lang === 'fr') return <>{fr}</>;

  return (
    <div className="min-h-screen bg-slate-950 text-slate-300 px-4 py-16">
      <div className="max-w-3xl mx-auto">
        <Link href="/" className="text-violet-400 hover:text-violet-300 text-sm mb-8 inline-block">
          ← Back to ViraReel AI
        </Link>

        <h1 className="text-3xl font-black text-white mb-2">Privacy Policy</h1>
        <p className="text-slate-500 text-sm mb-12">ViraReel AI — Last updated: 21 September 2026</p>

        <div className="space-y-10">
          <section>
            <h2 className="text-xl font-bold text-white mb-3">1. Person in charge of personal information</h2>
            <p>The Service is operated by an individual under the business name ViraReel AI. The person in charge of the protection of personal information is the founder of ViraReel AI. For any question or request about your personal information: <a href="mailto:hello@virareelai.com" className="text-violet-400 hover:text-violet-300">hello@virareelai.com</a>.</p>
          </section>
          <section>
            <h2 className="text-xl font-bold text-white mb-3">2. Information we collect</h2>
            <p className="mb-3">We collect only what we need to run the Service:</p>
            <ul className="list-disc pl-5 space-y-2">
              <li><strong className="text-white">Account data:</strong> your email address and name when you sign up.</li>
              <li><strong className="text-white">Usage data:</strong> the content ideas and text you enter to generate scripts.</li>
              <li><strong className="text-white">Bonus-trial email:</strong> the email address you provide to unlock additional free trials.</li>
              <li><strong className="text-white">Contact form:</strong> your name, your email and the content of your message.</li>
              <li><strong className="text-white">Technical data:</strong> the number of free trials used, linked to a hashed fingerprint of your IP address (never the address itself), to prevent abuse.</li>
              <li><strong className="text-white">Payment data:</strong> we do not store card numbers. Payments are collected and processed securely by Stripe.</li>
            </ul>
          </section>
          <section>
            <h2 className="text-xl font-bold text-white mb-3">3. How we use your data</h2>
            <p className="mb-3">Your data is used only to:</p>
            <ul className="list-disc pl-5 space-y-2">
              <li>Create and manage your account.</li>
              <li>Generate scripts for your platforms (TikTok, Instagram, YouTube, Facebook).</li>
              <li>Manage your subscription and free trials, and reply to your messages.</li>
              <li>Improve the performance and relevance of our AI tool.</li>
              <li>Measure our ads, as described in &ldquo;Advertising and measurement&rdquo; below.</li>
            </ul>
          </section>
          <section>
            <h2 className="text-xl font-bold text-white mb-3">4. Sharing and transfer</h2>
            <p className="mb-3">We do not sell or rent your personal data to data brokers. We share it with technical providers that run the Service, and, for advertising and measurement, with Meta, as described in &ldquo;Advertising and measurement&rdquo; below.</p>
            <ul className="list-disc pl-5 space-y-2">
              <li><strong className="text-white">Stripe:</strong> secure payment processing.</li>
              <li><strong className="text-white">Anthropic (Claude):</strong> your text ideas are sent in anonymized form solely to generate your scripts. They are not used to train public models.</li>
              <li><strong className="text-white">Clerk:</strong> account creation and secure sign-in (email and password, or Google sign-in).</li>
              <li><strong className="text-white">Vercel:</strong> website hosting, the technical measurements required to run it, and anonymous, cookieless audience measurement (Vercel Analytics).</li>
              <li><strong className="text-white">Resend:</strong> sending contact form messages and storing the email address given to unlock free trials.</li>
              <li><strong className="text-white">Upstash:</strong> storing contact form messages and anonymous statistics on free-trial usage.</li>
            </ul>
            <p className="mt-3"><strong className="text-white">Transfers outside Quebec and Canada:</strong> these providers, as well as Meta, are located in the United States or may process your data there. Your personal information may therefore be disclosed outside Quebec and Canada. We share only what each service requires, and these transfers are governed by each provider&apos;s contractual data-protection terms.</p>
          </section>
          <section>
            <h2 className="text-xl font-bold text-white mb-3">5. Advertising and measurement (Meta)</h2>
            <p className="mb-3">We use the Meta Pixel and Conversions API (ID 1785155322920407) to measure visits, sign-ups, plan clicks, and purchases, and to serve or retarget Facebook and Instagram ads. When you have given us your email, it is sent to Meta only as a hashed fingerprint, never in plain text.</p>
            <p className="mb-3">In Canada (including Quebec, Law 25) and in the European Economic Area, the United Kingdom, and Switzerland, these tools load only after you click &ldquo;Accept all&rdquo; on the banner. &ldquo;Decline&rdquo; means no data is sent to Meta.</p>
            <p className="mb-3">Outside those regions, including the United States, measurement starts by default. You can turn it off at any time with the banner&apos;s &ldquo;Decline&rdquo; button. If your browser sends the Global Privacy Control (GPC / &ldquo;Do not track / Do not sell or share&rdquo;) signal, we treat it as a refusal, including in the United States.</p>
            <p>Meta is an advertising partner. In California and some other U.S. states, sending this data for ads may count as a &ldquo;sale&rdquo; or &ldquo;share.&rdquo; We do not sell your data to brokers. To request access, deletion, or &ldquo;Do not sell/share,&rdquo; email <a href="mailto:hello@virareelai.com" className="text-violet-400 hover:text-violet-300">hello@virareelai.com</a>.</p>
          </section>
          <section>
            <h2 className="text-xl font-bold text-white mb-3">6. Cookies and storage on your device</h2>
            <p className="mb-3">We use no measurement tools or advertising cookies other than those described below.</p>
            <ul className="list-disc pl-5 space-y-2">
              <li><strong className="text-white">Sign-in (Clerk) — essential:</strong> keep you signed in. Duration: your session, as set by Clerk.</li>
              <li><strong className="text-white">Banner choice (virareel-consent) — essential:</strong> remembers your answer (&ldquo;Accept all&rdquo; or &ldquo;Decline&rdquo;). Duration: 1 year.</li>
              <li><strong className="text-white">Trial counter (virareel_anon) — essential:</strong> counts your free trials, with a hashed fingerprint of your IP address, to prevent abuse. Duration: 1 year.</li>
              <li><strong className="text-white">Browser local storage — essential:</strong> your language and target market, your script history, your current draft and your banner choice. This data stays on your device and is not sent to us. It remains there until you clear it.</li>
              <li><strong className="text-white">Meta ad measurement (_fbp, _fbc):</strong> set by the Meta Pixel, under the rules in section 5 (only after &ldquo;Accept all&rdquo; in Canada, the EEA, the UK and Switzerland). Duration: 90 days, set by Meta. Deleted if you decline.</li>
            </ul>
            <p className="mt-3">You can change your mind at any time with the &ldquo;Manage cookies&rdquo; link at the bottom of the home page. Payment takes place on a page hosted by Stripe, which applies its own cookies.</p>
          </section>
          <section>
            <h2 className="text-xl font-bold text-white mb-3">7. Retention</h2>
            <ul className="list-disc pl-5 space-y-2">
              <li><strong className="text-white">Account:</strong> kept while your account is active.</li>
              <li><strong className="text-white">Script history:</strong> kept only on your device. Our servers keep neither your ideas nor the generated scripts; Anthropic may keep them for a limited time under its own policy.</li>
              <li><strong className="text-white">Bonus-trial email and contact messages:</strong> kept until you ask us to delete them.</li>
              <li><strong className="text-white">Trial counter:</strong> 1 year, the cookie&apos;s duration.</li>
              <li><strong className="text-white">Billing:</strong> kept by Stripe, under its legal obligations.</li>
              <li><strong className="text-white">Technical logs:</strong> kept by Vercel for a short period, under its own rules.</li>
            </ul>
            <p className="mt-3">You can ask us to permanently delete your account and data at any time by emailing hello@virareelai.com. Requests are handled within 30 days.</p>
          </section>
          <section>
            <h2 className="text-xl font-bold text-white mb-3">8. Security</h2>
            <p>We use industry-standard measures (SSL/TLS encryption, restricted access) to protect your data.</p>
          </section>
          <section>
            <h2 className="text-xl font-bold text-white mb-3">9. Your rights</h2>
            <p className="mb-3">Under Quebec&apos;s Law 25 and data-protection laws (GDPR, CCPA and similar), you have the right to access your personal information, have it corrected, obtain a copy, and ask for its deletion. You can also withdraw your consent to ad measurement at any time with the &ldquo;Manage cookies&rdquo; link.</p>
            <p>To exercise these rights, email hello@virareelai.com; we reply within 30 days. If you are not satisfied with our answer, you may file a complaint with the Commission d&apos;accès à l&apos;information du Québec (cai.gouv.qc.ca) or with the data-protection authority of your country (for example, the CNIL in France).</p>
          </section>
          <section>
            <h2 className="text-xl font-bold text-white mb-3">10. Contact</h2>
            <p>Questions about this policy or to exercise your rights: <a href="mailto:hello@virareelai.com" className="text-violet-400 hover:text-violet-300">hello@virareelai.com</a></p>
          </section>
        </div>

        <div className="mt-16 pt-8 border-t border-slate-800 text-slate-500 text-sm">
          <p>© 2026 ViraReel AI. All rights reserved.</p>
        </div>
      </div>
    </div>
  );
}
