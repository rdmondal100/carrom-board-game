import { useId, useState } from 'react';
import { Controller, useForm, useWatch, type Control } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useNavigate, useSearchParams } from 'react-router';
import { NODI_RULES, seatsOf, teamOf } from '@hub/nodipar';
import { Choice, Group } from '@/components/Choice';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { SEATINGS, startLocal, type Seating } from '@/games/nodipar/localNodi';
import { nodiPath } from '@/games/nodipar/paths';
import { clearNodiSave, loadNodi, saveNodi } from '@/games/nodipar/save';
import { configOf, defaultNodiSetup, FORMATS, NAME_MAX, nodiSetupSchema, type NodiSetupForm } from '@/games/nodipar/schemas/nodiSetup';
import { seatColor } from '@/games/nodipar/skins';
import { t, useLang } from '@/i18n/t';

const MS_PER_S = 1000;
const botName = (s: Seating) => t('setup.botName', { level: t(`setup.level.${s}`) });

function Toggle({ control, name, label, note }: { control: Control<NodiSetupForm>; name: 'borsha' | 'clockOn'; label: string; note?: string }) {
  const id = useId();
  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center justify-between gap-3">
        <label htmlFor={id}>{label}</label>
        <Controller control={control} name={name}
          render={({ field }) => <Switch id={id} checked={field.value} onCheckedChange={field.onChange} onBlur={field.onBlur} />} />
      </div>
      {note && <p className="text-xs opacity-70">{note}</p>}
    </div>
  );
}

/** NODI-5 same-device and vs-bot setup: 1v1 or 2v2, Borsha, names, who plays each seat. */
export function NodiSetup() {
  useLang();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const vsBot = params.get('vs') === 'bot';
  const [saved, setSaved] = useState(loadNodi);
  const start = defaultNodiSetup(vsBot);
  const { register, handleSubmit, control, setValue, getValues, formState: { errors } } = useForm<NodiSetupForm>({
    resolver: zodResolver(nodiSetupSchema),
    defaultValues: { ...start, names: start.names.map((n, i) => (start.players[i] === 'human' ? n : botName(start.players[i]!))) },
  });
  const [format, borsha] = useWatch({ control, name: ['format', 'borsha'] });
  const config = configOf({ format, borsha });
  const seats = seatsOf(config);

  const onSeating = (seat: number, s: Seating) => {
    const before = getValues(`players.${seat}`);
    setValue(`players.${seat}`, s);
    const name = getValues(`names.${seat}`) ?? '';
    const auto = name === t('setup.playerN', { n: seat + 1 }) || (before !== 'human' && name === botName(before));
    if (auto) setValue(`names.${seat}`, s === 'human' ? t('setup.playerN', { n: seat + 1 }) : botName(s));
  };

  const onSubmit = (v: NodiSetupForm) => {
    saveNodi(startLocal(configOf(v), v.names.map((n) => n.trim()), v.players, v.clockOn));
    navigate(nodiPath('local/play'));
  };

  return (
    <div className="mx-auto flex w-full max-w-md flex-col gap-4">
      <h2 className="text-xl font-bold">{t(vsBot ? 'setup.titleBot' : 'setup.title')}</h2>

      {saved && (
        <Card className="flex-row flex-wrap items-center gap-2 p-3">
          <span className="mr-auto text-sm">{t('nodi.savedGame')}</span>
          <Button size="sm" onClick={() => navigate(nodiPath('local/play'))}>{t('setup.resume')}</Button>
          <Button size="sm" variant="outline" onClick={() => { clearNodiSave(); setSaved(null); }}>{t('setup.discard')}</Button>
        </Card>
      )}

      <form onSubmit={handleSubmit(onSubmit)} noValidate className="flex flex-col gap-4">
        <Group title={t('setup.format')}>
          <div className="flex gap-2">
            {FORMATS.map((f) => <Choice key={f} reg={register('format')} value={f} label={t(`nodi.format.${f}`)} />)}
          </div>
          {format === '2v2' && <p className="text-xs opacity-70">{t('nodi.teamNote')}</p>}
        </Group>

        <Group title={t('setup.names')}>
          {seats.map((seat) => (
            <div key={seat} className="flex flex-col">
              <div className="flex items-center gap-2">
                <span className="size-3 shrink-0 rounded-full" style={{ background: seatColor(seat) }} />
                <input {...register(`names.${seat}`)} aria-label={t('setup.playerN', { n: seat + 1 })} maxLength={NAME_MAX}
                  className="min-w-0 flex-1 rounded border border-border bg-input/40 px-3 py-2 outline-none focus-visible:ring-2 focus-visible:ring-ring" />
                {format === '2v2' && <span className="text-xs opacity-70">{t('lobby.team', { team: teamOf(config, seat) })}</span>}
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

        <Toggle control={control} name="borsha" label={t('nodi.borsha')} note={t('nodi.borshaNote')} />
        <Toggle control={control} name="clockOn" label={t('nodi.clock', { s: NODI_RULES.CLOCK_MS / MS_PER_S })} />

        <Button type="submit" size="lg">{t('setup.start')}</Button>
      </form>
    </div>
  );
}
