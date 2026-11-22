import { useEffect, useRef } from 'react';
import { useLocation, useNavigate, type NavigateFunction } from 'react-router';
import { toast } from 'sonner';
import { PRESENCE_BEAT_MS, type Notice } from '@carrom/protocol';
import { GamePicker } from '@/components/AddaParts';
import { Card } from '@/components/ui/card';
import { gameIn, useGames } from '@/games/GamesContext';
import { gamePath, type ClientGame } from '@/games/types';
import { t } from '@/i18n/t';
import { presenceGame } from '@/lib/adda';
import { onServerMessage, sendToRoom } from '@/lib/colyseus';
import { beatPresence, fetchFriends } from '@/store/addaSlice';
import { moveToRoom } from '@/store/roomSlice';
import { useAppDispatch, useAppSelector, type AppDispatch } from '@/store/store';

/** ADDA-6 an in-app notice as a toast (friend requests open Friends; a group room offers to join). */
export function showNotice(n: Notice, games: readonly ClientGame[], navigate: NavigateFunction, dispatch: AppDispatch): void {
  if (n.kind === 'friendRequest') {
    void dispatch(fetchFriends());
    toast(t('adda.notice.friendRequest', { name: n.from.name }), { action: { label: t('adda.view'), onClick: () => void navigate('/friends') } });
  } else if (n.kind === 'friendAccepted') {
    void dispatch(fetchFriends());
    toast(t('adda.notice.friendAccepted', { name: n.from.name }));
  } else {
    const game = gameIn(games, n.gameId);
    const text = t('adda.notice.groupRoom', { name: n.from.name, group: n.groupName, game: game ? t(game.nameKey) : n.gameId });
    toast(text, {
      duration: 20_000,
      ...(game && n.code ? { action: { label: t('adda.join'), onClick: () => void navigate(`/join/${n.code}`) } } : {}),
    });
  }
}

/**
 * ADDA-1 / ADDA-4 / ADDA-6, mounted once in RootLayout: tells the server where
 * this player is (menus or a game) every PRESENCE_BEAT_MS, shows the notices it
 * answers with, and follows the group to its next room.
 */
export function AddaController() {
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const { games } = useGames();
  const userId = useAppSelector((s) => s.auth.user?.id);
  const game = presenceGame(useLocation().pathname);
  const latest = useRef({ game, games, navigate });
  useEffect(() => { latest.current = { game, games, navigate }; });

  useEffect(() => {
    if (!userId) return;
    let live = true;
    const beat = () => {
      if (document.visibilityState === 'hidden') return;
      void dispatch(beatPresence(latest.current.game)).unwrap()
        .then((r) => { if (live) r.notices.forEach((n) => showNotice(n, latest.current.games, latest.current.navigate, dispatch)); })
        .catch(() => {});
    };
    beat();
    const timer = setInterval(beat, PRESENCE_BEAT_MS);
    document.addEventListener('visibilitychange', beat);
    return () => {
      live = false;
      clearInterval(timer);
      document.removeEventListener('visibilitychange', beat);
    };
  }, [dispatch, userId, game]);

  // ADDA-4 the group moved on: leave this room and join the next one.
  useEffect(() => onServerMessage((m) => {
    if (m.type !== 'nextRoom') return;
    if (!gameIn(latest.current.games, m.gameId)) {
      toast(t('adda.next.notHere'));
      return;
    }
    void dispatch(moveToRoom(m.roomId)).then((r) => {
      if (moveToRoom.fulfilled.match(r)) void latest.current.navigate(gamePath(m.gameId, 'online/lobby'), { replace: true });
      else toast(t('online.err.closed'));
    });
  }), [dispatch]);
  return null;
}

/** ADDA-4 after a group room's game: any member picks the next game for everyone. */
export function NextGameBar() {
  const lobby = useAppSelector((s) => s.room.lobby);
  const connecting = useAppSelector((s) => s.room.connecting);
  if (!lobby?.groupId || lobby.phase !== 'ended') return null;
  return (
    <Card data-testid="next-game" className="fixed inset-x-3 bottom-[max(0.75rem,var(--inset-bottom))] z-40 mx-auto max-w-md gap-2 p-3 shadow-lg">
      <p className="text-sm font-semibold">{t('adda.next.title')}</p>
      <GamePicker label={t('adda.next.go')} busy={connecting}
        onPick={(gameId, players) => sendToRoom({ type: 'nextGame', gameId, players })} />
    </Card>
  );
}
