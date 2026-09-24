'use client';

import { useEffect, useMemo, useState } from 'react';
import Icon from '@/components/Icon';
import {
  CLES_UTM, COLONNES_CONVERSIONS, cacCents, csvConversions, csvTableau, dollars, filtrer, lignes,
  periodeRaccourci, taux, totaux, valeursConversion, valeursUtm,
  type Agregation, type CleUtm, type Evenement, type FiltreUtm, type Ligne, type Periode, type Raccourci,
} from '@/lib/performance';

// Onglet Performance d'/admin : la vérité du site et de Stripe, en complément de Meta
// Ads Manager (qui donne impressions, clics, coût). Tous les calculs sont dans
// lib/performance.ts ; ici, seulement l'affichage. Heure de Toronto partout.

type Choix = Raccourci | 'perso';

const RACCOURCIS: { cle: Choix; label: string }[] = [
  { cle: 'aujourdhui', label: "Aujourd'hui" },
  { cle: 'hier', label: 'Hier' },
  { cle: '7jours', label: '7 derniers jours' },
  { cle: 'perso', label: 'Personnalisé' },
];

const NOMS_UTM: Record<CleUtm, string> = {
  utm_source: 'Source',
  utm_medium: 'Support',
  utm_campaign: 'Campagne',
  utm_content: 'Contenu',
};

const NOMS_EVENEMENTS: Record<string, string> = {
  signup: 'Inscription',
  first_trial: '1er essai',
  lead_email: 'Courriel donné',
  initiate_checkout: 'Clic forfait',
  purchase: 'Paiement',
  refund: 'Remboursement',
};

const argent = (cents: number | null) => (cents === null ? '—' : `${dollars(cents)} $`);
const pct = (v: number | null) => (v === null ? '—' : `${(v * 100).toFixed(1).replace('.', ',')} %`);

function telecharger(nom: string, contenu: string) {
  const url = URL.createObjectURL(new Blob([contenu], { type: 'text/csv;charset=utf-8' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = nom;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function Tuile({ label, valeur, detail }: { label: string; valeur: string; detail?: string }) {
  return (
    <div className="bg-slate-900 border border-white/10 rounded-2xl p-4">
      <div className="text-slate-400 text-xs mb-1">{label}</div>
      <div className="text-xl font-bold text-white">{valeur}</div>
      {detail && <div className="text-slate-500 text-xs mt-1">{detail}</div>}
    </div>
  );
}

// Case de dépense Meta d'un jour : enregistrée quand on quitte la case (ou Entrée).
function CaseDepense({ jour, valeur, onEnregistre }: {
  jour: string;
  valeur: number | undefined;
  onEnregistre: (jour: string, montant: number | null) => Promise<boolean>;
}) {
  const [texte, setTexte] = useState(valeur === undefined ? '' : String(valeur).replace('.', ','));
  const [etat, setEtat] = useState<'' | 'ok' | 'erreur'>('');

  const enregistrer = async () => {
    const brut = texte.trim().replace(',', '.').replace(/\s|\$/g, '');
    const montant = brut === '' ? null : Number(brut);
    if (montant !== null && (!Number.isFinite(montant) || montant < 0)) { setEtat('erreur'); return; }
    if (montant === (valeur ?? null)) return;
    setEtat((await onEnregistre(jour, montant)) ? 'ok' : 'erreur');
  };

  return (
    <input
      inputMode="decimal"
      value={texte}
      onChange={e => { setTexte(e.target.value); setEtat(''); }}
      onBlur={enregistrer}
      onKeyDown={e => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); }}
      placeholder="—"
      aria-label={`Dépense Meta du ${jour}`}
      className={`w-20 bg-slate-800 rounded px-2 py-1 text-right text-white border ${
        etat === 'erreur' ? 'border-red-500' : etat === 'ok' ? 'border-emerald-500/60' : 'border-white/10'
      }`}
    />
  );
}

const ENTETES: { cle: string; label: string }[] = [
  { cle: 'date', label: 'Date' },
  { cle: 'nouveaux_comptes', label: 'Comptes' },
  { cle: 'essais_demarres', label: 'Essais' },
  { cle: 'leads_email', label: 'Courriels' },
  { cle: 'checkouts_inities', label: 'Clics forfait' },
  { cle: 'paiements_reussis', label: 'Paiements' },
  { cle: 'revenu_brut_cad', label: 'Brut' },
  { cle: 'remboursements_nb', label: 'Remb.' },
  { cle: 'remboursements_cad', label: 'Remb. $' },
  { cle: 'revenu_net_cad', label: 'Net' },
  { cle: 'payeurs_uniques', label: 'Payeurs' },
  { cle: 'depense_meta_cad', label: 'Dépense Meta' },
  { cle: 'essai_lead', label: 'Essai→courriel' },
  { cle: 'lead_checkout', label: 'Courriel→clic' },
  { cle: 'checkout_paye', label: 'Clic→payé' },
  { cle: 'compte_paye', label: 'Compte→payé' },
];

export default function AdminPerformance() {
  const [evenements, setEvenements] = useState<Evenement[] | null>(null);
  const [depenses, setDepenses] = useState<Record<string, number>>({});
  const [erreur, setErreur] = useState(false);
  const [choix, setChoix] = useState<Choix>('7jours');
  const [perso, setPerso] = useState<Periode>(() => periodeRaccourci('7jours'));
  const [agregation, setAgregation] = useState<Agregation>('jour');
  const [filtre, setFiltre] = useState<FiltreUtm>({});
  const [conversionsOuvertes, setConversionsOuvertes] = useState(false);

  useEffect(() => {
    fetch('/api/admin/performance')
      .then(r => (r.ok ? r.json() : Promise.reject()))
      .then((d: { evenements: Evenement[]; depenses: Record<string, number> }) => {
        setEvenements(d.evenements ?? []);
        setDepenses(d.depenses ?? {});
      })
      .catch(() => setErreur(true));
  }, []);

  const periode: Periode = choix === 'perso' ? perso : periodeRaccourci(choix);

  const vue = useMemo(() => {
    if (!evenements) return null;
    return {
      carte: totaux(evenements, periode, filtre, depenses),
      rangees: lignes(evenements, periode, filtre, agregation, depenses),
      conversions: filtrer(evenements, periode, filtre),
    };
  }, [evenements, periode.debut, periode.fin, filtre, agregation, depenses]); // eslint-disable-line react-hooks/exhaustive-deps

  const options = useMemo(
    () => Object.fromEntries(CLES_UTM.map(c => [c, evenements ? valeursUtm(evenements, c) : []])) as Record<CleUtm, string[]>,
    [evenements],
  );

  const enregistrerDepense = async (jour: string, montant: number | null) => {
    try {
      const r = await fetch('/api/admin/performance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jour, montant }),
      });
      if (!r.ok) return false;
      setDepenses(d => {
        const copie = { ...d };
        if (montant === null) delete copie[jour];
        else copie[jour] = montant;
        return copie;
      });
      return true;
    } catch {
      return false;
    }
  };

  const filtreActif = CLES_UTM.some(c => filtre[c]);
  const suffixe = `${periode.debut}_${periode.fin}${filtreActif ? '_filtre' : ''}`;

  const cellule = (l: Ligne, cle: string) => {
    const t = taux(l);
    switch (cle) {
      case 'date': return l.date;
      case 'revenu_brut_cad': return argent(l.revenu_brut_cents);
      case 'remboursements_cad': return argent(l.remboursements_cents);
      case 'revenu_net_cad': return argent(l.revenu_net_cents);
      case 'depense_meta_cad':
        return agregation === 'jour'
          ? <CaseDepense key={`${l.date}-${depenses[l.date]}`} jour={l.date} valeur={depenses[l.date]} onEnregistre={enregistrerDepense} />
          : argent(l.depense_meta_cents);
      case 'essai_lead': return pct(t.essai_lead);
      case 'lead_checkout': return pct(t.lead_checkout);
      case 'checkout_paye': return pct(t.checkout_paye);
      case 'compte_paye': return pct(t.compte_paye);
      default: return String(l[cle as keyof Ligne] ?? '');
    }
  };

  return (
    <section className="mb-12">
      <div className="flex flex-wrap items-baseline justify-between gap-2 mb-4">
        <h2 className="text-xl md:text-2xl font-black text-white">Performance</h2>
        <span className="text-slate-500 text-xs">Heure de Toronto · paiements lus dans Stripe</span>
      </div>

      {/* ── Période, agrégation, filtre UTM ── */}
      <div className="bg-slate-900 border border-white/10 rounded-2xl p-4 mb-4 space-y-3">
        <div className="flex flex-wrap gap-2">
          {RACCOURCIS.map(r => (
            <button
              key={r.cle}
              onClick={() => setChoix(r.cle)}
              className={`px-3 py-1.5 rounded-full text-xs font-semibold transition ${
                choix === r.cle ? 'bg-violet-600 text-white' : 'bg-slate-800 text-slate-400 hover:text-white'
              }`}
            >
              {r.label}
            </button>
          ))}
          <div className="flex gap-1 bg-slate-800 rounded-full p-1 ml-auto">
            {(['jour', 'semaine'] as const).map(a => (
              <button
                key={a}
                onClick={() => setAgregation(a)}
                className={`px-3 py-0.5 rounded-full text-xs font-semibold capitalize transition ${
                  agregation === a ? 'bg-violet-600 text-white' : 'text-slate-400 hover:text-white'
                }`}
              >
                {a}
              </button>
            ))}
          </div>
        </div>

        {choix === 'perso' && (
          <div className="flex flex-wrap items-center gap-2 text-sm text-slate-400">
            Du
            <input type="date" value={perso.debut} max={perso.fin}
              onChange={e => e.target.value && setPerso(p => ({ ...p, debut: e.target.value }))}
              className="bg-slate-800 border border-white/10 rounded px-2 py-1 text-white [color-scheme:dark]" />
            au
            <input type="date" value={perso.fin} min={perso.debut}
              onChange={e => e.target.value && setPerso(p => ({ ...p, fin: e.target.value }))}
              className="bg-slate-800 border border-white/10 rounded px-2 py-1 text-white [color-scheme:dark]" />
          </div>
        )}

        <div className="grid grid-cols-2 md:grid-cols-4 gap-2 items-end">
          {CLES_UTM.map(c => (
            <label key={c} className="text-xs text-slate-400">
              {NOMS_UTM[c]} <span className="text-slate-600">({c})</span>
              <select
                value={filtre[c] ?? ''}
                onChange={e => setFiltre(f => ({ ...f, [c]: e.target.value || undefined }))}
                className="mt-1 w-full bg-slate-800 border border-white/10 rounded px-2 py-1.5 text-white text-sm"
              >
                <option value="">Tous</option>
                {options[c].map(v => <option key={v} value={v}>{v}</option>)}
              </select>
            </label>
          ))}
        </div>
      </div>

      {erreur && <p className="text-red-400">Erreur de chargement des performances.</p>}
      {!vue && !erreur && <p className="text-slate-400">Chargement…</p>}

      {vue && (
        <>
          {/* ── Cartes ── */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-3">
            <Tuile label="Nouveaux comptes" valeur={String(vue.carte.nouveaux_comptes)} />
            <Tuile label="Essais démarrés" valeur={String(vue.carte.essais_demarres)} />
            <Tuile label="Courriels captés" valeur={String(vue.carte.leads_email)} />
            <Tuile label="Clics forfait" valeur={String(vue.carte.checkouts_inities)} detail="page Stripe ouverte" />
            <Tuile label="Paiements réussis" valeur={String(vue.carte.paiements_reussis)}
              detail={`${vue.carte.payeurs_uniques} payeur${vue.carte.payeurs_uniques > 1 ? 's' : ''} unique${vue.carte.payeurs_uniques > 1 ? 's' : ''}`} />
            <Tuile label="Revenu brut" valeur={argent(vue.carte.revenu_brut_cents)} detail="CAD" />
            <Tuile label="Remboursements" valeur={String(vue.carte.remboursements_nb)} detail={argent(vue.carte.remboursements_cents)} />
            <Tuile label="Revenu net" valeur={argent(vue.carte.revenu_net_cents)} detail="brut − remboursements" />
            {/* CAC : seulement si une dépense est saisie. Avec un filtre UTM, la dépense
                reste celle de TOUT Meta : le diviser par les payeurs d'une seule campagne mentirait. */}
            {cacCents(vue.carte) !== null && (
              filtreActif
                ? <Tuile label="CAC réel" valeur="—" detail="retirer le filtre UTM" />
                : <Tuile label="CAC réel" valeur={argent(cacCents(vue.carte))}
                    detail={`${argent(vue.carte.depense_meta_cents)} ÷ ${vue.carte.payeurs_uniques} payeur${vue.carte.payeurs_uniques > 1 ? 's' : ''}`} />
            )}
          </div>

          <div className="flex flex-wrap gap-x-5 gap-y-1 text-xs text-slate-400 mb-5">
            {(() => {
              const t = taux(vue.carte);
              return (
                <>
                  <span>Essai → courriel <b className="text-white">{pct(t.essai_lead)}</b></span>
                  <span>Courriel → clic forfait <b className="text-white">{pct(t.lead_checkout)}</b></span>
                  <span>Clic → payé <b className="text-white">{pct(t.checkout_paye)}</b></span>
                  <span>Compte → payé <b className="text-white">{pct(t.compte_paye)}</b></span>
                </>
              );
            })()}
          </div>

          {vue.conversions.length === 0 && (
            <p className="text-slate-400 text-sm mb-4">Aucune donnée pour cette période.</p>
          )}

          {/* ── Tableau ── */}
          <div className="bg-slate-900 border border-white/10 rounded-2xl overflow-x-auto mb-3">
            <table className="w-full text-sm whitespace-nowrap">
              <thead className="bg-white/5 text-slate-400">
                <tr>
                  {ENTETES.map(h => <th key={h.cle} className="text-left font-semibold px-3 py-2">{h.label}</th>)}
                </tr>
              </thead>
              <tbody>
                {vue.rangees.map(l => (
                  <tr key={l.date} className="border-t border-white/5">
                    {ENTETES.map(h => (
                      <td key={h.cle} className={`px-3 py-2 ${h.cle === 'date' ? 'text-white' : 'text-slate-300'}`}>
                        {cellule(l, h.cle)}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <p className="text-slate-500 text-xs mb-4">
            {agregation === 'jour'
              ? 'Dépense Meta : tapez le montant du jour, il est enregistré en quittant la case.'
              : 'Dépense Meta : saisie jour par jour (bascule « Jour »), additionnée ici.'}{' '}
            Les taux « → payé » comptent les 1ers paiements, pas les renouvellements.
          </p>

          <div className="flex flex-wrap gap-2 mb-4">
            <button
              onClick={() => telecharger(`performance_${agregation}_${suffixe}.csv`, csvTableau(vue.rangees))}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-slate-800 text-sm text-white hover:bg-slate-700"
            >
              <Icon name="download" size={16} /> Exporter le tableau (CSV)
            </button>
            <button
              onClick={() => telecharger(`conversions_${suffixe}.csv`, csvConversions(vue.conversions))}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-slate-800 text-sm text-white hover:bg-slate-700"
            >
              <Icon name="download" size={16} /> Exporter les conversions (CSV)
            </button>
            <button
              onClick={() => setConversionsOuvertes(o => !o)}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-full text-sm text-violet-300 hover:text-violet-200"
            >
              <Icon name={conversionsOuvertes ? 'chevron-up' : 'chevron-down'} size={16} />
              {conversionsOuvertes ? 'Masquer' : 'Voir'} les conversions ({vue.conversions.length})
            </button>
          </div>

          {/* ── Conversions une par une ── */}
          {conversionsOuvertes && vue.conversions.length > 0 && (
            <div className="bg-slate-900 border border-white/10 rounded-2xl overflow-auto max-h-[28rem]">
              <table className="w-full text-xs whitespace-nowrap">
                <thead className="bg-slate-800 text-slate-400 sticky top-0">
                  <tr>
                    {COLONNES_CONVERSIONS.map(c => <th key={c} className="text-left font-semibold px-3 py-2">{c}</th>)}
                  </tr>
                </thead>
                <tbody>
                  {vue.conversions.map((e, i) => (
                    <tr key={`${e.t}-${e.type}-${i}`} className="border-t border-white/5 text-slate-300">
                      {valeursConversion(e).map((v, j) => (
                        <td key={j} className="px-3 py-1.5 max-w-[14rem] truncate" title={v}>
                          {j === 3 ? NOMS_EVENEMENTS[v] ?? v : v || <span className="text-slate-600">—</span>}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </section>
  );
}
