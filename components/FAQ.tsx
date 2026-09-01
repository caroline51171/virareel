'use client';

import { useState } from 'react';
import Icon from './Icon';

const faqFr = [
  {
    q: 'Comment fonctionne le système de générations ?',
    a: 'Chaque fois que vous créez un texte pour une plateforme spécifique (TikTok, Instagram, YouTube ou Facebook), cela compte pour 1 génération. Si vous optez pour les 3 variations d\'une même plateforme, votre compteur sera déduit de 3 générations d\'un coup. Si vous choisissez les 4 plateformes simultanément, ce sont 4 générations déduites d\'un coup. Le mode « 4 idées » suit la même règle : chaque idée coûte 1 génération par plateforme, donc 4 idées sur 1 plateforme = 4 générations, et 4 idées sur les 4 plateformes = 16 générations en une fois. En résumé : 1 plateforme = 1 génération · 3 variations = 3 générations · 4 plateformes = 4 générations · 4 idées = 4 à 16 générations selon le nombre de plateformes.',
  },
  {
    q: 'Mes générations non utilisées sont-elles reportées le mois suivant ?',
    a: 'Non. Vos générations se réinitialisent automatiquement chaque mois à la date anniversaire de votre abonnement (le compteur remonte à 60 pour le forfait Solo, 160 pour le forfait Creator ou 1000 pour le forfait Agency). Les générations restantes du mois précédent sont perdues. Notre outil est conçu pour vous encourager à publier régulièrement !',
  },
  {
    q: 'Comment puis-je gérer, modifier ou annuler mon abonnement ?',
    a: 'C\'est ultra-simple et 100 % autonome. Connectez-vous à votre compte ViraReel AI, faites défiler vers la section de votre historique et cliquez sur le bouton "Gérer mon abonnement". Vous serez redirigé vers notre portail sécurisé Stripe où vous pourrez mettre à jour votre carte bancaire, télécharger vos factures PDF ou annuler votre forfait en un seul clic. En cas d\'annulation, vous gardez l\'accès à vos générations jusqu\'à la fin de la période payée.',
  },
  {
    q: 'Que faire si le texte généré ne me plaît pas ? Est-ce remboursé ?',
    a: 'Les générations consommées ne sont pas remboursables, car elles utilisent des ressources de calcul instantanées. Pour obtenir le meilleur script possible dès le premier coup, évitez les descriptions trop courtes (comme un seul mot). Donnez au moins 15 à 20 caractères de contexte à l\'IA (ex: "3 astuces pour perdre du poids sans faire de régime" au lieu de juste "maigrir"). Plus votre idée est claire, plus le script sera percutant !',
  },
  {
    q: 'Si j\'upgrade mon forfait, est-ce que je garde mon prix fondateur ?',
    a: 'Non. Le prix fondateur « à vie » s\'applique uniquement au forfait souscrit au moment de l\'inscription à l\'offre. En cas de changement pour un forfait différent, le prix normal de ce nouveau forfait s\'applique — le tarif fondateur n\'est pas transférable.',
  },
];

const faqEn = [
  {
    q: 'How does the generation system work?',
    a: 'Each time you create content for a specific platform (TikTok, Instagram, YouTube or Facebook), it counts as 1 generation. If you choose 3 variations for the same platform, 3 generations are deducted at once. If you generate for all 4 platforms simultaneously, 4 generations are deducted at once. The “4 ideas” mode follows the same rule: each idea costs 1 generation per platform, so 4 ideas on 1 platform = 4 generations, and 4 ideas across all 4 platforms = 16 generations at once. In short: 1 platform = 1 generation · 3 variations = 3 generations · 4 platforms = 4 generations · 4 ideas = 4 to 16 generations depending on how many platforms you pick.',
  },
  {
    q: 'Do unused generations roll over to the next month?',
    a: 'No. Your generations reset automatically each month on your subscription anniversary date (back to 60 for the Solo plan, 160 for the Creator plan or 1000 for the Agency plan). Unused generations from the previous month are lost. Our tool is designed to encourage you to post regularly!',
  },
  {
    q: 'How can I manage, update or cancel my subscription?',
    a: 'It\'s ultra-simple and 100% self-serve. Log in to your ViraReel AI account, scroll down to your history section and click the "Manage my subscription" button. You\'ll be redirected to our secure Stripe portal where you can update your payment method, download PDF invoices or cancel your plan in one click. If you cancel, you keep access to your generations until the end of the paid period.',
  },
  {
    q: 'What if I don\'t like the generated text? Is it refunded?',
    a: 'Used generations are non-refundable, as they use instant computing resources. To get the best script on the first try, avoid descriptions that are too short (like a single word). Give the AI at least 15 to 20 characters of context (e.g. "3 tips to lose weight without dieting" instead of just "weight loss"). The clearer your idea, the more powerful the script!',
  },
  {
    q: 'If I upgrade my plan, do I keep my founder pricing?',
    a: 'No. The "for life" founder price applies only to the plan you subscribed to when you joined the offer. If you switch to a different plan, the regular price of that new plan applies — founder pricing is not transferable.',
  },
];

export default function FAQ({ lang }: { lang: string }) {
  const isFr = lang === 'fr';
  const faqs = isFr ? faqFr : faqEn;
  const [open, setOpen] = useState<number | null>(null);

  return (
    <section id="faq" className="py-24 px-4 bg-slate-950">
      <div className="max-w-2xl mx-auto">
        <div className="text-center mb-12">
          <h2 className="text-3xl font-black text-white mb-3 flex items-center justify-center gap-2">
            <Icon name="help-circle" size={24} />
            {isFr ? 'Centre d\'Aide & FAQ' : 'Help Center & FAQ'}
          </h2>
          <p className="text-slate-400">
            {isFr ? 'Tout ce qu\'il faut savoir sur ViraReel AI' : 'Everything you need to know about ViraReel AI'}
          </p>
        </div>

        <div className="space-y-3">
          {faqs.map((item, i) => (
            <div key={i} className="bg-slate-800 border border-slate-700 rounded-2xl overflow-hidden">
              <button
                onClick={() => setOpen(open === i ? null : i)}
                className="w-full flex items-center justify-between p-5 text-left transition hover:bg-slate-700/50"
              >
                <span className="text-white font-semibold text-sm md:text-base pr-4">{item.q}</span>
                <span className="text-violet-400 flex-shrink-0">
                  <Icon name={open === i ? 'minus' : 'plus'} size={20} />
                </span>
              </button>
              {open === i && (
                <div className="px-5 pb-5">
                  <p className="text-slate-300 text-sm leading-relaxed">{item.a}</p>
                </div>
              )}
            </div>
          ))}
        </div>

        <div className="mt-10 text-center bg-slate-800 border border-slate-700 rounded-2xl p-6">
          <p className="text-white font-semibold mb-3 flex items-center justify-center gap-2">
            <Icon name="message-circle" size={20} />
            {isFr ? 'Une autre question ?' : 'Another question?'}
          </p>
          <a
            href="#contact"
            className="inline-flex items-center gap-2 bg-gradient-to-r from-violet-600 to-pink-600 hover:from-violet-700 hover:to-pink-700 text-white font-bold px-6 py-3 rounded-xl transition text-sm"
          >
            <Icon name="mail" size={16} />
            {isFr ? 'Écrire un message' : 'Send a message'}
          </a>
        </div>
      </div>
    </section>
  );
}
