import type { DiceSkin } from '@/games/ludo/skins';
import { cn } from '@/lib/utils';

/** Pip spots (in a 0..1 square) per face. */
const PIPS: Record<number, readonly [number, number][]> = {
  1: [[0.5, 0.5]],
  2: [[0.27, 0.27], [0.73, 0.73]],
  3: [[0.27, 0.27], [0.5, 0.5], [0.73, 0.73]],
  4: [[0.27, 0.27], [0.73, 0.27], [0.27, 0.73], [0.73, 0.73]],
  5: [[0.27, 0.27], [0.73, 0.27], [0.5, 0.5], [0.27, 0.73], [0.73, 0.73]],
  6: [[0.27, 0.25], [0.73, 0.25], [0.27, 0.5], [0.73, 0.5], [0.27, 0.75], [0.73, 0.75]],
};

interface Props {
  value: number | null;
  skin: DiceSkin;
  /** Shake while a roll is shown. */
  rolling?: boolean;
  /** LUDO-3 tap to roll: the die is a button. */
  onRoll?: () => void;
  label: string;
  className?: string;
}

/** LUDO-6 the die: a face with pips, a shake on each roll, and a button when the player must tap to roll. */
export function Dice({ value, skin, rolling = false, onRoll, label, className }: Props) {
  const face = (
    <svg viewBox="0 0 1 1" className={cn('size-14', rolling && 'animate-[spin_0.6s_ease-out]', className)} aria-hidden>
      <rect x={0.04} y={0.04} width={0.92} height={0.92} rx={0.18} fill={skin.face} stroke={skin.edge} strokeWidth={0.05} />
      {(value ? PIPS[value] ?? [] : []).map(([x, y]) => <circle key={`${x},${y}`} cx={x} cy={y} r={0.085} fill={skin.pip} />)}
      {!value && <text x={0.5} y={0.62} textAnchor="middle" fontSize={0.36} fill={skin.pip}>?</text>}
    </svg>
  );
  if (!onRoll) return <div role="img" aria-label={label} data-testid="dice" data-value={value ?? ''}>{face}</div>;
  return (
    <button type="button" onClick={onRoll} aria-label={label} data-testid="dice-roll"
      className="rounded-xl ring-2 ring-amber-400 ring-offset-2 ring-offset-background animate-pulse focus-visible:outline-none">
      {face}
    </button>
  );
}
