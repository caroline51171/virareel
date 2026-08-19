import { useRef } from 'react';
import type { TouchEvent, MouseEvent } from 'react';

// Glissement horizontal du doigt pour passer d'un onglet à l'autre (variations,
// idées), EN PLUS des pastilles qui restent. Utilisé dans le générateur et dans
// l'historique. 2026-08-19.
//
// Trois gardes, chacune pour un problème réel :
//   1. Un seul doigt : un pincement pour zoomer ne doit pas changer d'onglet.
//   2. L'horizontal doit dominer nettement le vertical, sinon on volerait le
//      défilement de la page dès que le doigt part un peu de travers.
//   3. Le clic est neutralisé après un vrai glissement : les résultats se copient
//      AU CLIC, sans bouton — un geste mal terminé déclencherait une copie.
//
// Aux extrémités on ne boucle pas : arrivé à la dernière, glisser ne ramène pas à
// la première. Plus prévisible que de sauter d'un bout à l'autre.

const SEUIL = 60;        // px : franc, pour qu'un doigt qui hésite ne bascule rien
const DOMINANCE = 1.5;   // l'écart horizontal doit valoir 1,5 fois le vertical

export function useSwipe(onPrev: () => void, onNext: () => void) {
  const depart = useRef<{ x: number; y: number } | null>(null);
  const aGlisse = useRef(false);

  return {
    onTouchStart: (e: TouchEvent) => {
      aGlisse.current = false;
      if (e.touches.length !== 1) { depart.current = null; return; }
      depart.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
    },
    onTouchEnd: (e: TouchEvent) => {
      const d = depart.current;
      depart.current = null;
      if (!d) return;
      const t = e.changedTouches[0];
      if (!t) return;
      const dx = t.clientX - d.x;
      const dy = t.clientY - d.y;
      if (Math.abs(dx) < SEUIL || Math.abs(dx) < Math.abs(dy) * DOMINANCE) return;
      aGlisse.current = true;
      if (dx < 0) onNext(); else onPrev();
    },
    onClickCapture: (e: MouseEvent) => {
      if (!aGlisse.current) return;
      aGlisse.current = false;
      e.preventDefault();
      e.stopPropagation();
    },
  };
}
