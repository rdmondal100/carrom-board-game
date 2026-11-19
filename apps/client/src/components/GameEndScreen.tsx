import type { Team } from '@carrom/rules';
import { scoreLine, teamLabel } from '@/game/hud';
import type { LocalGame } from '@/game/localGame';
import { t } from '@/i18n/t';

interface Props { game: LocalGame; winner: Team; onRematch: () => void; onHome: () => void }

/** LOC-7: winner, final scores, rematch or home. */
export function GameEndScreen({ game, winner, onRematch, onHome }: Props) {
  return (
    <div className="fixed inset-0 z-30 flex items-center justify-center bg-black/70 p-4">
      <div role="dialog" aria-modal="true" className="w-full max-w-sm rounded-xl bg-amber-950 p-6 flex flex-col gap-3 text-center shadow-xl">
        <h2 className="text-xl font-bold">{t('gameEnd.title')}</h2>
        <p className="text-2xl font-semibold text-amber-300">{t('gameEnd.winner', { name: teamLabel(game, winner) })}</p>
        <p className="text-sm opacity-80">{t('gameEnd.scores')}</p>
        <p className="tabular-nums text-lg">{scoreLine(game)}</p>
        <div className="mt-2 flex gap-2 justify-center">
          <button type="button" autoFocus onClick={onRematch} className="px-4 py-2 rounded bg-amber-700 font-semibold">
            {t('gameEnd.rematch')}
          </button>
          <button type="button" onClick={onHome} className="px-4 py-2 rounded border border-amber-700">
            {t('gameEnd.home')}
          </button>
        </div>
      </div>
    </div>
  );
}
