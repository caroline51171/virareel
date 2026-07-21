// Copie de texte qui fonctionne partout : HTTPS, HTTP, mobile (iOS/Safari), desktop.
// navigator.clipboard n'existe pas en contexte non-sécurisé (http://192.168...),
// et le presse-papiers d'iOS Safari est capricieux → repli robuste avec sélection Range.

export async function copyText(text: string): Promise<boolean> {
  // 1) API moderne (préférée) — fonctionne sur Safari iOS récent en contexte sécurisé.
  try {
    if (typeof navigator !== 'undefined' && navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    // on tombe sur la solution de secours ci-dessous
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

    const isIOS =
      typeof navigator !== 'undefined' &&
      /ipad|iphone|ipod/i.test(navigator.userAgent);

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
    return ok;
  } catch {
    return false;
  }
}
