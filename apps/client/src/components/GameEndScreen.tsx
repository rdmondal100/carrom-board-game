import type { Team } from '@carrom/rules';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { scoreLine, teamLabel } from '@/game/hud';
import type { LocalGame } from '@/game/localGame';
import { t } from '@/i18n/t';

interface Props { game: LocalGame; winner: Team; onRematch: () => void; onHome: () => void }

const stay = (e: Event) => e.preventDefault();

/** LOC-7: winner, final scores, rematch or home. */
export function GameEndScreen({ game, winner, onRematch, onHome }: Props) {
  return (
    <Dialog open>
      <DialogContent className="p-6 text-center" onEscapeKeyDown={stay} onPointerDownOutside={stay}>
        <DialogHeader>
          <DialogTitle className="text-xl">{t('gameEnd.title')}</DialogTitle>
          <DialogDescription className="text-2xl font-semibold text-amber-300">
            {t('gameEnd.winner', { name: teamLabel(game, winner) })}
          </DialogDescription>
        </DialogHeader>
        <p className="text-sm text-muted-foreground">{t('gameEnd.scores')}</p>
        <p className="text-lg tabular-nums">{scoreLine(game)}</p>
        <DialogFooter className="mt-2 flex-row justify-center">
          <Button autoFocus onClick={onRematch}>{t('gameEnd.rematch')}</Button>
          <Button variant="outline" onClick={onHome}>{t('gameEnd.home')}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
