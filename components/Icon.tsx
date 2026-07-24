'use client';

// Jeu d'icônes unique de ViraReel — remplace les anciens emoji de l'interface.
//
// Deux familles :
//  - icones generales : lucide-react (trait, strokeWidth 2, currentColor)
//  - logos de marque   : react-icons/si (simple-icons, formes pleines officielles)
//
// Regles : taille 16 / 20 / 24 uniquement, couleur toujours currentColor
// (le mode sombre et les etats hover/focus suivent le texte sans code en plus),
// aria-hidden par defaut. Passer `label` quand l'icone est SEULE dans un bouton.

import type { ComponentType, SVGProps } from 'react';
import {
  AlertTriangle,
  ArrowDown,
  BookOpen,
  Briefcase,
  Check,
  ChevronDown,
  ChevronUp,
  Clapperboard,
  Clock,
  Coins,
  Cookie,
  Copy,
  Download,
  FileText,
  Flame,
  Gift,
  Globe,
  Heart,
  HelpCircle,
  Infinity as InfinityIcon,
  KeyRound,
  Languages,
  Laugh,
  LayoutGrid,
  Lightbulb,
  Link as LinkIcon,
  Loader2,
  Lock,
  Magnet,
  Mail,
  MessageCircle,
  Minus,
  Music,
  PartyPopper,
  Pencil,
  Play,
  Plus,
  RefreshCw,
  Rocket,
  Save,
  Search,
  Settings,
  Share2,
  Sparkles,
  Star,
  Tag,
  Target,
  Timer,
  Trash2,
  Wrench,
  X,
  Zap,
} from 'lucide-react';
import { SiFacebook, SiInstagram, SiTiktok, SiYoutube } from 'react-icons/si';

type AnyIcon = ComponentType<SVGProps<SVGSVGElement> & { size?: number }>;

// Icones de trait (lucide)
const LUCIDE = {
  'alert-triangle': AlertTriangle,
  'arrow-down': ArrowDown,
  'book-open': BookOpen,
  briefcase: Briefcase,
  check: Check,
  'chevron-down': ChevronDown,
  'chevron-up': ChevronUp,
  clapperboard: Clapperboard,
  clock: Clock,
  coins: Coins,
  cookie: Cookie,
  copy: Copy,
  download: Download,
  'file-text': FileText,
  flame: Flame,
  gift: Gift,
  globe: Globe,
  heart: Heart,
  'help-circle': HelpCircle,
  infinity: InfinityIcon,
  key: KeyRound,
  languages: Languages,
  laugh: Laugh,
  'layout-grid': LayoutGrid,
  lightbulb: Lightbulb,
  link: LinkIcon,
  loader: Loader2,
  lock: Lock,
  magnet: Magnet,
  mail: Mail,
  'message-circle': MessageCircle,
  minus: Minus,
  music: Music,
  'party-popper': PartyPopper,
  pencil: Pencil,
  play: Play,
  plus: Plus,
  'refresh-cw': RefreshCw,
  rocket: Rocket,
  save: Save,
  search: Search,
  settings: Settings,
  share: Share2,
  sparkles: Sparkles,
  star: Star,
  tag: Tag,
  target: Target,
  timer: Timer,
  trash: Trash2,
  wrench: Wrench,
  x: X,
  zap: Zap,
} satisfies Record<string, AnyIcon>;

// Logos de marque officiels — jamais remplaces par une icone generique.
const BRAND = {
  instagram: SiInstagram,
  tiktok: SiTiktok,
  facebook: SiFacebook,
  youtube: SiYoutube,
} satisfies Record<string, AnyIcon>;

export type IconName = keyof typeof LUCIDE | keyof typeof BRAND;

const REGISTRY: Record<string, AnyIcon> = { ...LUCIDE, ...BRAND };

export type IconProps = {
  name: IconName;
  /** 16 = inline dans du petit texte, 20 = defaut, 24 = titres de section */
  size?: 16 | 20 | 24;
  className?: string;
  /** Icone SEULE (sans texte a cote) : donner un libelle explicite. */
  label?: string;
};

export default function Icon({ name, size = 20, className, label }: IconProps) {
  const Cmp = REGISTRY[name];
  if (!Cmp) return null;

  const isBrand = name in BRAND;
  const a11y = label
    ? { role: 'img' as const, 'aria-label': label }
    : { 'aria-hidden': true as const, focusable: false as const };

  return (
    <Cmp
      size={size}
      // `shrink-0` : l'icone ne se comprime jamais dans un flex, et
      // `inline-block` + alignement gere par le parent (flex + gap).
      className={`shrink-0 inline-block${className ? ` ${className}` : ''}`}
      // Les logos simple-icons sont des formes pleines : pas de strokeWidth.
      {...(isBrand ? {} : { strokeWidth: 2 })}
      {...a11y}
    />
  );
}
