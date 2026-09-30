'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useUser } from '@clerk/nextjs';
import { langueChoisie } from '@/lib/langue';
import { dateHeure } from '@/lib/renonciation';
import Icon from '@/components/Icon';

// Deuxième étape de la fonction de renonciation (directive 2023/2673, art. 11 bis) :
// la première est le lien « Renoncer au contrat ici » (pied de page, espace client),
// celle-ci est le formulaire + « Confirmer la renonciation ». Aucun motif demandé.
// Traitement : app/api/renonciation. Règles : lib/renonciation.ts.
export default function Renonciation() {
  const [lang, setLang] = useState<'fr' | 'en'>('fr');
  useEffect(() => setLang(langueChoisie()), []);
  const fr = lang === 'fr';
  useEffect(() => {
    document.title = fr ? 'Renoncer au contrat — ViraReel AI' : 'Withdraw from contract — ViraReel AI';
  }, [fr]);

  // Connecté : le nom et le courriel du compte sont pré-remplis (modifiables).
  // `null` = pas encore touché → on affiche la valeur du compte.
  const { user } = useUser();
  const [nomSaisi, setNom] = useState<string | null>(null);
  const [courrielSaisi, setCourriel] = useState<string | null>(null);
  const nom = nomSaisi ?? user?.fullName ?? '';
  const courriel = courrielSaisi ?? user?.primaryEmailAddress?.emailAddress ?? '';

  const [envoi, setEnvoi] = useState(false);
  const [erreur, setErreur] = useState(false);
  const [recueLe, setRecueLe] = useState<Date | null>(null);

  const confirmer = async (e: React.FormEvent) => {
    e.preventDefault();
    setEnvoi(true);
    setErreur(false);
    try {
      const res = await fetch('/api/renonciation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nom, courriel, lang }),
      });
      const d = await res.json();
      if (!res.ok || !d.ok) throw new Error();
      setRecueLe(new Date(d.recueLe));
    } catch {
      setErreur(true);
    }
    setEnvoi(false);
  };

  const champ = 'w-full bg-slate-700 border border-slate-600 rounded-xl px-4 py-3 text-white placeholder-slate-500 focus:outline-none focus:border-violet-500 transition';

  return (
    <div className="min-h-screen bg-slate-950 text-slate-300 px-4 py-16">
      <div className="max-w-xl mx-auto">
        <Link href="/" className="text-violet-400 hover:text-violet-300 text-sm mb-8 inline-block">
          {fr ? '← Retour à ViraReel AI' : '← Back to ViraReel AI'}
        </Link>

        <h1 className="text-3xl font-black text-white mb-4">
          {fr ? 'Renoncer au contrat' : 'Withdraw from contract'}
        </h1>

        {recueLe ? (
          <div className="bg-slate-800 border border-slate-700 rounded-2xl p-6 space-y-3">
            <p className="text-white font-bold flex items-center gap-2">
              <Icon name="check" size={20} className="text-emerald-400" />
              {fr ? 'Demande reçue' : 'Request received'}
            </p>
            <p>
              {fr ? 'Votre demande de renonciation a été reçue le ' : 'Your withdrawal request was received on '}
              <strong className="text-white">{dateHeure(recueLe, lang)}</strong>.
            </p>
            <p>
              {fr
                ? 'Un accusé de réception vous a été envoyé par courriel. Il indique la suite donnée à votre demande.'
                : 'An acknowledgement of receipt has been sent to you by email. It explains how your request has been handled.'}
            </p>
          </div>
        ) : (
          <>
            <div className="space-y-3 mb-8 text-sm leading-relaxed">
              <p>
                {fr
                  ? 'Si vous êtes un consommateur de l’Union européenne, de l’Espace économique européen ou du Royaume-Uni, vous pouvez renoncer à votre abonnement dans les 14 jours suivant votre premier paiement, sans donner de motif. Le remboursement est alors complet et l’abonnement prend fin immédiatement.'
                  : 'If you are a consumer in the European Union, the European Economic Area or the United Kingdom, you can withdraw from your subscription within 14 days of your first payment, without giving any reason. You are then refunded in full and the subscription ends immediately.'}
              </p>
              <p>
                {fr
                  ? 'Indiquez l’adresse courriel utilisée pour votre abonnement. Un accusé de réception vous sera envoyé.'
                  : 'Enter the email address used for your subscription. An acknowledgement of receipt will be sent to you.'}
              </p>
            </div>

            <form onSubmit={confirmer} className="bg-slate-800 border border-slate-700 rounded-2xl p-6 space-y-4">
              <div>
                <label htmlFor="renonciation-nom" className="block text-sm text-slate-400 mb-1.5">
                  {fr ? 'Nom' : 'Name'}
                </label>
                <input
                  id="renonciation-nom"
                  type="text"
                  required
                  autoComplete="name"
                  value={nom}
                  onChange={e => setNom(e.target.value)}
                  placeholder={fr ? 'Marie Dupont' : 'John Smith'}
                  className={champ}
                />
              </div>
              <div>
                <label htmlFor="renonciation-courriel" className="block text-sm text-slate-400 mb-1.5">
                  {fr ? 'Adresse courriel de l’abonnement' : 'Subscription email address'}
                </label>
                <input
                  id="renonciation-courriel"
                  type="email"
                  required
                  autoComplete="email"
                  value={courriel}
                  onChange={e => setCourriel(e.target.value)}
                  placeholder={fr ? 'marie@exemple.fr' : 'john@example.com'}
                  className={champ}
                />
              </div>

              {erreur && (
                <p className="text-red-400 text-sm">
                  {fr
                    ? 'La demande n’a pas pu être envoyée. Réessayez, ou écrivez-nous à hello@virareelai.com.'
                    : 'The request could not be sent. Please try again, or email us at hello@virareelai.com.'}
                </p>
              )}

              <button
                type="submit"
                disabled={envoi}
                className="w-full flex items-center justify-center gap-2 bg-gradient-to-r from-violet-600 to-pink-600 hover:from-violet-700 hover:to-pink-700 text-white font-bold py-4 rounded-xl transition shadow-lg disabled:opacity-70 cursor-pointer"
              >
                {envoi && <Icon name="loader" size={20} className="animate-spin" />}
                {fr ? 'Confirmer la renonciation' : 'Confirm withdrawal'}
              </button>
            </form>
          </>
        )}
      </div>
    </div>
  );
}
