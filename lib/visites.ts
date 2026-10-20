// COMPTEUR DE VISITES d'/admin : combien de personnes arrivent sur le site, d'où, sur
// quel appareil. Vercel Analytics le montre aussi, mais son forfait gratuit ne laisse
// pas le site relire ces chiffres — d'où ce compteur à nous, affiché dans Performance.
//
// Promesse de vie privée : AUCUN témoin, aucune adresse IP, rien qui identifie la
// personne. Le navigateur garde seulement un drapeau de session (sessionStorage, effacé
// à la fermeture de l'onglet) pour ne pas compter deux fois la même visite ; le serveur
// n'ajoute que +1 à des totaux par jour (lib/journal.ts, enregistrerVisite).
//
// Fichier PUR (aucun import) : testé sans réseau (visites.test.ts).

export type Appareil = 'mobile' | 'tablette' | 'ordinateur';

// Les aperçus de lien et robots d'indexation ne sont pas des visiteurs. La plupart
// n'exécutent pas le JavaScript, mais certains (navigateurs sans écran) oui.
const ROBOT = /bot|crawl|spider|slurp|facebookexternalhit|preview|headless|lighthouse|pingdom|monitor/i;

export function estRobot(ua: string | null | undefined): boolean {
  return !ua || ROBOT.test(ua);
}

export function appareilDe(ua: string | null | undefined): Appareil {
  if (!ua) return 'ordinateur';
  if (/iPad|Tablet/i.test(ua) || (/Android/i.test(ua) && !/Mobile/i.test(ua))) return 'tablette';
  if (/Mobi|iPhone|Android/i.test(ua)) return 'mobile';
  return 'ordinateur';
}

const RESEAUX: [RegExp, string][] = [
  [/(^|\.)facebook\.com$|^fb$|^facebook$|com\.facebook\./i, 'Facebook'],
  [/(^|\.)instagram\.com$|^ig$|^instagram$|com\.instagram\./i, 'Instagram'],
  [/(^|\.)tiktok\.com$|^tiktok$|musically/i, 'TikTok'],
  [/(^|\.)youtube\.com$|^youtube$|^yt$/i, 'YouTube'],
  [/(^|\.)google\.[a-z.]+$|^google$/i, 'Google'],
];

/**
 * D'où vient la visite. L'étiquette UTM de la pub passe avant le référent (elle dit
 * exactement quelle pub) ; un fbclid seul = un clic venu de Meta. Arriver depuis le site
 * lui-même ou sans référent = « Direct ».
 */
export function sourceDe(referent: string, utmSource: string, fbclid: boolean, hoteSite: string): string {
  const utm = utmSource.trim().toLowerCase();
  if (utm) {
    for (const [motif, nom] of RESEAUX) if (motif.test(utm)) return nom;
    return 'Autre';
  }
  if (fbclid) return 'Facebook';
  let hote = '';
  try {
    const u = new URL(referent);
    // Application Android : « android-app://com.facebook.katana/ ».
    hote = u.protocol === 'android-app:' ? u.host : u.hostname;
  } catch {
    return 'Direct';
  }
  hote = hote.toLowerCase().replace(/^www\./, '');
  if (!hote || hote === hoteSite.toLowerCase().replace(/^www\./, '')) return 'Direct';
  for (const [motif, nom] of RESEAUX) if (motif.test(hote)) return nom;
  return 'Autre';
}

/** Code pays à 2 lettres fourni par Vercel ; tout le reste devient « ?? ». */
export function paysDe(entete: string | null | undefined): string {
  return entete && /^[A-Z]{2}$/.test(entete) ? entete : '??';
}
