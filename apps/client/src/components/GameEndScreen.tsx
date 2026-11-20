import type { Team } from '@carrom/rules';
import { RewardedAdButton, useGameEndAds } from '@/components/AdParts';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { scoreLine, teamLabel } from '@/game/hud';
import type { LocalGame } from '@/game/localGame';
import { t } from '@/i18n/t';

interface Props {
  game: LocalGame; winner: Team; onRematch: () => void; onHome: () => void;
  /** ROOM-9 e.g. the rematch votes. */
  note?: string;
  rematchDisabled?: boolean;
}

const stay = (e: Event) => e.preventDefault();

/** LOC-7: winner, final scores, rematch or home. AD-3 rewarded ad offer; AD-4 interstitial on the way out. */
export function GameEndScreen({ game, winner, onRematch, onHome, note, rematchDisabled = false }: Props) {
  const { leaving, leave } = useGameEndAds();
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
        {note && <p className="text-sm text-muted-foreground" role="status">{note}</p>}
        <RewardedAdButton className="mx-auto" />
        <DialogFooter className="mt-2 flex-row justify-center">
          <Button autoFocus onClick={() => leave(onRematch)} disabled={rematchDisabled || leaving}>{t('gameEnd.rematch')}</Button>
          <Button variant="outline" onClick={() => leave(onHome)} disabled={leaving}>{t('gameEnd.home')}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
