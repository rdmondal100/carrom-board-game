import { useId, useState } from 'react';
import { Controller, useForm, useWatch, type Control } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useNavigate, useSearchParams } from 'react-router';
import { LUDO, seatsOf } from '@hub/ludo';
import { Choice, Group } from '@/components/Choice';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { SEATINGS, startLocal, type Seating } from '@/games/ludo/localLudo';
import { ludoPath } from '@/games/ludo/paths';
import { clearLudoSave, loadLudo, saveLudo } from '@/games/ludo/save';
import { configOf, defaultLudoSetup, ludoSetupSchema, NAME_MAX, PLAYER_COUNTS, type LudoSetupForm } from '@/games/ludo/schemas/ludoSetup';
import { seatColor } from '@/games/ludo/skins';
import { t, useLang } from '@/i18n/t';

const MS_PER_S = 1000;
const botName = (s: Seating) => t('setup.botName', { level: t(`setup.level.${s}`) });

/** LUDO-2 a yes/no setting drawn as a switch row. */
function Toggle({ control, name, label }: { control: Control<LudoSetupForm>; name: 'quick' | 'tapToRoll' | 'clockOn'; label: string }) {
  const id = useId();
  return (
    <div className="flex items-center justify-between gap-3">
      <label htmlFor={id}>{label}</label>
      <Controller control={control} name={name}
        render={({ field }) => <Switch id={id} checked={field.value} onCheckedChange={field.onChange} onBlur={field.onBlur} />} />
    </div>
  );
}

/** LUDO-2 / LUDO-6 same-device and vs-bot setup: rules, players, names, who plays each seat. */
export function LudoSetup() {
  useLang();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const vsBot = params.get('vs') === 'bot';
  const [saved, setSaved] = useState(loadLudo);
  const start = defaultLudoSetup(vsBot);
  const { register, handleSubmit, control, setValue, getValues, formState: { errors } } = useForm<LudoSetupForm>({
    resolver: zodResolver(ludoSetupSchema),
    defaultValues: { ...start, names: start.names.map((n, i) => (start.players[i] === 'human' ? n : botName(start.players[i]!))) },
  });
  const [preset, count, quick, tapToRoll] = useWatch({ control, name: ['preset', 'count', 'quick', 'tapToRoll'] });
  const seats = seatsOf(configOf({ preset, count, quick, tapToRoll }));

  const onSeating = (seat: number, s: Seating) => {
    const before = getValues(`players.${seat}`);
    setValue(`players.${seat}`, s);
    const name = getValues(`names.${seat}`) ?? '';
    const auto = name === t('setup.playerN', { n: seat + 1 }) || (before !== 'human' && name === botName(before));
    if (auto) setValue(`names.${seat}`, s === 'human' ? t('setup.playerN', { n: seat + 1 }) : botName(s));
  };

  const onSubmit = (v: LudoSetupForm) => {
    saveLudo(startLocal(configOf(v), v.names.map((n) => n.trim()), v.players, v.clockOn));
    navigate(ludoPath('local/play'));
  };

  return (
    <div className="mx-auto flex w-full max-w-md flex-col gap-4">
      <h2 className="text-xl font-bold">{t(vsBot ? 'setup.titleBot' : 'setup.title')}</h2>

      {saved && (
        <Card className="flex-row flex-wrap items-center gap-2 p-3">
          <span className="mr-auto text-sm">{t('ludo.savedGame')}</span>
          <Button size="sm" onClick={() => navigate(ludoPath('local/play'))}>{t('setup.resume')}</Button>
          <Button size="sm" variant="outline" onClick={() => { clearLudoSave(); setSaved(null); }}>{t('setup.discard')}</Button>
        </Card>
      )}

      <form onSubmit={handleSubmit(onSubmit)} noValidate className="flex flex-col gap-4">
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
          {count === '2v2' && <p className="text-xs opacity-70">{t('ludo.teamNote')}</p>}
        </Group>

        <Group title={t('setup.names')}>
          {seats.map((seat) => (
            <div key={seat} className="flex flex-col">
              <div className="flex items-center gap-2">
                <span className="size-3 shrink-0 rounded-full" style={{ background: seatColor(seat) }} />
                <input {...register(`names.${seat}`)} aria-label={t('setup.playerN', { n: seat + 1 })} maxLength={NAME_MAX}
                  className="min-w-0 flex-1 rounded border border-border bg-input/40 px-3 py-2 outline-none focus-visible:ring-2 focus-visible:ring-ring" />
                <Controller control={control} name={`players.${seat}`}
                  render={({ field }) => (
                    <Select value={field.value} onValueChange={(v) => onSeating(seat, v as Seating)}>
                      <SelectTrigger className="w-32" aria-label={t('setup.seatN', { n: seat + 1 })} data-testid={`seat-${seat}`}><SelectValue /></SelectTrigger>
                      <SelectContent>{SEATINGS.map((s) => <SelectItem key={s} value={s}>{t(`setup.seat.${s}`)}</SelectItem>)}</SelectContent>
                    </Select>
                  )} />
              </div>
              {errors.names?.[seat]?.message && <p className="text-sm text-red-400">{t(errors.names[seat]?.message ?? '')}</p>}
            </div>
          ))}
        </Group>

        <Toggle control={control} name="quick" label={t('ludo.quick')} />
        <Toggle control={control} name="tapToRoll" label={t('ludo.tapToRoll')} />
        <Toggle control={control} name="clockOn" label={t('ludo.clock', { s: LUDO.CLOCK_MS / MS_PER_S })} />

        <Button type="submit" size="lg">{t('setup.start')}</Button>
      </form>
    </div>
  );
}
