import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Check, Copy, Users, X } from 'lucide-react';
import { Link } from 'react-router';
import { toast } from 'sonner';
import { AddaError, PlayerRow, PresenceLine, useGroupGames } from '@/components/AddaParts';
import { Field } from '@/components/AuthForm';
import { SignInGate } from '@/components/OnlineParts';
import { Button } from '@/components/ui/button';
import { Card, CardTitle } from '@/components/ui/card';
import { t, useLang } from '@/i18n/t';
import { friendCodeSchema, type FriendCodeForm } from '@/schemas/adda';
import { answerRequest, fetchFriends, fetchRecentPlayers, removeFriend, sendFriendRequest } from '@/store/addaSlice';
import { useAppDispatch, useAppSelector } from '@/store/store';
import { blockPlayer, unblockPlayer } from '@/store/voiceSlice';

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-2">
      <h3 className="text-sm font-semibold text-muted-foreground">{title}</h3>
      <ul className="flex flex-col gap-1">{children}</ul>
    </section>
  );
}

function AddFriend() {
  const dispatch = useAppDispatch();
  const { register, handleSubmit, reset, formState: { errors, isSubmitting } } = useForm<FriendCodeForm>({
    resolver: zodResolver(friendCodeSchema), defaultValues: { code: '' },
  });
  const onSubmit = async (v: FriendCodeForm) => {
    const r = await dispatch(sendFriendRequest({ code: v.code }));
    if (sendFriendRequest.fulfilled.match(r)) {
      toast.success(t(r.payload.status === 'friends' ? 'adda.friends.nowFriends' : 'adda.friends.sent'));
      reset();
      void dispatch(fetchFriends());
    }
  };
  return (
    <form className="flex items-end gap-2" onSubmit={handleSubmit(onSubmit)} noValidate>
      <div className="flex-1">
        <Field label={t('adda.friends.addByCode')} autoCapitalize="characters" autoComplete="off" error={errors.code} {...register('code')} />
      </div>
      <Button type="submit" disabled={isSubmitting}>{t('adda.friends.add')}</Button>
    </form>
  );
}

function FriendsBody() {
  const dispatch = useAppDispatch();
  const myId = useAppSelector((s) => s.auth.user?.id);
  const { friends: data, recent, error } = useAppSelector((s) => s.adda);
  const games = useGroupGames().map((g) => g.id);
  const gameKey = games.join(',');
  useEffect(() => { void dispatch(fetchFriends()); }, [dispatch]);
  useEffect(() => {
    if (myId) void dispatch(fetchRecentPlayers({ me: myId, games: gameKey ? gameKey.split(',') : [] }));
  }, [dispatch, myId, gameKey]);

  const act = (p: Promise<unknown>) => void p.then(() => dispatch(fetchFriends()));
  if (!data) return error ? <AddaError error={error} /> : <p className="text-center text-muted-foreground">{t('auth.loading')}</p>;
  const known = new Set([...data.friends, ...data.incoming, ...data.outgoing, ...data.blocked].map((u) => u.id));
  const suggest = recent.filter((u) => !known.has(u.id));

  return (
    <div className="flex flex-col gap-4">
      <Card className="gap-2">
        <CardTitle>{t('adda.friends.myCode')}</CardTitle>
        <div className="flex items-center gap-2">
          <code className="flex-1 rounded-md bg-muted px-3 py-2 text-center text-xl font-bold tracking-widest" data-testid="my-code">{data.code}</code>
          <Button variant="outline" aria-label={t('lobby.copy')}
            onClick={() => void navigator.clipboard?.writeText(data.code).then(() => toast(t('adda.friends.codeCopied')))}>
            <Copy className="size-4" />
          </Button>
        </div>
        <p className="text-xs text-muted-foreground">{t('adda.friends.codeHint')}</p>
      </Card>
      <AddFriend />
      <AddaError error={error} />

      {data.incoming.length > 0 && (
        <Section title={t('adda.friends.incoming')}>
          {data.incoming.map((u) => (
            <PlayerRow key={u.id} name={u.name} avatar={u.avatar}>
              <Button size="icon" aria-label={t('adda.friends.accept')} onClick={() => act(dispatch(answerRequest({ userId: u.id, accept: true })))}><Check className="size-4" /></Button>
              <Button size="icon" variant="outline" aria-label={t('adda.friends.decline')} onClick={() => act(dispatch(answerRequest({ userId: u.id, accept: false })))}><X className="size-4" /></Button>
            </PlayerRow>
          ))}
        </Section>
      )}

      <Section title={t('adda.friends.title', { n: data.friends.length })}>
        {data.friends.length === 0 && <p className="text-sm text-muted-foreground">{t('adda.friends.none')}</p>}
        {data.friends.map((f) => (
          <PlayerRow key={f.id} name={f.name} avatar={f.avatar} sub={<PresenceLine presence={f.presence} />}>
            <Button size="sm" variant="ghost" onClick={() => { if (window.confirm(t('adda.friends.removeConfirm', { name: f.name }))) act(dispatch(removeFriend(f.id))); }}>{t('adda.friends.remove')}</Button>
            <Button size="sm" variant="ghost" className="text-destructive"
              onClick={() => { if (window.confirm(t('voice.blockConfirm', { name: f.name }))) act(dispatch(blockPlayer(f.id))); }}>{t('voice.block')}</Button>
          </PlayerRow>
        ))}
      </Section>

      {data.outgoing.length > 0 && (
        <Section title={t('adda.friends.outgoing')}>
          {data.outgoing.map((u) => (
            <PlayerRow key={u.id} name={u.name} avatar={u.avatar}>
              <Button size="sm" variant="ghost" onClick={() => act(dispatch(removeFriend(u.id)))}>{t('adda.friends.cancel')}</Button>
            </PlayerRow>
          ))}
        </Section>
      )}

      {suggest.length > 0 && (
        <Section title={t('adda.friends.recent')}>
          {suggest.map((u) => (
            <PlayerRow key={u.id} name={u.name} avatar={u.avatar}>
              <Button size="sm" variant="outline" onClick={() => act(dispatch(sendFriendRequest({ userId: u.id })).then((r) => {
                if (sendFriendRequest.fulfilled.match(r)) toast.success(t('adda.friends.sent'));
              }))}>{t('adda.friends.add')}</Button>
            </PlayerRow>
          ))}
        </Section>
      )}

      {data.blocked.length > 0 && (
        <Section title={t('adda.friends.blocked')}>
          {data.blocked.map((u) => (
            <PlayerRow key={u.id} name={u.name} avatar={u.avatar}>
              <Button size="sm" variant="outline" onClick={() => act(dispatch(unblockPlayer(u.id)))}>{t('adda.friends.unblock')}</Button>
            </PlayerRow>
          ))}
        </Section>
      )}
    </div>
  );
}

/** ADDA-1 `/friends`: your code, add by code or from recent games, requests, friends with status, blocked players. */
export function Friends() {
  useLang();
  return (
    <div className="mx-auto flex w-full max-w-md flex-col gap-4">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-xl font-bold">{t('adda.friends.page')}</h2>
        <Button asChild variant="outline" size="sm"><Link to="/groups"><Users className="size-4" />{t('adda.groups.page')}</Link></Button>
      </div>
      <SignInGate next="/friends"><FriendsBody /></SignInGate>
    </div>
  );
}
