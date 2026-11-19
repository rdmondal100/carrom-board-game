import { useState } from 'react';
import { useForm, useWatch, type UseFormRegisterReturn } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useNavigate } from 'react-router';
import { RULES } from '@carrom/rules';
import { scoreLine } from '@/game/hud';
import { newSeed, startLocal } from '@/game/localGame';
import { clearSave, loadGame, saveGame } from '@/game/save';
import { t, useLang } from '@/i18n/t';
import {
  defaultSetup, LENGTHS, localSetupSchema, NAME_MAX, playerCount, toGame, type LocalSetup as Setup,
} from '@/schemas/localSetup';

const MS_PER_S = 1000;

function Choice({ reg, value, label }: { reg: UseFormRegisterReturn; value: string; label: string }) {
  return (
    <label className="flex-1">
      <input type="radio" value={value} {...reg} className="peer sr-only" />
      <span className="block text-center px-3 py-2 rounded border border-amber-900/60 cursor-pointer peer-checked:bg-amber-700 peer-focus-visible:ring-2 peer-focus-visible:ring-amber-400">
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

/** LOC-1: format, preset, length, names, shot clock. LOC-9: offer a saved game. */
export function LocalSetup() {
  useLang();
  const navigate = useNavigate();
  const [saved, setSaved] = useState(loadGame);
  const { register, handleSubmit, control, setValue, formState: { errors } } = useForm<Setup>({
    resolver: zodResolver(localSetupSchema),
    defaultValues: defaultSetup(),
  });
  const [format, preset, length] = useWatch({ control, name: ['format', 'preset', 'length'] });

  const presetReg = register('preset', {
    onChange: (e: { target: { value: Setup['preset'] } }) => {
      const allowed: readonly string[] = LENGTHS[e.target.value];
      if (!allowed.includes(length)) setValue('length', 'board');
    },
  });

  const onSubmit = (v: Setup) => {
    const { cfg, names } = toGame(v, newSeed());
    saveGame(startLocal(cfg, names, v.clockOn));
    navigate('/local/play');
  };
  const discard = () => {
    clearSave();
    setSaved(null);
  };

  return (
    <div className="flex flex-col gap-4 max-w-md mx-auto">
      <h2 className="text-xl font-bold">{t('setup.title')}</h2>

      {saved && (
        <div className="rounded-lg border border-amber-700 p-3 flex flex-wrap items-center gap-2">
          <span className="text-sm tabular-nums mr-auto">{scoreLine(saved)}</span>
          <button type="button" onClick={() => navigate('/local/play')} className="px-3 py-1 rounded bg-amber-700 font-semibold">
            {t('setup.resume')}
          </button>
          <button type="button" onClick={discard} className="px-3 py-1 rounded border border-amber-700">
            {t('setup.discard')}
          </button>
        </div>
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
              <input
                {...register(`names.${i}`)}
                aria-label={t('setup.playerN', { n: i + 1 })}
                maxLength={NAME_MAX}
                className="px-3 py-2 rounded bg-black/30 border border-amber-900/60"
              />
              {errors.names?.[i]?.message && (
                <p className="text-sm text-red-400">{t(errors.names[i]?.message ?? '')}</p>
              )}
            </div>
          ))}
          {format === '2v2' && <p className="text-xs opacity-70">{t('setup.teamNote')}</p>}
        </Group>

        <label className="flex items-center gap-2">
          <input type="checkbox" {...register('clockOn')} className="size-4" />
          {t('setup.clock', { s: RULES.SHOT_CLOCK_MS / MS_PER_S })}
        </label>

        <button type="submit" className="px-4 py-2 rounded bg-amber-700 font-semibold text-lg">
          {t('setup.start')}
        </button>
      </form>
    </div>
  );
}
