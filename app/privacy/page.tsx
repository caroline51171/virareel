import type { Metadata } from 'next';
import Link from 'next/link';
import PrivacyEn from '@/components/PrivacyEn';

export const metadata: Metadata = {
  title: 'Politique de Confidentialité — ViraReel AI',
};

export default function Privacy() {
  // Une seule adresse pour les deux langues : le francais est livre par le serveur
  // (donc indexe), l'anglais le remplace dans le navigateur si l'interface est en
  // anglais. Voir components/PrivacyEn.tsx.
  return <PrivacyEn fr={contenuFr()} />;
}

function contenuFr() {
  return (
    <div className="min-h-screen bg-slate-950 text-slate-300 px-4 py-16">
      <div className="max-w-3xl mx-auto">
        <Link href="/" className="text-violet-400 hover:text-violet-300 text-sm mb-8 inline-block">
          ← Retour à ViraReel AI
        </Link>

        <h1 className="text-3xl font-black text-white mb-2">Politique de Confidentialité</h1>
        <p className="text-slate-500 text-sm mb-12">ViraReel AI — Dernière mise à jour : 21 septembre 2026</p>

        <div className="space-y-10">

          <section>
            <h2 className="text-xl font-bold text-white mb-3">1. Responsable de la protection des renseignements personnels</h2>
            <p>Le Service est exploité par une personne physique, sous le nom commercial ViraReel AI. La responsable de la protection des renseignements personnels est la fondatrice de ViraReel AI. Pour toute question ou demande liée à vos renseignements personnels : <a href="mailto:hello@virareelai.com" className="text-violet-400 hover:text-violet-300">hello@virareelai.com</a>.</p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-white mb-3">2. Informations que nous collectons</h2>
            <p className="mb-3">Nous collectons uniquement les informations nécessaires au bon fonctionnement du Service :</p>
            <ul className="list-disc pl-5 space-y-2">
              <li><strong className="text-white">Données de compte :</strong> Votre adresse courriel et votre nom lors de votre inscription.</li>
              <li><strong className="text-white">Données d&apos;utilisation :</strong> Les idées de contenu et les textes que vous saisissez dans l&apos;application pour générer vos scripts.</li>
              <li><strong className="text-white">Courriel des essais bonus :</strong> L&apos;adresse courriel que vous fournissez pour débloquer les essais gratuits supplémentaires.</li>
              <li><strong className="text-white">Formulaire de contact :</strong> Votre nom, votre courriel et le contenu de votre message.</li>
              <li><strong className="text-white">Données techniques :</strong> Le nombre d&apos;essais gratuits utilisés, associé à une empreinte chiffrée de votre adresse IP (jamais l&apos;adresse elle-même), pour empêcher les abus.</li>
              <li><strong className="text-white">Données de paiement :</strong> Nous ne stockons aucune carte bancaire. Vos informations de paiement sont collectées et traitées de manière sécurisée par notre prestataire Stripe.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-bold text-white mb-3">3. Comment nous utilisons vos données</h2>
            <p className="mb-3">Vos données sont utilisées exclusivement pour :</p>
            <ul className="list-disc pl-5 space-y-2">
              <li>Créer et gérer votre compte utilisateur.</li>
              <li>Générer les scripts pour vos plateformes (TikTok, Instagram, YouTube, Facebook).</li>
              <li>Gérer vos abonnements et vos essais gratuits, et répondre à vos messages.</li>
              <li>Améliorer les performances et la pertinence de notre outil d&apos;intelligence artificielle.</li>
              <li>Mesurer nos publicités, selon la section « Publicité et mesure » ci-dessous.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-bold text-white mb-3">4. Partage et transfert des données</h2>
            <p className="mb-3">Nous ne vendons ni ne louons vos données personnelles à des courtiers en données. Nous les partageons avec nos prestataires techniques pour le fonctionnement du Service, et, à des fins de publicité et de mesure, avec Meta, selon la section « Publicité et mesure » ci-dessous.</p>
            <ul className="list-disc pl-5 space-y-2">
              <li><strong className="text-white">Stripe :</strong> Pour le traitement sécurisé de vos paiements.</li>
              <li><strong className="text-white">Anthropic (Claude) :</strong> Vos idées textuelles leur sont transmises de manière anonymisée uniquement pour générer vos scripts. Vos données ne sont pas utilisées pour entraîner des modèles publics.</li>
              <li><strong className="text-white">Clerk :</strong> Pour la création de votre compte et la connexion sécurisée (courriel et mot de passe, ou connexion Google).</li>
              <li><strong className="text-white">Vercel :</strong> Pour l&apos;hébergement du site, les mesures techniques nécessaires à son fonctionnement et une mesure d&apos;audience anonyme, sans cookie (Vercel Analytics).</li>
              <li><strong className="text-white">Resend :</strong> Pour l&apos;envoi des messages du formulaire de contact et la conservation du courriel donné pour débloquer les essais gratuits.</li>
              <li><strong className="text-white">Upstash :</strong> Pour la conservation des messages du formulaire de contact et de statistiques anonymes sur l&apos;utilisation des essais.</li>
            </ul>
            <p className="mt-3"><strong className="text-white">Transferts hors du Québec et du Canada :</strong> ces prestataires, ainsi que Meta, sont situés aux États-Unis ou peuvent y traiter vos données. Vos renseignements personnels peuvent donc être communiqués à l&apos;extérieur du Québec et du Canada. Nous ne leur transmettons que ce qui est nécessaire au service rendu, et ces transferts sont encadrés par les conditions contractuelles de protection des données de chaque prestataire.</p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-white mb-3">5. Publicité et mesure (Meta)</h2>
            <p className="mb-3">Nous utilisons le pixel Meta et l&apos;API Conversions (identifiant 1785155322920407) pour mesurer les visites, inscriptions, clics sur les forfaits et achats, et pour diffuser ou recibler des publicités Facebook et Instagram. Lorsque vous nous l&apos;avez fourni, votre courriel est transmis à Meta uniquement sous forme d&apos;empreinte chiffrée, jamais en clair.</p>
            <p className="mb-3">Au Canada (dont le Québec, loi 25) et dans l&apos;Espace économique européen, au Royaume-Uni et en Suisse, ces outils ne se chargent qu&apos;après que vous avez cliqué « J&apos;accepte tout » dans la bannière. « Refuser » signifie qu&apos;aucune donnée n&apos;est envoyée à Meta.</p>
            <p className="mb-3">Hors de ces territoires, notamment aux États-Unis, la mesure démarre par défaut. Vous pouvez la refuser à tout moment avec le bouton « Refuser » de la bannière. Si votre navigateur envoie le signal Global Privacy Control (GPC, « Ne pas me pister »), nous le traitons comme un refus, y compris aux États-Unis.</p>
            <p>Meta agit comme partenaire publicitaire. En Californie et dans d&apos;autres États américains, l&apos;envoi de ces données à des fins publicitaires peut constituer un « partage ». Nous ne vendons pas vos données à des courtiers. Pour exercer un droit d&apos;accès, de suppression ou de « Do not sell/share », écrivez à hello@virareelai.com.</p>
            <p className="mt-3">Attribution publicitaire (interne) : lorsque vous arrivez via une publicité, nous pouvons enregistrer des paramètres techniques de la campagne (par exemple UTM, identifiant de clic Meta « fbclid », et la page d’atterrissage) et les associer à votre compte, uniquement pour analyser la performance de nos publicités dans notre espace d’administration. Ces données ne servent pas à vous reciblager ni à créer des audiences publicitaires. Au Canada, dans l’Espace économique européen, au Royaume-Uni et en Suisse, nous ne les enregistrons qu’après votre acceptation dans la bannière. Hors de ces territoires, notamment aux États-Unis, elles peuvent être enregistrées par défaut ; vous pouvez refuser à tout moment via « Refuser » ou « Gérer les cookies ». Elles sont conservées tant que votre compte est actif, puis supprimées ou anonymisées.</p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-white mb-3">6. Cookies et stockage sur votre appareil</h2>
            <p className="mb-3">Nous n&apos;utilisons aucun autre outil de mesure ni aucun autre cookie publicitaire que ceux décrits ci-dessous.</p>
            <ul className="list-disc pl-5 space-y-2">
              <li><strong className="text-white">Connexion (Clerk) — essentiels :</strong> maintiennent votre session lorsque vous êtes connecté. Durée : celle de votre session, fixée par Clerk.</li>
              <li><strong className="text-white">Choix de la bannière (virareel-consent) — essentiel :</strong> retient votre réponse (« J&apos;accepte tout » ou « Refuser »). Durée : 1 an.</li>
              <li><strong className="text-white">Compteur d&apos;essais (virareel_anon) — essentiel :</strong> compte vos essais gratuits, avec une empreinte chiffrée de votre adresse IP, pour empêcher les abus. Durée : 1 an.</li>
              <li><strong className="text-white">Stockage local du navigateur — essentiel :</strong> votre langue et votre marché cible, votre historique de scripts, votre brouillon en cours et votre choix de la bannière. Ces données restent sur votre appareil et ne nous sont pas transmises. Elles y restent jusqu&apos;à ce que vous les effaciez.</li>
              <li><strong className="text-white">Mesure publicitaire Meta (_fbp, _fbc) :</strong> déposés par le pixel Meta, selon les règles de la section 5 (seulement après « J&apos;accepte tout » au Canada, dans l&apos;EEE, au Royaume-Uni et en Suisse). Durée : 90 jours, fixée par Meta. Effacés si vous refusez.</li>
              <li><strong className="text-white">Provenance publicitaire (virareel-origine) :</strong> lorsque vous arrivez par une publicité, retient les paramètres de campagne décrits à la section 5 (UTM, fbclid, page d&apos;arrivée), selon les mêmes règles de consentement. Durée : 90 jours. Effacé si vous refusez.</li>
            </ul>
            <p className="mt-3">Vous pouvez changer d&apos;avis à tout moment avec le lien « Gérer les cookies » au bas de la page d&apos;accueil. Le paiement se fait sur une page hébergée par Stripe, qui applique ses propres cookies.</p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-white mb-3">7. Conservation des données</h2>
            <ul className="list-disc pl-5 space-y-2">
              <li><strong className="text-white">Compte :</strong> conservé tant que votre compte est actif.</li>
              <li><strong className="text-white">Historique des scripts :</strong> conservé uniquement sur votre appareil. Nos serveurs ne conservent ni vos idées ni les scripts générés ; Anthropic peut les conserver pour une durée limitée, selon sa propre politique.</li>
              <li><strong className="text-white">Courriel des essais bonus et messages de contact :</strong> conservés jusqu&apos;à ce que vous en demandiez la suppression.</li>
              <li><strong className="text-white">Compteur d&apos;essais :</strong> 1 an, la durée du cookie.</li>
              <li><strong className="text-white">Facturation :</strong> conservée par Stripe, selon ses obligations légales.</li>
              <li><strong className="text-white">Journaux techniques :</strong> conservés par Vercel pour une courte durée, selon ses propres règles.</li>
            </ul>
            <p className="mt-3">Vous pouvez demander la suppression définitive de votre compte et de vos données à tout moment en écrivant à hello@virareelai.com. Votre demande est traitée dans un délai de 30 jours.</p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-white mb-3">8. Sécurité</h2>
            <p>Nous mettons en œuvre des mesures de sécurité standard de l&apos;industrie (chiffrement SSL/TLS, accès restreints) pour protéger vos données contre tout accès non autorisé.</p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-white mb-3">9. Vos droits</h2>
            <p className="mb-3">Conformément à la Loi 25 (Québec) et aux lois sur la protection des données (RGPD, CCPA), vous avez le droit d&apos;accéder à vos renseignements personnels, de les faire rectifier, d&apos;en obtenir une copie et d&apos;en demander la suppression. Vous pouvez aussi retirer votre consentement à la mesure publicitaire à tout moment, avec le lien « Gérer les cookies ».</p>
            <p>Pour exercer ces droits, écrivez à hello@virareelai.com ; nous répondons dans un délai de 30 jours. Si notre réponse ne vous satisfait pas, vous pouvez porter plainte auprès de la Commission d&apos;accès à l&apos;information du Québec (cai.gouv.qc.ca) ou de l&apos;autorité de protection des données de votre pays (par exemple la CNIL en France).</p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-white mb-3">10. Contact</h2>
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
