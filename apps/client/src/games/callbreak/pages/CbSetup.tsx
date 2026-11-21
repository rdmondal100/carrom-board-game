import { useId, useState } from 'react';
import { Controller, useForm, type Control } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useNavigate } from 'react-router';
import { CB } from '@hub/callbreak';
import { Choice, Group } from '@/components/Choice';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { BOT_LEVELS, startLocal } from '@/games/callbreak/localCallbreak';
import { cbPath } from '@/games/callbreak/paths';
import { clearCallbreakSave, loadCallbreak, saveCallbreak } from '@/games/callbreak/save';
import { cbSetupSchema, configOf, defaultCbSetup, NAME_MAX, ROUND_CHOICES, type CbSetupForm } from '@/games/callbreak/schemas/cbSetup';
import { t, useLang } from '@/i18n/t';
import { useAppSelector } from '@/store/store';

const MS_PER_S = 1000;
const BOT_SEATS = [1, 2, 3] as const;

function Toggle({ control, name, label }: { control: Control<CbSetupForm>; name: 'redeal' | 'clockOn'; label: string }) {
  const id = useId();
  return (
    <div className="flex items-center justify-between gap-3">
      <label htmlFor={id}>{label}</label>
      <Controller control={control} name={name}
        render={({ field }) => <Switch id={id} checked={field.value} onCheckedChange={field.onChange} onBlur={field.onBlur} />} />
    </div>
  );
}

/** CB-7 you against three bots: game length, redeal, each bot's level, the turn clock. */
export function CbSetup() {
  useLang();
  const navigate = useNavigate();
  const userName = useAppSelector((s) => s.auth.user?.name);
  const [saved, setSaved] = useState(loadCallbreak);
  const { register, handleSubmit, control, formState: { errors } } = useForm<CbSetupForm>({
    resolver: zodResolver(cbSetupSchema),
    defaultValues: defaultCbSetup((userName ?? t('callbreak.you')).slice(0, NAME_MAX)),
  });

  const onSubmit = (v: CbSetupForm) => {
    const names = [v.name.trim(), ...BOT_SEATS.map((s, i) => t('callbreak.botName', { n: s, level: t(`setup.level.${v.levels[i]!}`) }))];
    saveCallbreak(startLocal(configOf(v), names, ['medium', ...v.levels], v.clockOn));
    navigate(cbPath('local/play'));
  };

  return (
    <div className="mx-auto flex w-full max-w-md flex-col gap-4">
      <h2 className="text-xl font-bold">{t('setup.titleBot')}</h2>
      {saved && (
        <Card className="flex-row flex-wrap items-center gap-2 p-3">
          <span className="mr-auto text-sm">{t('callbreak.savedGame')}</span>
          <Button size="sm" onClick={() => navigate(cbPath('local/play'))}>{t('setup.resume')}</Button>
          <Button size="sm" variant="outline" onClick={() => { clearCallbreakSave(); setSaved(null); }}>{t('setup.discard')}</Button>
        </Card>
      )}
      <form onSubmit={handleSubmit(onSubmit)} noValidate className="flex flex-col gap-4">
        <Group title={t('callbreak.length')}>
          <div className="flex gap-2">
            {ROUND_CHOICES.map((r) => <Choice key={r} reg={register('rounds')} value={r} label={t('callbreak.roundsN', { n: r })} />)}
          </div>
        </Group>
        <Group title={t('callbreak.yourName')}>
          <input {...register('name')} aria-label={t('callbreak.yourName')} maxLength={NAME_MAX}
            className="rounded border border-border bg-input/40 px-3 py-2 outline-none focus-visible:ring-2 focus-visible:ring-ring" />
          {errors.name?.message && <p className="text-sm text-red-400">{t(errors.name.message)}</p>}
        </Group>
        <Group title={t('callbreak.bots')}>
          {BOT_SEATS.map((seat, i) => (
            <div key={seat} className="flex items-center justify-between gap-2">
              <span>{t('callbreak.botN', { n: seat })}</span>
              <Controller control={control} name={`levels.${i}`}
                render={({ field }) => (
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger className="w-32" aria-label={t('callbreak.botN', { n: seat })} data-testid={`bot-${seat}`}><SelectValue /></SelectTrigger>
                    <SelectContent>{BOT_LEVELS.map((l) => <SelectItem key={l} value={l}>{t(`setup.level.${l}`)}</SelectItem>)}</SelectContent>
                  </Select>
                )} />
            </div>
          ))}
        </Group>
        <Toggle control={control} name="redeal" label={t('callbreak.redeal')} />
        <Toggle control={control} name="clockOn" label={t('callbreak.clock', { s: CB.CLOCK_MS / MS_PER_S })} />
        <Button type="submit" size="lg">{t('setup.start')}</Button>
      </form>
    </div>
  );
}
