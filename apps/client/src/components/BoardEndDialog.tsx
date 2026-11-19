import type { Team } from '@carrom/rules';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { scoreLine, teamLabel } from '@/game/hud';
import type { LocalGame } from '@/game/localGame';
import { t } from '@/i18n/t';

interface Props {
  /** The game after the board was scored. */
  game: LocalGame;
  boardNo: number;
  winner: Team;
  points: number;
  onNext: () => void;
}

const stay = (e: Event) => e.preventDefault();

/** LOC-7: who won the board, its points, the scores, then the next board. */
export function BoardEndDialog({ game, boardNo, winner, points, onNext }: Props) {
  return (
    <Dialog open>
      <DialogContent className="text-center" onEscapeKeyDown={stay} onPointerDownOutside={stay}>
        <DialogHeader>
          <DialogTitle>{t('boardEnd.title', { n: boardNo })}</DialogTitle>
          <DialogDescription className="text-base text-foreground">{t('boardEnd.winner', { name: teamLabel(game, winner) })}</DialogDescription>
        </DialogHeader>
        <p className="text-2xl font-semibold text-amber-300">{t('boardEnd.points', { points })}</p>
        <p className="tabular-nums">{scoreLine(game)}</p>
        <Button autoFocus className="mt-2" onClick={onNext}>{t('boardEnd.next')}</Button>
      </DialogContent>
    </Dialog>
  );
}
