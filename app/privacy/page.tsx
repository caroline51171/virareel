import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'Politique de Confidentialité — ViraReel AI',
};

export default function Privacy() {
  return (
    <div className="min-h-screen bg-slate-950 text-slate-300 px-4 py-16">
      <div className="max-w-3xl mx-auto">
        <Link href="/" className="text-violet-400 hover:text-violet-300 text-sm mb-8 inline-block">
          ← Retour à ViraReel AI
        </Link>

        <h1 className="text-3xl font-black text-white mb-2">Politique de Confidentialité</h1>
        <p className="text-slate-500 text-sm mb-12">ViraReel AI — Dernière mise à jour : 17 juin 2026</p>

        <div className="space-y-10">

          <section>
            <h2 className="text-xl font-bold text-white mb-3">1. Informations que nous collectons</h2>
            <p className="mb-3">Nous collectons uniquement les informations nécessaires au bon fonctionnement du Service :</p>
            <ul className="list-disc pl-5 space-y-2">
              <li><strong className="text-white">Données de compte :</strong> Votre adresse e-mail et votre nom lors de votre inscription.</li>
              <li><strong className="text-white">Données d'utilisation :</strong> Les idées de contenu et les textes que vous saisissez dans l'application pour générer vos scripts.</li>
              <li><strong className="text-white">Données de paiement :</strong> Nous ne stockons aucune carte bancaire. Vos informations de paiement sont collectées et traitées de manière sécurisée par notre prestataire tiers Stripe.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-bold text-white mb-3">2. Comment nous utilisons vos données</h2>
            <p className="mb-3">Vos données sont utilisées exclusivement pour :</p>
            <ul className="list-disc pl-5 space-y-2">
              <li>Créer et gérer votre compte utilisateur.</li>
              <li>Générer les scripts pour vos plateformes (TikTok, Instagram, YouTube, Facebook).</li>
              <li>Gérer vos abonnements et l'accès à votre historique (selon votre forfait).</li>
              <li>Améliorer les performances et la pertinence de notre outil d'intelligence artificielle.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-bold text-white mb-3">3. Partage et transfert des données</h2>
            <p className="mb-3">Nous ne vendons, ne louons et ne partageons jamais vos données personnelles à des fins commerciales. Vos données sont partagées uniquement avec nos sous-traitants de confiance pour le fonctionnement technique du Service :</p>
            <ul className="list-disc pl-5 space-y-2">
              <li><strong className="text-white">Stripe :</strong> Pour le traitement sécurisé de vos paiements.</li>
              <li><strong className="text-white">Anthropic (Claude) :</strong> Vos idées textuelles leur sont transmises de manière anonymisée uniquement pour générer vos scripts. Vos données ne sont pas utilisées pour entraîner des modèles publics.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-bold text-white mb-3">4. Conservation des données</h2>
            <ul className="list-disc pl-5 space-y-2">
              <li><strong className="text-white">Compte et Historique :</strong> Vos données et votre historique de génération sont conservés tant que votre compte est actif.</li>
              <li><strong className="text-white">Essai gratuit :</strong> Les données liées à vos générations gratuites sont conservées pour éviter les abus.</li>
            </ul>
            <p className="mt-3">Vous pouvez demander la suppression définitive de votre compte et de toutes vos données à tout moment en nous contactant.</p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-white mb-3">5. Sécurité</h2>
            <p>Nous mettons en œuvre des mesures de sécurité standard de l'industrie (chiffrement SSL/TLS, accès restreints) pour protéger vos données contre tout accès non autorisé.</p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-white mb-3">6. Vos droits</h2>
            <p>Conformément aux lois internationales sur la protection des données (RGPD, CCPA), vous disposez d'un droit d'accès, de rectification, de portabilité et de suppression de vos données personnelles.</p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-white mb-3">7. Contact</h2>
            <p>Pour toute question concernant cette politique ou pour exercer vos droits, vous pouvez nous contacter à : <a href="mailto:hello@virareelai.com" className="text-violet-400 hover:text-violet-300">hello@virareelai.com</a></p>
          </section>

        </div>

        <div className="mt-16 pt-8 border-t border-slate-800 text-slate-500 text-sm">
          <p>© 2026 ViraReel AI. Tous droits réservés.</p>
        </div>
      </div>
    </div>
  );
}
