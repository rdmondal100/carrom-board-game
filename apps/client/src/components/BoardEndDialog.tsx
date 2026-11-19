import type { Team } from '@carrom/rules';
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

/** LOC-7: who won the board, its points, the scores, then the next board. */
export function BoardEndDialog({ game, boardNo, winner, points, onNext }: Props) {
  return (
    <div className="fixed inset-0 z-30 flex items-center justify-center bg-black/60 p-4">
      <div role="dialog" aria-modal="true" className="w-full max-w-sm rounded-xl bg-amber-950 p-5 flex flex-col gap-3 text-center shadow-xl">
        <h2 className="text-lg font-bold">{t('boardEnd.title', { n: boardNo })}</h2>
        <p className="text-base">{t('boardEnd.winner', { name: teamLabel(game, winner) })}</p>
        <p className="text-2xl font-semibold text-amber-300">{t('boardEnd.points', { points })}</p>
        <p className="tabular-nums">{scoreLine(game)}</p>
        <button type="button" autoFocus onClick={onNext} className="mt-2 px-4 py-2 rounded bg-amber-700 font-semibold">
          {t('boardEnd.next')}
        </button>
      </div>
    </div>
  );
}
