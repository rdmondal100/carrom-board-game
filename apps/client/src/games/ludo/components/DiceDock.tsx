import { useState, type ReactNode } from 'react';
import { LayoutGroup, motion } from 'motion/react';
import { diceSpot, type Corner } from '@/games/ludo/diceSpot';
import { cn } from '@/lib/utils';

interface Props {
  /** The seat whose die this is (the roller while a roll shows, else the turn seat). */
  seat: number;
  viewSeat: number;
  /** MOT-1 same device with 2+ humans: the die turns to face the player at that corner. */
  face: boolean;
  board: ReactNode;
  /** The die and its prompt; they travel together. */
  die: ReactNode;
  /** Shown under the board between the bottom corners (clock, take back). */
  extra?: ReactNode;
}

/** The shortest turn from `from` to `facing` (degrees), so 270 → 0 goes on to 360. */
const turnTo = (from: number, facing: number): number => from + ((((facing - from) % 360) + 540) % 360) - 180;

const SPRING = { type: 'spring', stiffness: 170, damping: 22 } as const;

/**
 * MOT-1 the board with a corner slot above and below on each side. The die sits
 * in the slot of the seat to play and glides (and turns) to the next one.
 */
export function DiceDock({ seat, viewSeat, face, board, die, extra }: Props) {
  const spot = diceSpot(seat, viewSeat);
  const facing: number = face ? spot.facing : 0;
  // Keep a running angle so each turn goes the short way round.
  const [turn, setTurn] = useState({ facing, angle: facing });
  if (turn.facing !== facing) setTurn({ facing, angle: turnTo(turn.angle, facing) });

  const slot = (c: Corner) => (
    // A fixed height whether the die is here or not, so the board never shifts as it moves.
    <div className={cn('flex h-24 items-center overflow-visible', c.endsWith('r') ? 'justify-end' : 'justify-start')} data-corner={c}>
      {spot.corner === c && (
        <motion.div layoutId="ludo-die" layout transition={SPRING} className="flex flex-col items-center gap-1"
          animate={{ rotate: turn.angle }} data-testid="dice-dock" data-corner={c} data-facing={facing}>
          {die}
        </motion.div>
      )}
    </div>
  );
  return (
    <LayoutGroup>
      <div className="flex w-full flex-col items-center">
        <div className="grid w-full max-w-[min(100%,70vh)] grid-cols-2 px-2">{slot('tl')}{slot('tr')}</div>
        {board}
        <div className="grid w-full max-w-[min(100%,70vh)] grid-cols-[1fr_auto_1fr] items-center gap-2 px-2">
          {slot('bl')}
          <div className="flex h-24 flex-col items-center justify-center gap-1 overflow-visible">{extra}</div>
          {slot('br')}
        </div>
      </div>
    </LayoutGroup>
  );
}
