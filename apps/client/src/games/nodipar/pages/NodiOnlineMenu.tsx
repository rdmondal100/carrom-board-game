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
import { nodiPath } from '@/games/nodipar/paths';
import { configOf, FORMATS, nodiRoomSchema, type NodiRoomForm } from '@/games/nodipar/schemas/nodiSetup';
import { cleanCode, joinCodeSchema, type JoinCodeForm } from '@/schemas/joinCode';
import { t, useLang } from '@/i18n/t';
import { clearRoomError, createRoom } from '@/store/roomSlice';
import { useAppDispatch, useAppSelector } from '@/store/store';

function CreateCard() {
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const connecting = useAppSelector((s) => s.room.connecting);
  const borshaId = useId();
  const { register, handleSubmit, control } = useForm<NodiRoomForm>({
    resolver: zodResolver(nodiRoomSchema),
    defaultValues: { format: '1v1', borsha: false },
  });
  const onSubmit = async (v: NodiRoomForm) => {
    const r = await dispatch(createRoom({ gameId: 'nodipar', config: configOf(v) }));
    if (createRoom.fulfilled.match(r)) navigate(nodiPath('online/lobby'));
  };
  return (
    <Card className="p-4">
      <form onSubmit={handleSubmit(onSubmit)} noValidate className="flex flex-col gap-4">
        <h3 className="font-semibold">{t('online.create')}</h3>
        <Group title={t('setup.format')}>
          <div className="flex gap-2">
            {FORMATS.map((f) => <Choice key={f} reg={register('format')} value={f} label={t(`nodi.format.${f}`)} />)}
          </div>
        </Group>
        <div className="flex flex-col gap-1">
          <div className="flex items-center justify-between gap-3">
            <label htmlFor={borshaId}>{t('nodi.borsha')}</label>
            <Controller control={control} name="borsha"
              render={({ field }) => <Switch id={borshaId} checked={field.value} onCheckedChange={field.onChange} onBlur={field.onBlur} />} />
          </div>
          <p className="text-xs opacity-70">{t('nodi.borshaNote')}</p>
        </div>
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

/** NODI-5 create a private Nodi Par room (1v1 or 2v2, Borsha) or join one by code. */
export function NodiOnlineMenu() {
  useLang();
  const dispatch = useAppDispatch();
  useEffect(() => { dispatch(clearRoomError()); }, [dispatch]);
  return (
    <div className="mx-auto flex w-full max-w-md flex-col gap-4">
      <h2 className="text-xl font-bold">{t('online.title')}</h2>
      <SignInGate next={nodiPath('online')}>
        <RoomError />
        <CreateCard />
        <JoinCard />
      </SignInGate>
    </div>
  );
}
