import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'Conditions Générales de Vente — ViraReel AI',
};

export default function CGV() {
  return (
    <div className="min-h-screen bg-slate-950 text-slate-300 px-4 py-16">
      <div className="max-w-3xl mx-auto">
        <Link href="/" className="text-violet-400 hover:text-violet-300 text-sm mb-8 inline-block">
          ← Retour à ViraReel AI
        </Link>

        <h1 className="text-3xl font-black text-white mb-2">Conditions Générales de Vente (CGV)</h1>
        <p className="text-slate-500 text-sm mb-12">ViraReel AI — Dernière mise à jour : 21 juin 2026</p>

        <div className="space-y-10">

          <section>
            <h2 className="text-xl font-bold text-white mb-3">1. Objet du service</h2>
            <p>Le site ViraReel AI fournit un service d'aide à la création de contenu textuel pour les réseaux sociaux (Instagram, TikTok, YouTube, Facebook) basé sur l'intelligence artificielle. Le service est accessible gratuitement pour un essai limité, et sous forme d'abonnement mensuel payant pour un usage régulier.</p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-white mb-3">2. Fonctionnement des forfaits et abonnements</h2>
            <ul className="list-disc pl-5 space-y-2">
              <li><strong className="text-white">Essai gratuit :</strong> Tout visiteur bénéficie de 9 générations gratuites sans création de compte ni carte bancaire requise.</li>
              <li><strong className="text-white">Plan Creator :</strong> Octroie un maximum de 160 générations par mois de facturation.</li>
              <li><strong className="text-white">Plan Pro :</strong> Octroie un maximum de 600 générations par mois de facturation.</li>
            </ul>
            <p className="mt-3">Une "génération" est comptabilisée dès qu'un texte est créé pour une plateforme spécifique. Les générations non consommées au cours d'un mois de facturation sont définitivement perdues et ne sont pas reportées sur le mois suivant.</p>
            <p className="mt-3">Le tarif « membre fondateur » (prix bloqué à vie) s'applique exclusivement au forfait souscrit au moment de l'inscription à l'offre. En cas de changement pour un forfait différent, le prix normal du nouveau forfait s'applique — ce tarif n'est pas transférable.</p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-white mb-3">3. Conditions de paiement et renouvellement</h2>
            <p>L'abonnement est facturé sur une base mensuelle récurrente à la date anniversaire de l'inscription. Le paiement est géré de manière sécurisée par notre prestataire Stripe. L'abonnement se renouvelle automatiquement chaque mois, sauf annulation de la part de l'utilisateur avant la date de renouvellement.</p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-white mb-3">4. Politique d'annulation et de résiliation</h2>
            <p>L'utilisateur peut résilier son abonnement à tout moment et de manière totalement autonome en accédant au portail de gestion des abonnements Stripe depuis la section historique de son compte ViraReel AI. En cas de résiliation, l'accès au service et aux générations restantes reste actif jusqu'à la fin de la période mensuelle en cours. Aucun prélèvement ne sera effectué par la suite.</p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-white mb-3">5. Politique stricte de non-remboursement</h2>
            <p>Conformément à la législation sur les contenus numériques et les services de calcul instantané, aucun remboursement ne sera accordé une fois qu'une génération a été effectuée ou qu'un forfait mensuel a commencé. L'utilisateur bénéficie de 12 générations gratuites (sans compte requis) pour tester l'outil et valider sa qualité avant tout achat. Les erreurs de manipulation de l'utilisateur ou l'insatisfaction subjective face à un texte généré ne constituent pas des motifs de remboursement.</p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-white mb-3">6. Comptes et utilisation acceptable</h2>
            <p className="mb-3">L'utilisateur est responsable de la confidentialité de ses identifiants de connexion. ViraReel AI se réserve le droit de suspendre ou de supprimer tout compte en cas d'abus avéré, notamment la création de comptes multiples pour contourner la limite de l'essai gratuit, ou toute tentative de fraude au Service.</p>
            <p className="mb-3">Il est strictement interdit d'utiliser ViraReel AI pour générer du contenu :</p>
            <ul className="list-disc pl-5 space-y-2">
              <li>À caractère haineux, discriminatoire, raciste, sexiste ou harcelant envers toute personne ou groupe de personnes.</li>
              <li>Trompeur, frauduleux ou conçu pour escroquer des tiers (fausses promotions, arnaques, phishing).</li>
              <li>Constituant de la désinformation médicale, financière ou scientifique dangereuse.</li>
              <li>Faisant la promotion d'activités illégales, de substances illicites, ou d'organisations criminelles.</li>
              <li>Portant atteinte à la vie privée ou à la réputation d'une personne identifiable.</li>
              <li>Destiné à manipuler psychologiquement des personnes vulnérables.</li>
              <li>Violant les conditions d'utilisation des plateformes de réseaux sociaux ciblées (TikTok, Instagram, YouTube, Facebook).</li>
            </ul>
            <p className="mt-3">Tout manquement à ces règles entraînera la suspension immédiate et définitive du compte, sans remboursement. ViraReel AI se réserve le droit de signaler tout abus manifeste aux autorités compétentes.</p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-white mb-3">7. Propriété intellectuelle et contenu généré</h2>
            <p>L'utilisateur conserve l'entière propriété et la responsabilité des idées textuelles qu'il soumet au Service. Les scripts générés par ViraReel AI sont mis à la disposition exclusive de l'utilisateur pour ses propres réseaux sociaux. ViraReel AI ne revendique aucun droit de propriété sur les contenus produits.</p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-white mb-3">8. Responsabilité et disponibilité du service</h2>
            <p>ViraReel AI met tout en œuvre pour fournir des scripts pertinents, mais ne peut garantir le succès, la viralité ou les performances des vidéos publiées par l'utilisateur. Le Service s'efforce d'assurer une disponibilité 24h/24, mais ne peut être tenu responsable des interruptions techniques ou des pannes de ses fournisseurs tiers (hébergement, API d'intelligence artificielle Anthropic). L'utilisateur est seul responsable du contenu qu'il publie sur ses réseaux sociaux et s'engage à respecter les règles communautaires des plateformes concernées (TikTok, Instagram, YouTube, Facebook).</p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-white mb-3">9. Contenu généré par l'IA — Avertissement et limitation de responsabilité</h2>
            <p className="mb-3">ViraReel AI utilise un modèle d'intelligence artificielle (Anthropic Claude) pour générer des suggestions de contenu textuel. L'utilisateur reconnaît et accepte ce qui suit :</p>
            <ul className="list-disc pl-5 space-y-2">
              <li>Le contenu généré est fourni à titre de <strong className="text-white">suggestion créative uniquement</strong>. Il ne constitue pas un conseil professionnel (juridique, médical, financier ou autre).</li>
              <li>ViraReel AI <strong className="text-white">ne garantit pas</strong> l'exactitude, la pertinence, la viralité ou l'absence d'erreurs du contenu généré.</li>
              <li>L'utilisateur est <strong className="text-white">seul responsable</strong> de relire, valider et adapter le contenu avant de le publier sur ses réseaux sociaux.</li>
              <li>L'utilisateur est <strong className="text-white">seul responsable</strong> des conséquences découlant de la publication du contenu généré, notamment en matière de droits d'auteur, de diffamation, de publicité mensongère ou de violation des lois locales.</li>
              <li>ViraReel AI ne peut être tenu responsable si le modèle d'IA génère accidentellement un contenu imprécis, incomplet ou inadapté malgré les mesures de sécurité en place.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-bold text-white mb-3">10. Droit applicable</h2>
            <p>Les présentes conditions sont régies par les lois de la province de Québec et du Canada. Tout litige sera soumis aux tribunaux compétents de cette juridiction.</p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-white mb-3">11. Modification des conditions</h2>
            <p>ViraReel AI se réserve le droit de modifier ses tarifs ou les présentes conditions à tout moment. Les utilisateurs abonnés seront informés par courriel de toute modification tarifaire au moins 30 jours avant son application.</p>
          </section>

        </div>

        <div className="mt-16 pt-8 border-t border-slate-800 text-slate-500 text-sm">
          <p>Pour toute question : <a href="mailto:hello@virareelai.com" className="text-violet-400 hover:text-violet-300">hello@virareelai.com</a></p>
        </div>
      </div>
    </div>
  );
}
