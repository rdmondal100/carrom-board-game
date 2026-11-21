import { useEffect, useId } from 'react';
import { Controller, useForm, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useNavigate } from 'react-router';
import { Field } from '@/components/AuthForm';
import { Choice, Group } from '@/components/Choice';
import { RoomError, SignInGate } from '@/components/OnlineParts';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { ludoPath } from '@/games/ludo/paths';
import { configOf, ludoRoomSchema, PLAYER_COUNTS, type LudoRoomForm } from '@/games/ludo/schemas/ludoSetup';
import { cleanCode, joinCodeSchema, type JoinCodeForm } from '@/schemas/joinCode';
import { t, useLang } from '@/i18n/t';
import { clearRoomError, createRoom } from '@/store/roomSlice';
import { useAppDispatch, useAppSelector } from '@/store/store';

function CreateCard() {
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const connecting = useAppSelector((s) => s.room.connecting);
  const quickId = useId();
  const tapId = useId();
  const { register, handleSubmit, control } = useForm<LudoRoomForm>({
    resolver: zodResolver(ludoRoomSchema),
    defaultValues: { preset: 'bd', count: '4', quick: false, tapToRoll: false },
  });
  const preset = useWatch({ control, name: 'preset' });
  const onSubmit = async (v: LudoRoomForm) => {
    const r = await dispatch(createRoom({ gameId: 'ludo', config: configOf(v) }));
    if (createRoom.fulfilled.match(r)) navigate(ludoPath('online/lobby'));
  };
  return (
    <Card className="p-4">
      <form onSubmit={handleSubmit(onSubmit)} noValidate className="flex flex-col gap-4">
        <h3 className="font-semibold">{t('online.create')}</h3>
        <Group title={t('ludo.rules')}>
          <div className="flex gap-2">
            {(['bd', 'classic'] as const).map((p) => <Choice key={p} reg={register('preset')} value={p} label={t(`ludo.preset.${p}`)} />)}
          </div>
          <p className="text-xs opacity-70">{t(`ludo.preset.${preset}.note`)}</p>
        </Group>
        <Group title={t('setup.format')}>
          <div className="flex gap-2">
            {PLAYER_COUNTS.map((c) => <Choice key={c} reg={register('count')} value={c} label={t(`ludo.count.${c}`)} />)}
          </div>
        </Group>
        {([['quick', quickId, 'ludo.quick'], ['tapToRoll', tapId, 'ludo.tapToRoll']] as const).map(([name, id, key]) => (
          <div key={name} className="flex items-center justify-between gap-3">
            <label htmlFor={id}>{t(key)}</label>
            <Controller control={control} name={name}
              render={({ field }) => <Switch id={id} checked={field.value} onCheckedChange={field.onChange} onBlur={field.onBlur} />} />
          </div>
        ))}
        <Button type="submit" size="lg" disabled={connecting}>{connecting ? t('online.connecting') : t('online.createBtn')}</Button>
      </form>
    </Card>
  );
}

function JoinCard() {
  const navigate = useNavigate();
  const { register, handleSubmit, formState: { errors } } = useForm<JoinCodeForm>({
    resolver: zodResolver(joinCodeSchema), defaultValues: { code: '' },
  });
  return (
    <Card className="p-4">
      <form onSubmit={handleSubmit((v) => navigate(`/join/${cleanCode(v.code)}`))} noValidate className="flex flex-col gap-3">
        <h3 className="font-semibold">{t('online.join')}</h3>
        <Field label={t('online.code')} error={errors.code} autoComplete="off" autoCapitalize="characters" spellCheck={false}
          maxLength={12} className="uppercase tracking-widest" {...register('code')} />
        <Button type="submit" variant="secondary">{t('online.joinBtn')}</Button>
      </form>
    </Card>
  );
}

/** LUDO-7 create a private Ludo room (rules, players, options) or join one by code. */
export function LudoOnlineMenu() {
  useLang();
  const dispatch = useAppDispatch();
  useEffect(() => { dispatch(clearRoomError()); }, [dispatch]);
  return (
    <div className="mx-auto flex w-full max-w-md flex-col gap-4">
      <h2 className="text-xl font-bold">{t('online.title')}</h2>
      <SignInGate next={ludoPath('online')}>
        <RoomError />
        <CreateCard />
        <JoinCard />
      </SignInGate>
    </div>
  );
}
