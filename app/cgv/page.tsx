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
        <p className="text-slate-500 text-sm mb-12">ViraReel AI — Dernière mise à jour : Juin 2026</p>

        <div className="space-y-10">

          <section>
            <h2 className="text-xl font-bold text-white mb-3">1. Objet du service</h2>
            <p>Le site ViraReel AI fournit un service d'aide à la création de contenu textuel pour les réseaux sociaux (Instagram, TikTok, YouTube, Facebook) basé sur l'intelligence artificielle. Le service est accessible gratuitement pour un essai limité, et sous forme d'abonnement mensuel payant pour un usage régulier.</p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-white mb-3">2. Fonctionnement des forfaits et abonnements</h2>
            <ul className="list-disc pl-5 space-y-2">
              <li><strong className="text-white">Essai gratuit :</strong> Tout visiteur bénéficie de 12 générations gratuites sans création de compte ni carte bancaire requise.</li>
              <li><strong className="text-white">Plan Creator :</strong> Octroie un maximum de 160 générations par mois de facturation.</li>
              <li><strong className="text-white">Plan Pro :</strong> Octroie un maximum de 600 générations par mois de facturation.</li>
            </ul>
            <p className="mt-3">Une "génération" est comptabilisée dès qu'un texte est créé pour une plateforme spécifique. Les générations non consommées au cours d'un mois de facturation sont définitivement perdues et ne sont pas reportées sur le mois suivant.</p>
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
            <h2 className="text-xl font-bold text-white mb-3">6. Responsabilité et utilisation du contenu</h2>
            <p>ViraReel AI met tout en œuvre pour fournir des scripts pertinents, mais ne peut garantir le succès, la viralité ou les performances des vidéos publiées par l'utilisateur. L'utilisateur est seul responsable du contenu qu'il publie sur ses réseaux sociaux et s'engage à respecter les règles communautaires des plateformes concernées (TikTok, Instagram, YouTube, Facebook).</p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-white mb-3">7. Modification des conditions</h2>
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
