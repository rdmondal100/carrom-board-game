import { useEffect, useRef } from 'react';
import { animate, motion, useAnimate, useMotionValue } from 'motion/react';
import { LUDO_ANIM } from '@hub/ludo';
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

/** Cube side in px; faces sit half of it out from the centre. */
const SIDE = 52;
const HALF = SIDE / 2;

/** Where each face sits on the cube (opposite faces add to 7). */
const FACE_AT: Record<number, string> = {
  1: `translateZ(${HALF}px)`,
  6: `rotateY(180deg) translateZ(${HALF}px)`,
  3: `rotateY(90deg) translateZ(${HALF}px)`,
  4: `rotateY(-90deg) translateZ(${HALF}px)`,
  2: `rotateX(90deg) translateZ(${HALF}px)`,
  5: `rotateX(-90deg) translateZ(${HALF}px)`,
};
/** The cube's turn (degrees) that brings a face to the front. */
const SHOW: Record<number, { x: number; y: number }> = {
  1: { x: 0, y: 0 }, 6: { x: 0, y: 180 }, 3: { x: 0, y: -90 }, 4: { x: 0, y: 90 }, 2: { x: -90, y: 0 }, 5: { x: 90, y: 0 },
};
/** Before any roll: a resting tilt that shows three faces. */
const IDLE = { x: -22, y: 28 };
/** Whole turns a roll adds per axis, so the die tumbles before it lands. */
const SPIN_X = 2;
const SPIN_Y = 1;
const SETTLE_MS = 250;

/** The first angle at or past `now` that equals `aim` modulo a full turn. */
const ahead = (now: number, aim: number): number => now + ((((aim - now) % 360) + 360) % 360);

function Face({ n, skin }: { n: number; skin: DiceSkin }) {
  return (
    <div className="absolute inset-0 rounded-[22%] [backface-visibility:hidden]"
      style={{
        transform: FACE_AT[n],
        background: skin.glass
          ? `radial-gradient(circle at 35% 30%, rgb(255 255 255 / 0.85) 0%, color-mix(in srgb, ${skin.face} 55%, transparent) 60%, color-mix(in srgb, ${skin.edge} 70%, transparent) 140%)`
          : `radial-gradient(circle at 35% 30%, #fff 0%, ${skin.face} 55%, ${skin.edge} 140%)`,
        boxShadow: skin.glass
          ? `inset 0 0 0 2px ${skin.edge}, inset 0 0 14px rgb(255 255 255 / 0.7)`
          : `inset 0 0 0 2px ${skin.edge}, inset 0 -6px 10px rgb(0 0 0 / 0.12)`,
      }}>
      <svg viewBox="0 0 1 1" className="size-full" aria-hidden>
        {PIPS[n]!.map(([x, y]) => (
          <g key={`${x},${y}`}>
            <circle cx={x} cy={y} r={0.09} fill={skin.pip} />
            <circle cx={x - 0.025} cy={y - 0.025} r={0.025} fill="#fff" opacity={0.35} />
          </g>
        ))}
      </svg>
    </div>
  );
}

interface Props {
  value: number | null;
  skin: DiceSkin;
  /** Tumble while a roll is shown. */
  rolling?: boolean;
  /** LUDO-3 tap to roll: the die is a button. */
  onRoll?: () => void;
  label: string;
  className?: string;
}

/** LUDO-6 / MOT-2 the die: a 3D cube that tumbles on each roll and lands on the rolled face. */
export function Dice({ value, skin, rolling = false, onRoll, label, className }: Props) {
  const [scope, animateScope] = useAnimate<HTMLDivElement>();
  const rx = useMotionValue(IDLE.x);
  const ry = useMotionValue(IDLE.y);
  const angle = useRef({ ...IDLE });

  useEffect(() => {
    const to = value ? SHOW[value]! : IDLE;
    const from = angle.current;
    const end = {
      x: ahead(from.x, to.x) + (rolling ? 360 * SPIN_X : 0),
      y: ahead(from.y, to.y) + (rolling ? 360 * SPIN_Y : 0),
    };
    if (end.x === from.x && end.y === from.y) return;
    angle.current = end;
    const s = (rolling ? LUDO_ANIM.DICE_MS * 0.85 : SETTLE_MS) / 1000;
    const ease = [0.15, 0.75, 0.3, 1] as const;
    const a = animate(rx, end.x, { duration: s, ease });
    const b = animate(ry, end.y, { duration: s, ease });
    if (rolling && scope.current) void animateScope(scope.current, { y: [0, -24, 0, -6, 0], scale: [0.9, 1.08, 1, 1.03, 1] }, { duration: s, times: [0, 0.35, 0.7, 0.85, 1] });
    // A new roll or unmount: jump to this roll's end so the next one starts from it.
    return () => { a.complete(); b.complete(); };
  }, [animateScope, rolling, rx, ry, scope, value]);

  const cube = (
    <div ref={scope} className={cn('relative', className)} style={{ width: SIDE, height: SIDE, perspective: 420 }} aria-hidden>
      <div className="absolute -bottom-2.5 left-1/2 h-3 w-11 -translate-x-1/2 rounded-[50%] bg-black/35 blur-[3px]" />
      <motion.div className="relative size-full [transform-style:preserve-3d]" style={{ rotateX: rx, rotateY: ry }}>
        {[1, 2, 3, 4, 5, 6].map((n) => <Face key={n} n={n} skin={skin} />)}
      </motion.div>
    </div>
  );
  if (!onRoll) return <div role="img" aria-label={label} data-testid="dice" data-value={value ?? ''} className="p-1.5">{cube}</div>;
  return (
    <button type="button" onClick={onRoll} aria-label={label} data-testid="dice-roll"
      className="rounded-2xl p-1.5 ring-4 ring-amber-400 ring-offset-2 ring-offset-background animate-glow transition hover:scale-105 active:scale-95 focus-visible:outline-none">
      {cube}
    </button>
  );
}
