import { useEffect, useRef } from 'react';
import { Link, useNavigate } from 'react-router';
import { Loader2, Trophy } from 'lucide-react';
import type { QueueMessage } from '@carrom/protocol';
import { SignInGate } from '@/components/OnlineParts';
import { Button } from '@/components/ui/button';
import { useGame } from '@/games/GamesContext';
import { gamePath, modePath } from '@/games/types';
import { Card, CardTitle } from '@/components/ui/card';
import { t, useLang } from '@/i18n/t';
import { joinQueue, leaveQueue } from '@/lib/colyseus';
import {
  dismissBotOffer, formatWait, queueFailed, queueJoining, queueLeft, queueMessage,
} from '@/store/rankedSlice';
import { ratingIn } from '@/store/authSlice';
import { joinRanked, roomFailure } from '@/store/roomSlice';
import { useAppDispatch, useAppSelector } from '@/store/store';

/** RANK-8 / HAPP-2: queue for one game's ranked: timer, rating window, cancel, bot offer (RANK-3). */
export function Queue() {
  useLang();
  const game = useGame();
  return (
    <SignInGate next={gamePath(game.id, 'ranked')}>
      <QueuePanel />
    </SignInGate>
  );
}

function QueuePanel() {
  const game = useGame();
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const user = useAppSelector((s) => s.auth.user);
  const q = useAppSelector((s) => s.ranked.queue);
  /** Matched: keep the queue room's leave from resetting the page state. */
  const matched = useRef(false);

  // Leaving the page (cancel, back button) leaves the queue, unless we are going to the game.
  useEffect(() => () => {
    if (!matched.current) {
      void leaveQueue();
      dispatch(queueLeft());
    }
  }, [dispatch]);

  const onMessage = (m: QueueMessage) => {
    dispatch(queueMessage(m));
    if (m.type !== 'matched') return;
    matched.current = true;
    void (async () => {
      await leaveQueue();
      const r = await dispatch(joinRanked(m.reservation));
      dispatch(queueLeft());
      if (joinRanked.fulfilled.match(r)) navigate(gamePath(game.id, 'online/game'));
      else {
        matched.current = false;
        dispatch(queueFailed(r.payload ?? { status: 0, error: '' }));
      }
    })();
  };

  const start = async () => {
    matched.current = false;
    dispatch(queueJoining());
    try {
      await joinQueue(onMessage, () => { if (!matched.current) dispatch(queueLeft()); }, game.id);
    } catch (err) {
      dispatch(queueFailed(roomFailure(err)));
    }
  };

  const cancel = async () => {
    await leaveQueue();
    dispatch(queueLeft());
  };

  const playBot = async () => {
    await leaveQueue();
    dispatch(queueLeft());
    navigate(modePath(game.id, 'bot'));
  };

  const searching = q.status === 'joining' || q.status === 'queued';
  const errorText = q.error ? (q.error.status === 409 ? t('ranked.already') : q.error.error || t('online.err.network')) : null;

  return (
    <div className="mx-auto flex w-full max-w-md flex-col gap-4">
      <h2 className="flex items-center gap-2 text-xl font-bold"><Trophy className="size-5 text-amber-400" />{t(game.nameKey)} · {t('ranked.title')}</h2>
      <p className="text-sm text-muted-foreground">{t(`games.${game.id}.rankedRules`)}</p>
      {user && <p className="text-lg">{t('ranked.yourRating', { rating: ratingIn(user, game.id).rating })}</p>}
      {user?.isGuest && (
        <p className="rounded-md bg-muted px-3 py-2 text-sm">
          {t('ranked.guestHint')} <Link className="underline" to="/profile">{t('nav.profile')}</Link>
        </p>
      )}

      {errorText && <p role="alert" className="rounded-md bg-destructive/15 px-3 py-2 text-sm text-destructive">{errorText}</p>}

      {searching || q.status === 'matched' ? (
        <Card className="items-center gap-2 p-6 text-center" data-testid="queue-card">
          <Loader2 className="size-8 animate-spin text-amber-400" />
          <p className="font-medium">{q.status === 'matched' ? t('ranked.matched') : t('ranked.searching')}</p>
          {q.status === 'queued' && (
            <>
              <p className="text-2xl tabular-nums" data-testid="queue-timer">{t('ranked.waited', { time: formatWait(q.waitedMs) })}</p>
              <p className="text-sm text-muted-foreground">{t('ranked.window', { rating: q.rating, window: q.window })}</p>
            </>
          )}
          {q.status !== 'matched' && <Button variant="outline" onClick={() => void cancel()}>{t('ranked.cancel')}</Button>}
        </Card>
      ) : (
        <Button size="lg" onClick={() => void start()}>{t('ranked.find')}</Button>
      )}

      {q.botOffer && q.status === 'queued' && (
        <Card className="gap-2 p-4" role="dialog" aria-label={t('ranked.botOfferTitle')}>
          <CardTitle>{t('ranked.botOfferTitle')}</CardTitle>
          <p className="text-sm text-muted-foreground">{t('ranked.botOffer')}</p>
          <div className="flex gap-2">
            <Button className="flex-1" onClick={() => void playBot()}>{t('ranked.playBot')}</Button>
            <Button className="flex-1" variant="outline" onClick={() => dispatch(dismissBotOffer())}>
              {t('ranked.keepWaiting')}
            </Button>
          </div>
        </Card>
      )}

      <Button asChild variant="ghost"><Link to={gamePath(game.id, 'leaderboard')}>{t('play.leaderboard')}</Link></Button>
    </div>
  );
}
