import { useRef, useEffect, useCallback } from 'react';

// Verrou de réveil (Screen Wake Lock) : empêche la mise en veille automatique
// pendant qu'une génération tourne — les 4 idées durent ~1 min 30 et les
// téléphones s'endormaient avant la fin. 2026-08-19.
//
// Règles :
//  - Demandé au début d'une génération, relâché dès qu'elle finit (succès ou
//    erreur). Jamais en dehors : garder l'écran allumé sans raison vide la
//    batterie.
//  - Le téléphone annule le verrou quand la page passe en arrière-plan : on le
//    reprend au retour si une génération est encore en cours.
//  - Silencieux en cas de refus ou de navigateur trop vieux : la génération
//    continue exactement comme avant, sans message.
//  - N'empêche PAS un verrouillage manuel du téléphone (bouton) — seule la
//    veille automatique est retenue.

type WakeLockSentinel = { release: () => Promise<void>; released: boolean };

export function useWakeLock() {
  const verrou = useRef<WakeLockSentinel | null>(null);
  const actif = useRef(false); // une génération est en cours

  const demander = useCallback(async () => {
    try {
      const wl = (navigator as Navigator & { wakeLock?: { request: (t: 'screen') => Promise<WakeLockSentinel> } }).wakeLock;
      if (wl) verrou.current = await wl.request('screen');
    } catch { /* refusé (batterie faible, vieux navigateur) : on continue sans */ }
  }, []);

  const acquire = useCallback(() => { actif.current = true; void demander(); }, [demander]);

  const release = useCallback(() => {
    actif.current = false;
    void verrou.current?.release().catch(() => {});
    verrou.current = null;
  }, []);

  // Reprise au retour d'arrière-plan, seulement si une génération tourne encore.
  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState === 'visible' && actif.current) void demander();
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => document.removeEventListener('visibilitychange', onVisible);
  }, [demander]);

  return { acquire, release };
}
