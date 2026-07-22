// Copie de texte qui fonctionne partout : HTTPS, HTTP, mobile (iOS/Safari), desktop.
// navigator.clipboard n'existe pas en contexte non-sécurisé (http://192.168...),
// et le presse-papiers d'iOS Safari est capricieux → repli robuste avec sélection Range.

// Rapport de diagnostic renvoyé par copyTextDiag() — sert à cibler le bug iOS « %%% ».
export interface CopyDiag {
  ok: boolean;          // la copie a-t-elle réussi
  path: string;         // quel chemin de copie a été pris (writeText / execCommand…)
  secure: boolean;      // window.isSecureContext
  hasClipboard: boolean;// navigator.clipboard existe
  isIOS: boolean;       // iPhone / iPad / iPod
  writeTextError?: string; // message d'erreur si navigator.clipboard.writeText a planté
  len: number;          // longueur du texte réellement passé au bouton
  preview: string;      // 60 premiers caractères du texte RÉEL (brut, avant copie)
  looksEncoded: boolean;// le texte contient-il déjà du %20 / %C3 / %0A… AVANT la copie
}

// Détecte un texte déjà encodé en URL (présence de séquences %XX hexadécimales).
function detectEncoded(text: string): boolean {
  return /%[0-9A-Fa-f]{2}/.test(text);
}

// Version instrumentée : copie ET renvoie un rapport détaillé du chemin pris.
export async function copyTextDiag(text: string): Promise<CopyDiag> {
  const isIOS =
    typeof navigator !== 'undefined' && /ipad|iphone|ipod/i.test(navigator.userAgent);
  const secure = typeof window !== 'undefined' && !!window.isSecureContext;
  const hasClipboard = typeof navigator !== 'undefined' && !!navigator.clipboard;

  const diag: CopyDiag = {
    ok: false,
    path: '',
    secure,
    hasClipboard,
    isIOS,
    len: text.length,
    preview: text.slice(0, 60),
    looksEncoded: detectEncoded(text),
  };

  // 1) API moderne (préférée) — fonctionne sur Safari iOS récent en contexte sécurisé.
  if (hasClipboard && secure) {
    try {
      await navigator.clipboard.writeText(text);
      diag.ok = true;
      diag.path = 'writeText OK';
      return diag;
    } catch (e) {
      diag.writeTextError = e instanceof Error ? e.message : String(e);
      diag.path = 'writeText A PLANTÉ → repli';
    }
  } else {
    diag.path = `pas de writeText (secure=${secure}, clip=${hasClipboard}) → repli`;
  }

  // 2) Repli compatible iOS : textarea + sélection via Range (le .select() seul échoue sur iOS).
  try {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.setAttribute('readonly', '');
    ta.contentEditable = 'true';
    // Hors écran mais réellement sélectionnable (opacity:0 empêche la copie sur iOS).
    ta.style.position = 'fixed';
    ta.style.top = '0';
    ta.style.left = '0';
    ta.style.width = '1px';
    ta.style.height = '1px';
    ta.style.padding = '0';
    ta.style.border = 'none';
    ta.style.outline = 'none';
    ta.style.boxShadow = 'none';
    ta.style.background = 'transparent';
    document.body.appendChild(ta);

    // Sauvegarder la sélection existante de l'utilisateur pour la restaurer après.
    const selection = document.getSelection();
    const savedRange = selection && selection.rangeCount > 0 ? selection.getRangeAt(0) : null;

    if (isIOS) {
      const range = document.createRange();
      range.selectNodeContents(ta);
      selection?.removeAllRanges();
      selection?.addRange(range);
      ta.setSelectionRange(0, text.length);
    } else {
      ta.focus();
      ta.select();
    }

    const ok = document.execCommand('copy');
    document.body.removeChild(ta);

    // Restaurer la sélection d'origine.
    if (savedRange && selection) {
      selection.removeAllRanges();
      selection.addRange(savedRange);
    }
    diag.ok = ok;
    diag.path += ` | execCommand ${isIOS ? 'iOS' : 'std'}=${ok}`;
    return diag;
  } catch (e) {
    diag.path += ` | execCommand ERREUR: ${e instanceof Error ? e.message : String(e)}`;
    return diag;
  }
}

export async function copyText(text: string): Promise<boolean> {
  return (await copyTextDiag(text)).ok;
}
