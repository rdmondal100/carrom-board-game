import { useId, useState } from 'react';
import { Controller, useForm, useWatch, type UseFormRegisterReturn } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useNavigate, useSearchParams } from 'react-router';
import { RULES } from '@carrom/rules';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { scoreLine } from '@/game/hud';
import { newSeed, SEATINGS, startLocal, type Seating } from '@/game/localGame';
import { clearSave, loadGame, saveGame } from '@/game/save';
import { t, useLang } from '@/i18n/t';
import {
  defaultNames, defaultSetup, LENGTHS, localSetupSchema, NAME_MAX, playerCount, toGame, type LocalSetup as Setup,
} from '@/schemas/localSetup';
import { useAppSelector } from '@/store/store';

const MS_PER_S = 1000;

/** A bot's default name, e.g. "Bot (Medium)". */
const botName = (s: Seating) => t('setup.botName', { level: t(`setup.level.${s}`) });

/** Names the form filled in itself (not typed), so a seat change may replace them. */
function isAutoName(name: string, i: number): boolean {
  return name === defaultNames()[i] || SEATINGS.some((s) => s !== 'human' && name === botName(s));
}

/** BOT-6: the form's starting values; vs bot seats medium bots on the other side. */
function startValues(vsBot: boolean, clockOn: boolean): Setup {
  const v = defaultSetup(vsBot);
  return { ...v, names: v.names.map((n, i) => (v.players[i] === 'human' ? n : botName(v.players[i] as Seating))), clockOn };
}

function Choice({ reg, value, label }: { reg: UseFormRegisterReturn; value: string; label: string }) {
  return (
    <label className="flex-1">
      <input type="radio" value={value} {...reg} className="peer sr-only" />
      <span className="block text-center px-3 py-2 rounded border border-border cursor-pointer peer-checked:bg-primary peer-checked:text-primary-foreground peer-focus-visible:ring-2 peer-focus-visible:ring-ring">
        {label}
      </span>
    </label>
  );
}

function Group({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <fieldset className="flex flex-col gap-1">
      <legend className="text-sm font-semibold mb-1">{title}</legend>
      {children}
    </fieldset>
  );
}

/** LOC-1: format, preset, length, names, shot clock. BOT-6: a person or a bot per seat. LOC-9: offer a saved game. */
export function LocalSetup() {
  useLang();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const vsBot = params.get('vs') === 'bot';
  const clockDefault = useAppSelector((s) => s.settings.defaultShotClock);
  const clockId = useId();
  const [saved, setSaved] = useState(loadGame);
  const { register, handleSubmit, control, setValue, getValues, formState: { errors } } = useForm<Setup>({
    resolver: zodResolver(localSetupSchema),
    defaultValues: startValues(vsBot, clockDefault),
  });

  /** A new seat type renames a seat only if the form picked its name. */
  const onSeating = (i: number, s: Seating) => {
    setValue(`players.${i}`, s);
    const name = getValues(`names.${i}`) ?? '';
    if (isAutoName(name, i)) setValue(`names.${i}`, s === 'human' ? (defaultNames()[i] ?? '') : botName(s));
  };
  const [format, preset, length] = useWatch({ control, name: ['format', 'preset', 'length'] });

  const presetReg = register('preset', {
    onChange: (e: { target: { value: Setup['preset'] } }) => {
      const allowed: readonly string[] = LENGTHS[e.target.value];
      if (!allowed.includes(length)) setValue('length', 'board');
    },
  });

  const onSubmit = (v: Setup) => {
    const { cfg, names, players } = toGame(v, newSeed());
    saveGame(startLocal(cfg, names, v.clockOn, players));
    navigate('/local/play');
  };
  const discard = () => {
    clearSave();
    setSaved(null);
  };

  return (
    <div className="mx-auto flex w-full max-w-md flex-col gap-4">
      <h2 className="text-xl font-bold">{t(vsBot ? 'setup.titleBot' : 'setup.title')}</h2>

      {saved && (
        <Card className="flex-row flex-wrap items-center gap-2 p-3">
          <span className="text-sm tabular-nums mr-auto">{scoreLine(saved)}</span>
          <Button size="sm" onClick={() => navigate('/local/play')}>{t('setup.resume')}</Button>
          <Button size="sm" variant="outline" onClick={discard}>{t('setup.discard')}</Button>
        </Card>
      )}

      <form onSubmit={handleSubmit(onSubmit)} noValidate className="flex flex-col gap-4">
        <Group title={t('setup.format')}>
          <div className="flex gap-2">
            {(['1v1', '2v2'] as const).map((f) => (
              <Choice key={f} reg={register('format')} value={f} label={t(`setup.format.${f}`)} />
            ))}
          </div>
        </Group>

        <Group title={t('setup.preset')}>
          <div className="flex gap-2">
            {(['colour', 'point'] as const).map((p) => (
              <Choice key={p} reg={presetReg} value={p} label={t(`setup.preset.${p}`)} />
            ))}
          </div>
        </Group>

        <Group title={t('setup.length')}>
          <div className="flex gap-2">
            {LENGTHS[preset].map((l) => (
              <Choice key={l} reg={register('length')} value={l} label={t(`setup.length.${l}`)} />
            ))}
          </div>
          {errors.length?.message && <p className="text-sm text-red-400">{t(errors.length.message)}</p>}
        </Group>

        <Group title={t('setup.names')}>
          {Array.from({ length: playerCount(format) }, (_, i) => (
            <div key={i} className="flex flex-col">
              <div className="flex gap-2">
                <input
                  {...register(`names.${i}`)}
                  aria-label={t('setup.playerN', { n: i + 1 })}
                  maxLength={NAME_MAX}
                  className="min-w-0 flex-1 px-3 py-2 rounded bg-input/40 border border-border outline-none focus-visible:ring-2 focus-visible:ring-ring"
                />
                <Controller
                  control={control}
                  name={`players.${i}`}
                  render={({ field }) => (
                    <Select value={field.value} onValueChange={(v) => onSeating(i, v as Seating)}>
                      <SelectTrigger className="w-32" aria-label={t('setup.seatN', { n: i + 1 })} data-testid={`seat-${i}`}>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {SEATINGS.map((s) => <SelectItem key={s} value={s}>{t(`setup.seat.${s}`)}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  )}
                />
              </div>
              {errors.names?.[i]?.message && (
                <p className="text-sm text-red-400">{t(errors.names[i]?.message ?? '')}</p>
              )}
            </div>
          ))}
          {format === '2v2' && <p className="text-xs opacity-70">{t('setup.teamNote')}</p>}
        </Group>

        <div className="flex items-center justify-between gap-3">
          <label htmlFor={clockId}>{t('setup.clock', { s: RULES.SHOT_CLOCK_MS / MS_PER_S })}</label>
          <Controller
            control={control}
            name="clockOn"
            render={({ field }) => (
              <Switch id={clockId} checked={field.value} onCheckedChange={field.onChange} onBlur={field.onBlur} />
            )}
          />
        </div>

        <Button type="submit" size="lg">{t('setup.start')}</Button>
      </form>
    </div>
  );
}
