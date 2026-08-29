'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { langueChoisie } from '@/lib/langue';

// La politique de confidentialité vit à UNE SEULE adresse, /privacy : pas de
// /en/privacy orpheline. Le français est ce que contient la page livrée (donc ce
// que Google indexe) ; l'anglais le remplace dans le navigateur quand l'interface
// est en anglais, selon la même règle que le reste du site (lib/langue.ts).
//
// Traduction du texte français du 29 août 2026 — même fond juridique, aucune
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
        <p className="text-slate-500 text-sm mb-12">ViraReel AI — Last updated: 29 August 2026</p>

        <div className="space-y-10">

          <section>
            <h2 className="text-xl font-bold text-white mb-3">1. Information we collect</h2>
            <p className="mb-3">We collect only what we need to run the Service:</p>
            <ul className="list-disc pl-5 space-y-2">
              <li><strong className="text-white">Account data:</strong> your email address and name when you sign up.</li>
              <li><strong className="text-white">Usage data:</strong> the content ideas and text you enter to generate scripts.</li>
              <li><strong className="text-white">Payment data:</strong> we do not store card numbers. Payments are collected and processed securely by Stripe.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-bold text-white mb-3">2. How we use your data</h2>
            <p className="mb-3">Your data is used only to:</p>
            <ul className="list-disc pl-5 space-y-2">
              <li>Create and manage your account.</li>
              <li>Generate scripts for your platforms (TikTok, Instagram, YouTube, Facebook).</li>
              <li>Manage subscriptions and access to your history (depending on your plan).</li>
              <li>Improve the performance and relevance of our AI tool.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-bold text-white mb-3">3. Sharing and transfer</h2>
            <p className="mb-3">We do not sell or rent your personal data to data brokers. We share it with technical providers that run the Service, and, for advertising and measurement, with Meta, as described in &ldquo;Advertising and measurement&rdquo; below.</p>
            <ul className="list-disc pl-5 space-y-2">
              <li><strong className="text-white">Stripe:</strong> secure payment processing.</li>
              <li><strong className="text-white">Anthropic (Claude):</strong> your text ideas are sent in anonymized form solely to generate your scripts. They are not used to train public models.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-bold text-white mb-3">4. Advertising and measurement (Meta)</h2>
            <p className="mb-3">We use the Meta Pixel and Conversions API (ID 1626458592332640) to measure visits, sign-ups, plan clicks, and purchases, and to serve or retarget Facebook and Instagram ads. When you have given us your email, it is sent to Meta only as a hashed fingerprint, never in plain text.</p>
            <p className="mb-3">In Canada (including Quebec, Law 25) and in the European Economic Area, the United Kingdom, and Switzerland, these tools load only after you click &ldquo;Accept all&rdquo; on the banner. &ldquo;Refuse&rdquo; means no data is sent to Meta.</p>
            <p className="mb-3">Outside those regions, including the United States, measurement starts by default. You can turn it off at any time with the banner&apos;s &ldquo;Refuse&rdquo; button. If your browser sends the Global Privacy Control (GPC / &ldquo;Do not track / Do not sell or share&rdquo;) signal, we treat it as a refusal, including in the United States.</p>
            <p>Meta is an advertising partner. In California and some other U.S. states, sending this data for ads may count as a &ldquo;sale&rdquo; or &ldquo;share.&rdquo; We do not sell your data to brokers. To request access, deletion, or &ldquo;Do not sell/share,&rdquo; email <a href="mailto:hello@virareelai.com" className="text-violet-400 hover:text-violet-300">hello@virareelai.com</a>.</p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-white mb-3">5. Retention</h2>
            <ul className="list-disc pl-5 space-y-2">
              <li><strong className="text-white">Account and history:</strong> kept while your account is active.</li>
              <li><strong className="text-white">Free trial:</strong> trial generation data is kept to prevent abuse.</li>
            </ul>
            <p className="mt-3">You can ask us to permanently delete your account and all of your data at any time.</p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-white mb-3">6. Security</h2>
            <p>We use industry-standard measures (SSL/TLS encryption, restricted access) to protect your data.</p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-white mb-3">7. Your rights</h2>
            <p>Under international data-protection laws (GDPR, CCPA and similar), you have the right to access, correct, port, and delete your personal data.</p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-white mb-3">8. Contact</h2>
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
