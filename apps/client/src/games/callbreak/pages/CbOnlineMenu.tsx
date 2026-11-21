import { useEffect, useId } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useNavigate } from 'react-router';
import { Field } from '@/components/AuthForm';
import { Choice, Group } from '@/components/Choice';
import { RoomError, SignInGate } from '@/components/OnlineParts';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { cbPath } from '@/games/callbreak/paths';
import { cbRoomSchema, configOf, ROUND_CHOICES, type CbRoomForm } from '@/games/callbreak/schemas/cbSetup';
import { cleanCode, joinCodeSchema, type JoinCodeForm } from '@/schemas/joinCode';
import { t, useLang } from '@/i18n/t';
import { clearRoomError, createRoom } from '@/store/roomSlice';
import { useAppDispatch, useAppSelector } from '@/store/store';

function CreateCard() {
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const connecting = useAppSelector((s) => s.room.connecting);
  const redealId = useId();
  const { register, handleSubmit, control } = useForm<CbRoomForm>({
    resolver: zodResolver(cbRoomSchema), defaultValues: { rounds: '5', redeal: true },
  });
  const onSubmit = async (v: CbRoomForm) => {
    const r = await dispatch(createRoom({ gameId: 'callbreak', config: configOf(v) }));
    if (createRoom.fulfilled.match(r)) navigate(cbPath('online/lobby'));
  };
  return (
    <Card className="p-4">
      <form onSubmit={handleSubmit(onSubmit)} noValidate className="flex flex-col gap-4">
        <h3 className="font-semibold">{t('online.create')}</h3>
        <Group title={t('callbreak.length')}>
          <div className="flex gap-2">
            {ROUND_CHOICES.map((r) => <Choice key={r} reg={register('rounds')} value={r} label={t('callbreak.roundsN', { n: r })} />)}
          </div>
        </Group>
        <div className="flex items-center justify-between gap-3">
          <label htmlFor={redealId}>{t('callbreak.redeal')}</label>
          <Controller control={control} name="redeal"
            render={({ field }) => <Switch id={redealId} checked={field.value} onCheckedChange={field.onChange} onBlur={field.onBlur} />} />
        </div>
        <p className="text-xs opacity-70">{t('callbreak.botsNote')}</p>
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

/** CB-8 create a private Callbreak room (length, redeal) or join one by code. */
export function CbOnlineMenu() {
  useLang();
  const dispatch = useAppDispatch();
  useEffect(() => { dispatch(clearRoomError()); }, [dispatch]);
  return (
    <div className="mx-auto flex w-full max-w-md flex-col gap-4">
      <h2 className="text-xl font-bold">{t('online.title')}</h2>
      <SignInGate next={cbPath('online')}>
        <RoomError />
        <CreateCard />
        <JoinCard />
      </SignInGate>
    </div>
  );
}
