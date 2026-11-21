import { useEffect, useState } from 'react';
import { Controller, useForm, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Link, Navigate } from 'react-router';
import { toast } from 'sonner';
import type { PublicUser } from '@carrom/protocol';
import { AuthError, Field } from '@/components/AuthForm';
import { Avatar, AVATAR_COLOURS } from '@/components/Avatar';
import { GoogleButton } from '@/components/GoogleButton';
import { MatchHistory } from '@/components/MatchHistory';
import { Button } from '@/components/ui/button';
import { Card, CardTitle } from '@/components/ui/card';
import { useGames } from '@/games/GamesContext';
import { t, useLang } from '@/i18n/t';
import { getToken } from '@/lib/auth';
import { cn } from '@/lib/utils';
import { profileSchema, type ProfileForm } from '@/schemas/auth';
import { clearAuthError, loadMe, logout, ratingIn, updateMe } from '@/store/authSlice';
import { useAppDispatch, useAppSelector } from '@/store/store';

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="flex flex-1 flex-col items-center rounded-lg bg-muted px-3 py-2">
      <span className="text-xl font-bold">{value}</span>
      <span className="text-xs text-muted-foreground">{label}</span>
    </div>
  );
}

/** HAPP-6 each game's rating, ranked games and recent matches (one game at a time). */
function GameStats({ user }: { user: PublicUser }) {
  const { games } = useGames();
  const online = games.filter((g) => g.playModes.online || g.playModes.ranked);
  const [picked, setPicked] = useState(online[0]?.id);
  const game = online.find((g) => g.id === picked) ?? online[0];
  if (!game) return null;
  const r = ratingIn(user, game.id);
  return (
    <section className="flex flex-col gap-3" data-testid="game-stats">
      {online.length > 1 && (
        <div role="tablist" aria-label={t('profile.games')} className="flex gap-1 overflow-x-auto">
          {online.map((g) => (
            <Button key={g.id} role="tab" aria-selected={g.id === game.id} size="sm"
              variant={g.id === game.id ? 'default' : 'outline'} onClick={() => setPicked(g.id)}>
              <g.Icon className="size-4" />{t(g.nameKey)}
            </Button>
          ))}
        </div>
      )}
      <div className="flex gap-3">
        <Stat label={t('profile.ratingIn', { game: t(game.nameKey) })} value={r.rating} />
        <Stat label={t('profile.rankedGames')} value={r.games} />
      </div>
      <MatchHistory userId={user.id} game={game.id} />
    </section>
  );
}

function ProfileEditor({ user }: { user: PublicUser }) {
  const dispatch = useAppDispatch();
  const loading = useAppSelector((s) => s.auth.loading);
  const { register, handleSubmit, control, reset, formState: { errors, isDirty } } = useForm<ProfileForm>({
    resolver: zodResolver(profileSchema),
    defaultValues: { name: user.name, avatar: user.avatar },
  });
  const name = useWatch({ control, name: 'name' });

  const onSubmit = async (v: ProfileForm) => {
    const r = await dispatch(updateMe({ name: v.name, avatar: v.avatar }));
    if (updateMe.fulfilled.match(r)) {
      reset({ name: r.payload.name, avatar: r.payload.avatar });
      toast.success(t('profile.saved'));
    }
  };

  return (
    <form className="flex flex-col gap-3" onSubmit={handleSubmit(onSubmit)} noValidate>
      <Field label={t('auth.name')} autoComplete="nickname" error={errors.name} {...register('name')} />
      <Controller
        control={control}
        name="avatar"
        render={({ field }) => (
          <fieldset className="flex flex-col gap-1">
            <legend className="mb-1 text-sm font-semibold">{t('profile.avatar')}</legend>
            <div className="grid grid-cols-6 gap-2" role="radiogroup" aria-label={t('profile.avatar')}>
              {AVATAR_COLOURS.map((_, i) => (
                <button
                  key={i}
                  type="button"
                  role="radio"
                  aria-checked={field.value === i}
                  aria-label={t('profile.avatarN', { n: i + 1 })}
                  onClick={() => field.onChange(i)}
                  className={cn('justify-self-center rounded-full outline-none focus-visible:ring-2 focus-visible:ring-ring',
                    field.value === i && 'ring-2 ring-primary ring-offset-2 ring-offset-background')}
                >
                  <Avatar index={i} name={name || user.name} />
                </button>
              ))}
            </div>
          </fieldset>
        )}
      />
      <AuthError actions={['updateMe']} />
      <Button type="submit" disabled={loading || !isDirty}>{t('profile.save')}</Button>
    </form>
  );
}

/** AUTH-9 / HAPP-6: name + avatar, coins, each game's rating and matches, keep a guest's progress, sign out. */
export function Profile() {
  useLang();
  const dispatch = useAppDispatch();
  const { user, checked, loading } = useAppSelector((s) => s.auth);
  useEffect(() => { if (user) dispatch(clearAuthError()); }, [dispatch, user]);

  if (!checked) return <p className="text-center text-muted-foreground">{t('auth.loading')}</p>;
  // Signed in but the server could not be reached: retry, don't drop the account.
  if (!user && getToken() !== null) {
    return (
      <div className="mx-auto flex w-full max-w-sm flex-col gap-3">
        <AuthError actions={['loadMe']} />
        <Button onClick={() => void dispatch(loadMe())} disabled={loading}>{t('profile.retry')}</Button>
      </div>
    );
  }
  if (!user) return <Navigate to="/login" replace />;

  return (
    <div className="mx-auto flex w-full max-w-md flex-col gap-4">
      <div className="flex items-center gap-4">
        <Avatar index={user.avatar} name={user.name} size="lg" />
        <div className="min-w-0">
          <h2 className="truncate text-xl font-bold">{user.name}</h2>
          <p className="truncate text-sm text-muted-foreground">
            {user.isGuest ? t('profile.guest') : (user.email ?? t('profile.google'))}
          </p>
        </div>
      </div>
      <div className="flex gap-3">
        <Stat label={t('profile.coins')} value={user.coins} />
      </div>

      {user.isGuest && (
        <Card>
          <CardTitle>{t('profile.keepTitle')}</CardTitle>
          <p className="text-sm text-muted-foreground">{t('profile.keepHint')}</p>
          <Button asChild><Link to="/register">{t('profile.keepEmail')}</Link></Button>
          <GoogleButton />
          <AuthError actions={['google']} />
        </Card>
      )}

      <GameStats user={user} />

      <Card><ProfileEditor key={user.id} user={user} /></Card>

      <Button variant="outline" onClick={() => void dispatch(logout())}>{t('profile.logout')}</Button>
      {user.isGuest && <p className="text-center text-xs text-muted-foreground">{t('profile.logoutGuest')}</p>}
    </div>
  );
}
