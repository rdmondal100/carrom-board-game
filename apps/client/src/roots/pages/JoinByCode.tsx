import { useEffect, useRef } from 'react';
import { Link, Navigate, useNavigate, useParams } from 'react-router';
import { RoomError, SignInGate } from '@/components/OnlineParts';
import { Button } from '@/components/ui/button';
import { useGames } from '@/games/GamesContext';
import { gamePath } from '@/games/types';
import { t, useLang } from '@/i18n/t';
import { cleanCode } from '@/schemas/joinCode';
import { joinByCode } from '@/store/roomSlice';
import { useAppDispatch, useAppSelector } from '@/store/store';

function Joining({ code }: { code: string }) {
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const { lobby, error } = useAppSelector((s) => s.room);
  const started = useRef(false);
  const { single } = useGames();
  const already = lobby?.code === code;
  // HAPP-2 the room says which game it plays.
  const lobbyPath = (gameId: string | undefined) => gamePath(gameId ?? 'carrom', 'online/lobby');

  useEffect(() => {
    if (started.current || already) return;
    started.current = true;
    void dispatch(joinByCode(code)).then((r) => {
      if (joinByCode.fulfilled.match(r)) navigate(lobbyPath(r.payload.lobby?.gameId), { replace: true });
    });
  }, [dispatch, navigate, code, already]);

  if (already) return <Navigate to={lobbyPath(lobby.gameId)} replace />;
  return (
    <div className="flex flex-col items-center gap-3 text-center">
      {error ? <RoomError /> : <p className="text-muted-foreground">{t('online.joining', { code })}</p>}
      {error && <Button asChild variant="outline"><Link to={single ? gamePath(single.id, 'online') : '/'}>{t('online.back')}</Link></Button>}
    </div>
  );
}

/** ROOM-1 / HAPP-2: `/join/:code` — the invite link (the room knows its game). Sign in (or play as guest) first, then join. */
export function JoinByCode() {
  useLang();
  const code = cleanCode(useParams().code ?? '');
  return (
    <div className="mx-auto flex w-full max-w-md flex-col gap-4">
      <h2 className="text-xl font-bold">{t('lobby.title', { code })}</h2>
      <SignInGate next={`/join/${code}`}>
        <Joining code={code} />
      </SignInGate>
    </div>
  );
}
