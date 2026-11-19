import { useEffect } from 'react';
import { useForm, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useNavigate } from 'react-router';
import { Field } from '@/components/AuthForm';
import { Choice, Group } from '@/components/Choice';
import { RoomError, SignInGate } from '@/components/OnlineParts';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { t, useLang } from '@/i18n/t';
import { LENGTHS } from '@/schemas/localSetup';
import {
  cleanCode, createRoomSchema, joinCodeSchema, toRoomOptions, type CreateRoomForm, type JoinCodeForm,
} from '@/schemas/onlineRoom';
import { clearRoomError, createRoom } from '@/store/roomSlice';
import { useAppDispatch, useAppSelector } from '@/store/store';

function CreateCard() {
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const connecting = useAppSelector((s) => s.room.connecting);
  const { register, handleSubmit, control, setValue, formState: { errors } } = useForm<CreateRoomForm>({
    resolver: zodResolver(createRoomSchema),
    defaultValues: { format: '1v1', preset: 'colour', length: 'board' },
  });
  const [preset, length] = useWatch({ control, name: ['preset', 'length'] });
  const presetReg = register('preset', {
    onChange: (e: { target: { value: CreateRoomForm['preset'] } }) => {
      if (!(LENGTHS[e.target.value] as readonly string[]).includes(length)) setValue('length', 'board');
    },
  });
  const onSubmit = async (v: CreateRoomForm) => {
    const r = await dispatch(createRoom(toRoomOptions(v)));
    if (createRoom.fulfilled.match(r)) navigate('/online/lobby');
  };

  return (
    <Card className="p-4">
      <form onSubmit={handleSubmit(onSubmit)} noValidate className="flex flex-col gap-4">
        <h3 className="font-semibold">{t('online.create')}</h3>
        <Group title={t('setup.format')}>
          <div className="flex gap-2">
            {(['1v1', '2v2'] as const).map((f) => <Choice key={f} reg={register('format')} value={f} label={t(`setup.format.${f}`)} />)}
          </div>
        </Group>
        <Group title={t('setup.preset')}>
          <div className="flex gap-2">
            {(['colour', 'point'] as const).map((p) => <Choice key={p} reg={presetReg} value={p} label={t(`setup.preset.${p}`)} />)}
          </div>
        </Group>
        <Group title={t('setup.length')}>
          <div className="flex gap-2">
            {LENGTHS[preset].map((l) => <Choice key={l} reg={register('length')} value={l} label={t(`setup.length.${l}`)} />)}
          </div>
          {errors.length?.message && <p className="text-sm text-red-400">{t(errors.length.message)}</p>}
        </Group>
        <Button type="submit" size="lg" disabled={connecting}>
          {connecting ? t('online.connecting') : t('online.createBtn')}
        </Button>
      </form>
    </Card>
  );
}

function JoinCard() {
  const navigate = useNavigate();
  const { register, handleSubmit, formState: { errors } } = useForm<JoinCodeForm>({
    resolver: zodResolver(joinCodeSchema),
    defaultValues: { code: '' },
  });
  return (
    <Card className="p-4">
      <form onSubmit={handleSubmit((v) => navigate(`/join/${cleanCode(v.code)}`))} noValidate className="flex flex-col gap-3">
        <h3 className="font-semibold">{t('online.join')}</h3>
        <Field
          label={t('online.code')} error={errors.code} autoComplete="off" autoCapitalize="characters"
          spellCheck={false} maxLength={12} className="uppercase tracking-widest" {...register('code')}
        />
        <Button type="submit" variant="secondary">{t('online.joinBtn')}</Button>
      </form>
    </Card>
  );
}

/** ROOM-11: create a room (format, preset, length) or join one by code. */
export function OnlineMenu() {
  useLang();
  const dispatch = useAppDispatch();
  useEffect(() => { dispatch(clearRoomError()); }, [dispatch]);
  return (
    <div className="mx-auto flex w-full max-w-md flex-col gap-4">
      <h2 className="text-xl font-bold">{t('online.title')}</h2>
      <SignInGate next="/online">
        <RoomError />
        <CreateCard />
        <JoinCard />
      </SignInGate>
    </div>
  );
}
