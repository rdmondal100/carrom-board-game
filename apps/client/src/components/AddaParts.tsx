import { useState, type ReactNode } from 'react';
import type { GroupPlayers, Presence } from '@carrom/protocol';
import { Avatar } from '@/components/Avatar';
import { Button } from '@/components/ui/button';
import { gameIn, useGames } from '@/games/GamesContext';
import { t } from '@/i18n/t';
import { presenceText } from '@/lib/adda';
import { cn } from '@/lib/utils';

/** ADDA-1 a dot and a line: offline / in the menus / playing a game. */
export function PresenceLine({ presence }: { presence: Presence }) {
  const { games } = useGames();
  const p = presenceText(presence);
  const game = p.game ? gameIn(games, p.game) : undefined;
  return (
    <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
      <span aria-hidden="true" className={cn('size-2 rounded-full', presence.state === 'offline' ? 'bg-muted-foreground/40' : 'bg-emerald-400')} />
      {t(p.key, { game: game ? t(game.nameKey) : (p.game ?? '') })}
    </span>
  );
}

/** One player in a list: avatar, name, a line under it, and actions on the right. */
export function PlayerRow({ name, avatar, sub, children }: { name: string; avatar: number; sub?: ReactNode; children?: ReactNode }) {
  return (
    <li className="flex items-center gap-3 rounded-lg bg-muted/40 px-3 py-2">
      <Avatar index={avatar} name={name} size="sm" />
      <div className="flex min-w-0 flex-1 flex-col">
        <span className="truncate font-medium">{name}</span>
        {sub}
      </div>
      <div className="flex shrink-0 items-center gap-1">{children}</div>
    </li>
  );
}

/** Games whose group rooms always have this many seats (the host fills the rest with bots). */
const FIXED_SEATS: Readonly<Record<string, GroupPlayers>> = { callbreak: 4 };

/** ADDA-3 / ADDA-4 the games a group can play online in this build. */
export function useGroupGames() {
  return useGames().games.filter((g) => g.playModes.online);
}

/** ADDA-3 / ADDA-4 pick a game and 2 or 4 players, then `onPick`. */
export function GamePicker({ label, busy, onPick }: { label: string; busy?: boolean; onPick(gameId: string, players: GroupPlayers): void }) {
  const games = useGroupGames();
  const [gameId, setGameId] = useState(games[0]?.id ?? '');
  const [players, setPlayers] = useState<GroupPlayers>(2);
  const fixed = FIXED_SEATS[gameId];
  if (games.length === 0) return null;
  return (
    <div className="flex flex-col gap-2">
      <div role="radiogroup" aria-label={t('adda.pickGame')} className="flex flex-wrap gap-1">
        {games.map((g) => (
          <Button key={g.id} type="button" size="sm" role="radio" aria-checked={g.id === gameId}
            variant={g.id === gameId ? 'default' : 'outline'} onClick={() => setGameId(g.id)}>
            <g.Icon className="size-4" />{t(g.nameKey)}
          </Button>
        ))}
      </div>
      <div role="radiogroup" aria-label={t('adda.players')} className="flex gap-1">
        {([2, 4] as const).map((n) => (
          <Button key={n} type="button" size="sm" role="radio" aria-checked={(fixed ?? players) === n} disabled={fixed !== undefined}
            variant={(fixed ?? players) === n ? 'default' : 'outline'} onClick={() => setPlayers(n)}>
            {t('adda.playersN', { n })}
          </Button>
        ))}
      </div>
      <Button type="button" disabled={busy || gameId === ''} onClick={() => onPick(gameId, fixed ?? players)}>{label}</Button>
    </div>
  );
}

/** The last failed adda call, if any. */
export function AddaError({ error }: { error: { status: number; error: string } | null }) {
  if (!error) return null;
  return (
    <p role="alert" className="rounded-md bg-destructive/15 px-3 py-2 text-sm text-destructive">
      {error.status === 0 ? t('online.err.network') : error.error}
    </p>
  );
}
