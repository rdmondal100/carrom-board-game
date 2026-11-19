import { useEffect, useRef, type ReactNode } from 'react';
import { Link, useNavigate } from 'react-router';
import type { LobbyView } from '@carrom/protocol';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { t } from '@/i18n/t';
import { resumeRoom, roomErrorKey } from '@/store/roomSlice';
import { useAppDispatch, useAppSelector } from '@/store/store';

/**
 * ROOM-8: the room this tab is in. After a reload it rejoins with the saved
 * reconnection token; with no room to go back to it goes to the online menu.
 */
export function useOnlineRoom(): { lobby: LobbyView | null; sessionId: string | null } {
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const { lobby, sessionId, connecting } = useAppSelector((s) => s.room);
  const tried = useRef(false);
  useEffect(() => {
    if (lobby || connecting) return;
    if (tried.current) {
      navigate('/online', { replace: true });
      return;
    }
    tried.current = true;
    void dispatch(resumeRoom());
  }, [dispatch, navigate, lobby, connecting]);
  return { lobby, sessionId };
}

/** The last failed create/join, translated when we know it. */
export function RoomError() {
  const err = useAppSelector((s) => s.room.error);
  if (!err) return null;
  const key = roomErrorKey(err);
  return <p role="alert" className="rounded-md bg-destructive/15 px-3 py-2 text-sm text-destructive">{key ? t(key) : err.error}</p>;
}

/** ROOM-2: online play needs an account (a guest is fine). Sends the player back to `next` after. */
export function SignInGate({ next, children }: { next: string; children: ReactNode }) {
  const { user, checked } = useAppSelector((s) => s.auth);
  if (!checked) return <p className="text-center text-muted-foreground">{t('auth.loading')}</p>;
  if (user) return children;
  return (
    <Card className="mx-auto flex w-full max-w-sm flex-col items-center gap-3 p-6 text-center">
      <p>{t('online.signInFirst')}</p>
      <Button asChild>
        <Link to={`/login?next=${encodeURIComponent(next)}`}>{t('online.signIn')}</Link>
      </Button>
    </Card>
  );
}
