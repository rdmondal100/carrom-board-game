import type { ReactNode } from 'react';
import { teamOf, type Team } from '@carrom/rules';
import { coinsDown, redStatus, scoreLine, sideColour, teamLabel } from '@/game/hud';
import { seatName, type LocalGame } from '@/game/localGame';
import { t } from '@/i18n/t';

/** Swatch per side: the coin colour in the colour game, a team tint in the point game. */
function swatchClass(g: LocalGame, team: Team): string {
  const colour = sideColour(g.state, team);
  if (colour === 'white') return 'bg-amber-50 border-amber-900';
  if (colour === 'black') return 'bg-neutral-900 border-neutral-400';
  return team === 'A' ? 'bg-amber-500 border-amber-900' : 'bg-sky-500 border-sky-900';
}

function Swatch({ g, team }: { g: LocalGame; team: Team }) {
  return <span className={`inline-block size-3.5 rounded-full border ${swatchClass(g, team)}`} />;
}

function Side({ g, team, active }: { g: LocalGame; team: Team; active: boolean }) {
  const colour = sideColour(g.state, team);
  return (
    <div className={`flex items-center gap-2 rounded px-2 py-1 ${active ? 'bg-amber-900/50' : ''}`}>
      <Swatch g={g} team={team} />
      <span className="truncate font-medium">{teamLabel(g, team)}</span>
      {colour && <span className="text-xs opacity-70">{t(`hud.${colour}`)}</span>}
      <span className="ml-auto tabular-nums font-semibold">{g.state.scores[team]}</span>
      <span className="text-xs opacity-70 tabular-nums">{t('hud.down', { n: coinsDown(g.state, team) })}</span>
    </div>
  );
}

interface Props { game: LocalGame; clock: ReactNode; onPause: () => void; canPause: boolean }

/** LOC-4: shooter, scores, board number, coins down per side and red status. */
export function Hud({ game, clock, onPause, canPause }: Props) {
  const { state } = game;
  const shooterTeam = teamOf(state.turnSeat, state.config.format);
  const red = redStatus(game);
  return (
    <section aria-label={scoreLine(game)} className="flex flex-col gap-2 text-sm">
      <div className="flex items-center gap-2">
        <Swatch g={game} team={shooterTeam} />
        <span className="font-semibold text-base truncate">
          {t('hud.turn', { name: seatName(game, state.turnSeat) })}
        </span>
        <span className="ml-auto">{clock}</span>
        <button type="button" onClick={onPause} disabled={!canPause} className="px-3 py-1 rounded bg-amber-800 disabled:opacity-50">
          {t('hud.pause')}
        </button>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-1">
        <Side g={game} team="A" active={shooterTeam === 'A'} />
        <Side g={game} team="B" active={shooterTeam === 'B'} />
      </div>
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 opacity-90">
        <span>{t('hud.board', { n: state.boardNo })}</span>
        <span className="flex items-center gap-1">
          <span className="inline-block size-3 rounded-full bg-red-600" />
          {t(red.key, red.vars)}
        </span>
      </div>
    </section>
  );
}
