'use client';

import { useState } from 'react';

export default function Contact({ lang }: { lang: string }) {
  const isFr = lang === 'fr';
  const [type, setType] = useState('comment');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState('');

  const types = [
    { value: 'comment', label: isFr ? '💬 Commentaire / Suggestion' : '💬 Comment / Suggestion' },
    { value: 'question', label: isFr ? '❓ Question générale' : '❓ General question' },
    { value: 'support', label: isFr ? '🛠️ Support technique' : '🛠️ Technical support' },
  ];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type, name, email, message, lang }),
      });
      if (!res.ok) throw new Error();
      setSent(true);
    } catch {
      setError(isFr ? 'Une erreur est survenue. Réessaie !' : 'An error occurred. Please try again!');
    } finally {
      setLoading(false);
    }
  };

  return (
    <section id="contact" className="py-24 px-4 bg-slate-900">
      <div className="max-w-xl mx-auto">
        <div className="text-center mb-10">
          <h2 className="text-3xl font-black text-white mb-3">
            {isFr ? '✉️ Nous contacter' : '✉️ Contact us'}
          </h2>
          <p className="text-slate-400">
            {isFr
              ? 'Une question, une suggestion ou besoin d\'aide ? Ton message est le bienvenu.'
              : 'A question, suggestion or need help? Your message is welcome.'}
          </p>
        </div>

        {sent ? (
          <div className="bg-green-500/15 border border-green-500/40 rounded-2xl p-8 text-center">
            <p className="text-green-400 text-xl font-bold mb-2">✅ {isFr ? 'Message envoyé !' : 'Message sent!'}</p>
            <p className="text-slate-400 text-sm">
              {isFr ? 'Ton message a bien été reçu. Merci !' : 'Your message has been received. Thank you!'}
            </p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="bg-slate-800 border border-slate-700 rounded-2xl p-6 md:p-8 space-y-5">

            {/* Type de message */}
            <div>
              <label className="block text-slate-300 text-sm font-semibold mb-2">
                {isFr ? 'Type de message' : 'Message type'}
              </label>
              <div className="flex flex-col gap-2">
                {types.map(t => (
                  <label key={t.value} className={`flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition ${type === t.value ? 'border-violet-500 bg-violet-500/10 text-white' : 'border-slate-600 text-slate-400 hover:border-slate-500'}`}>
                    <input
                      type="radio"
                      name="type"
                      value={t.value}
                      checked={type === t.value}
                      onChange={() => setType(t.value)}
                      className="accent-violet-500"
                    />
                    {t.label}
                  </label>
                ))}
              </div>
            </div>

            {/* Nom */}
            <div>
              <label className="block text-slate-300 text-sm font-semibold mb-2">
                {isFr ? 'Ton prénom' : 'Your name'}
              </label>
              <input
                type="text"
                value={name}
                onChange={e => setName(e.target.value)}
                required
                placeholder={isFr ? 'Marie' : 'John'}
                className="w-full bg-slate-700 border border-slate-600 rounded-xl px-4 py-3 text-white placeholder-slate-500 focus:outline-none focus:border-violet-500 transition"
              />
            </div>

            {/* Email */}
            <div>
              <label className="block text-slate-300 text-sm font-semibold mb-2">
                {isFr ? 'Ton courriel' : 'Your email'}
              </label>
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                required
                placeholder="marie@exemple.com"
                className="w-full bg-slate-700 border border-slate-600 rounded-xl px-4 py-3 text-white placeholder-slate-500 focus:outline-none focus:border-violet-500 transition"
              />
            </div>

            {/* Message */}
            <div>
              <label className="block text-slate-300 text-sm font-semibold mb-2">
                {isFr ? 'Ton message' : 'Your message'}
              </label>
              <textarea
                value={message}
                onChange={e => setMessage(e.target.value)}
                required
                rows={4}
                placeholder={isFr ? 'Écris ton message ici...' : 'Write your message here...'}
                className="w-full bg-slate-700 border border-slate-600 rounded-xl px-4 py-3 text-white placeholder-slate-500 focus:outline-none focus:border-violet-500 transition resize-none"
              />
            </div>

            {error && <p className="text-red-400 text-sm text-center">{error}</p>}

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-gradient-to-r from-violet-600 to-pink-600 hover:from-violet-700 hover:to-pink-700 text-white font-bold py-4 rounded-xl transition shadow-lg disabled:opacity-70 cursor-pointer"
            >
              {loading ? '⏳ ...' : (isFr ? '✉️ Envoyer mon message' : '✉️ Send my message')}
            </button>
          </form>
        )}
      </div>
    </section>
  );
}
