import type { JSX } from 'react';
import { cn } from '@/lib/utils';

/**
 * Hub look per game: a poster gradient, an accent, a badge and a small SVG
 * illustration. Looks only; keyed by game id so the hub never loads a game's code.
 */
export interface GameTheme {
  /** CSS background for the poster card. */
  poster: string;
  /** Accent for glows and rings. */
  glow: string;
  /** i18n key of the corner badge, or null. */
  badgeKey: string | null;
}

const THEMES: Record<string, GameTheme> = {
  carrom: { poster: 'linear-gradient(140deg, #ffb347 0%, #f2652b 45%, #9a2a12 100%)', glow: '#ff9a3d', badgeKey: 'hub.badge.hot' },
  ludo: { poster: 'linear-gradient(140deg, #4ade80 0%, #16a34a 45%, #0f5132 100%)', glow: '#34d399', badgeKey: 'hub.badge.family' },
  callbreak: { poster: 'linear-gradient(140deg, #60a5fa 0%, #4f46e5 50%, #2e1065 100%)', glow: '#818cf8', badgeKey: 'hub.badge.cards' },
  nodipar: { poster: 'linear-gradient(140deg, #5eead4 0%, #0891b2 50%, #164e63 100%)', glow: '#22d3ee', badgeKey: 'hub.badge.original' },
};

const FALLBACK: GameTheme = { poster: 'linear-gradient(140deg, #c084fc, #6d28d9 60%, #2e1065)', glow: '#a78bfa', badgeKey: null };

export const themeOf = (id: string): GameTheme => THEMES[id] ?? FALLBACK;

function CarromArt() {
  return (
    <g>
      <rect x="14" y="14" width="92" height="92" rx="10" fill="#7a3510" />
      <rect x="20" y="20" width="80" height="80" rx="6" fill="#f6d9a3" />
      <rect x="20" y="20" width="80" height="80" rx="6" fill="url(#wood)" opacity="0.5" />
      {[[27, 27], [93, 27], [27, 93], [93, 93]].map(([x, y]) => <circle key={`${x}${y}`} cx={x} cy={y} r="5.5" fill="#1b0e06" />)}
      <circle cx="60" cy="60" r="16" fill="none" stroke="#b3311d" strokeWidth="1.6" />
      <circle cx="60" cy="60" r="4.6" fill="#e0245e" stroke="#7a0f2c" strokeWidth="0.8" />
      {[[60, 50], [69, 56], [69, 65], [60, 70], [51, 65], [51, 56]].map(([x, y], i) => (
        <circle key={i} cx={x} cy={y} r="4.4" fill={i % 2 ? '#2a1a12' : '#fff6e3'} stroke={i % 2 ? '#000' : '#bfa27a'} strokeWidth="0.7" />
      ))}
      <circle cx="78" cy="88" r="6.5" fill="#7dd3fc" stroke="#0c4a6e" strokeWidth="1.2" />
      <path d="M78 81 L66 64" stroke="#fff" strokeWidth="1.2" strokeDasharray="2 2" opacity="0.8" />
    </g>
  );
}

function LudoArt() {
  const q = ['#ef4444', '#22c55e', '#facc15', '#3b82f6'];
  return (
    <g>
      <rect x="12" y="12" width="84" height="84" rx="10" fill="#fff7e8" />
      <rect x="16" y="16" width="32" height="32" rx="6" fill={q[0]} />
      <rect x="60" y="16" width="32" height="32" rx="6" fill={q[1]} />
      <rect x="60" y="60" width="32" height="32" rx="6" fill={q[2]} />
      <rect x="16" y="60" width="32" height="32" rx="6" fill={q[3]} />
      <path d="M48 48 L60 48 L54 54Z" fill={q[0]} /><path d="M60 48 L60 60 L54 54Z" fill={q[1]} />
      <path d="M60 60 L48 60 L54 54Z" fill={q[2]} /><path d="M48 60 L48 48 L54 54Z" fill={q[3]} />
      {[[26, 26], [38, 38], [70, 26], [82, 38]].map(([x, y], i) => <circle key={i} cx={x} cy={y} r="4" fill="#fff" opacity="0.9" />)}
      <g transform="translate(70 70) rotate(14)">
        <rect x="0" y="0" width="34" height="34" rx="8" fill="#fff" stroke="#d6cfc2" strokeWidth="1.5" />
        <rect x="0" y="0" width="34" height="16" rx="8" fill="#fff" opacity="0.6" />
        {[[9, 9], [25, 9], [17, 17], [9, 25], [25, 25]].map(([x, y]) => <circle key={`${x}${y}`} cx={x} cy={y} r="3" fill="#1f1a17" />)}
      </g>
      <g>
        <circle cx="30" cy="104" r="7" fill="#ef4444" stroke="#7f1d1d" strokeWidth="1.2" />
        <circle cx="30" cy="96" r="4" fill="#ef4444" stroke="#7f1d1d" strokeWidth="1.2" />
      </g>
    </g>
  );
}

function CardsArt() {
  const card = (rot: number, rank: string, suit: string, red: boolean) => (
    <g transform={`rotate(${rot} 60 104)`}>
      <rect x="38" y="22" width="44" height="64" rx="6" fill="#fffdf8" stroke="#cbd5e1" strokeWidth="1" />
      <text x="44" y="36" fontSize="11" fontWeight="700" fill={red ? '#dc2626' : '#0f172a'} fontFamily="Inter, sans-serif">{rank}</text>
      <text x="60" y="66" fontSize="26" textAnchor="middle" fill={red ? '#dc2626' : '#0f172a'}>{suit}</text>
    </g>
  );
  return (
    <g>
      {card(-22, 'Q', '♦', true)}
      {card(-4, 'K', '♥', true)}
      {card(14, 'A', '♠', false)}
      <circle cx="98" cy="22" r="10" fill="#fde047" stroke="#a16207" strokeWidth="1.4" />
      <text x="98" y="26.5" fontSize="12" textAnchor="middle" fontWeight="800" fill="#713f12">5</text>
    </g>
  );
}

function RiverArt() {
  return (
    <g clipPath="url(#riverTile)">
      <rect x="12" y="12" width="96" height="96" fill="url(#sky)" />
      <circle cx="84" cy="34" r="14" fill="#fde68a" opacity="0.35" />
      <circle cx="84" cy="34" r="9" fill="#fef3c7" />
      <path d="M0 62 Q15 56 30 62 T60 62 T90 62 T120 62 V120 H0Z" fill="#0e7490" opacity="0.65" />
      <path d="M0 76 Q15 70 30 76 T60 76 T90 76 T120 76 V120 H0Z" fill="#0891b2" opacity="0.8" />
      <path d="M0 92 Q15 86 30 92 T60 92 T90 92 T120 92 V120 H0Z" fill="#155e75" />
      <g transform="translate(22 52)">
        <path d="M0 14 L34 14 L28 22 L6 22Z" fill="#7c2d12" />
        <path d="M16 14 L16 -8 L32 12Z" fill="#fef3c7" stroke="#b45309" strokeWidth="1" />
        <path d="M16 -8 L16 14" stroke="#451a03" strokeWidth="1.4" />
      </g>
      <g transform="translate(64 70) scale(0.75)">
        <path d="M0 14 L34 14 L28 22 L6 22Z" fill="#9f1239" />
        <path d="M16 14 L16 -8 L30 12Z" fill="#fecdd3" stroke="#9f1239" strokeWidth="1" />
      </g>
      <rect x="12" y="12" width="96" height="96" rx="14" fill="none" stroke="#fff" strokeOpacity="0.7" strokeWidth="3" />
    </g>
  );
}

const ART: Record<string, () => JSX.Element> = { carrom: CarromArt, ludo: LudoArt, callbreak: CardsArt, nodipar: RiverArt };

/** The game's poster illustration (falls back to nothing for an unknown id). */
export function GameArt({ id, className }: { id: string; className?: string }) {
  const Art = ART[id];
  if (!Art) return null;
  return (
    <svg viewBox="0 0 120 120" className={cn('drop-shadow-[0_10px_14px_rgb(0_0_0/0.35)]', className)} aria-hidden>
      <defs>
        <linearGradient id="wood" x1="0" x2="1" y1="0" y2="1">
          <stop offset="0" stopColor="#fff" stopOpacity="0.6" />
          <stop offset="1" stopColor="#c98a3a" stopOpacity="0.4" />
        </linearGradient>
        <linearGradient id="sky" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0" stopColor="#fb923c" />
          <stop offset="0.55" stopColor="#f9a8d4" />
          <stop offset="1" stopColor="#67e8f9" />
        </linearGradient>
        <clipPath id="riverTile"><rect x="12" y="12" width="96" height="96" rx="14" /></clipPath>
      </defs>
      <Art />
    </svg>
  );
}
