// Le modèle Claude utilisé par le site — SOURCE UNIQUE.
//
// Le générateur, les angles, la transcréation ET la page /api/sante lisent tous
// cette constante : quand on change de modèle, la page de santé teste
// automatiquement le même que celui qui sert les clients.
export const MODELE_IA = 'claude-sonnet-4-6';
