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
        <p className="text-slate-500 text-sm mb-12">ViraReel AI — Dernière mise à jour : 29 août 2026</p>

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
            <p className="mb-3">Nous ne vendons ni ne louons vos données personnelles à des courtiers en données. Nous les partageons avec nos prestataires techniques pour le fonctionnement du Service, et, à des fins de publicité et de mesure, avec Meta, selon la section « Publicité et mesure » ci-dessous.</p>
            <ul className="list-disc pl-5 space-y-2">
              <li><strong className="text-white">Stripe :</strong> Pour le traitement sécurisé de vos paiements.</li>
              <li><strong className="text-white">Anthropic (Claude) :</strong> Vos idées textuelles leur sont transmises de manière anonymisée uniquement pour générer vos scripts. Vos données ne sont pas utilisées pour entraîner des modèles publics.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-bold text-white mb-3">4. Publicité et mesure (Meta)</h2>
            <p className="mb-3">Nous utilisons le pixel Meta et l&apos;API Conversions (identifiant 1626458592332640) pour mesurer les visites, inscriptions, clics sur les forfaits et achats, et pour diffuser ou recibler des publicités Facebook et Instagram. Lorsque vous nous l&apos;avez fourni, votre courriel est transmis à Meta uniquement sous forme d&apos;empreinte chiffrée, jamais en clair.</p>
            <p className="mb-3">Au Canada (dont le Québec, loi 25) et dans l&apos;Espace économique européen, au Royaume-Uni et en Suisse, ces outils ne se chargent qu&apos;après que vous avez cliqué « J&apos;accepte tout » dans la bannière. « Refuser » signifie qu&apos;aucune donnée n&apos;est envoyée à Meta.</p>
            <p className="mb-3">Hors de ces territoires, notamment aux États-Unis, la mesure démarre par défaut. Vous pouvez la refuser à tout moment avec le bouton « Refuser » de la bannière. Si votre navigateur envoie le signal Global Privacy Control (GPC, « Ne pas me pister »), nous le traitons comme un refus, y compris aux États-Unis.</p>
            <p>Meta agit comme partenaire publicitaire. En Californie et dans d&apos;autres États américains, l&apos;envoi de ces données à des fins publicitaires peut constituer un « partage ». Nous ne vendons pas vos données à des courtiers. Pour exercer un droit d&apos;accès, de suppression ou de « Do not sell/share », écrivez à hello@virareelai.com.</p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-white mb-3">5. Conservation des données</h2>
            <ul className="list-disc pl-5 space-y-2">
              <li><strong className="text-white">Compte et Historique :</strong> Vos données et votre historique de génération sont conservés tant que votre compte est actif.</li>
              <li><strong className="text-white">Essai gratuit :</strong> Les données liées à vos générations gratuites sont conservées pour éviter les abus.</li>
            </ul>
            <p className="mt-3">Vous pouvez demander la suppression définitive de votre compte et de toutes vos données à tout moment en nous contactant.</p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-white mb-3">6. Sécurité</h2>
            <p>Nous mettons en œuvre des mesures de sécurité standard de l'industrie (chiffrement SSL/TLS, accès restreints) pour protéger vos données contre tout accès non autorisé.</p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-white mb-3">7. Vos droits</h2>
            <p>Conformément aux lois internationales sur la protection des données (RGPD, CCPA), vous disposez d'un droit d'accès, de rectification, de portabilité et de suppression de vos données personnelles.</p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-white mb-3">8. Contact</h2>
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
