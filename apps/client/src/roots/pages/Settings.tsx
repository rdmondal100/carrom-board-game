import { useId, type ReactNode } from 'react';
import { Link } from 'react-router';
import { RULES } from '@carrom/rules';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Slider } from '@/components/ui/slider';
import { Switch } from '@/components/ui/switch';
import { LANGS, t, useLang, type Lang } from '@/i18n/t';
import { playSound } from '@/lib/sound';
import {
  resetSettings, setDefaultShotClock, setHaptics, setLanguage, setViewRotation, setVolume,
} from '@/store/settingsSlice';
import { useAppDispatch, useAppSelector } from '@/store/store';

const MS_PER_S = 1000;
const PERCENT = 100;
const VOLUME_STEP = 0.05;

function Row({ label, hint, control, id }: { label: string; hint?: string; control: ReactNode; id: string }) {
  return (
    <div className="flex items-center gap-4">
      <div className="flex flex-1 flex-col">
        <label htmlFor={id} className="font-medium">{label}</label>
        {hint && <span className="text-xs text-muted-foreground">{hint}</span>}
      </div>
      {control}
    </div>
  );
}

function ToggleRow({ label, hint, checked, onChange }: {
  label: string; hint?: string; checked: boolean; onChange: (v: boolean) => void;
}) {
  const id = useId();
  return <Row id={id} label={label} hint={hint} control={<Switch id={id} checked={checked} onCheckedChange={onChange} />} />;
}

/** UI-2: language, view rotation, volume, haptics, default shot clock. */
export function Settings() {
  useLang();
  const s = useAppSelector((st) => st.settings);
  const dispatch = useAppDispatch();
  const langId = useId();
  const volId = useId();

  return (
    <div className="mx-auto flex w-full max-w-md flex-col gap-4">
      <h2 className="text-xl font-bold">{t('settings.title')}</h2>

      <Card>
        <CardHeader><CardTitle>{t('settings.general')}</CardTitle></CardHeader>
        <CardContent className="gap-5">
          <Row
            id={langId}
            label={t('settings.language')}
            control={(
              <Select value={s.language} onValueChange={(v) => dispatch(setLanguage(v as Lang))}>
                <SelectTrigger id={langId} className="w-36"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {LANGS.map((l) => <SelectItem key={l} value={l} lang={l}>{t(`lang.${l}`)}</SelectItem>)}
                </SelectContent>
              </Select>
            )}
          />
          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <label htmlFor={volId} className="font-medium">{t('settings.volume')}</label>
              <span className="text-sm tabular-nums text-muted-foreground">{Math.round(s.volume * PERCENT)}%</span>
            </div>
            <Slider
              id={volId}
              aria-label={t('settings.volume')}
              min={0}
              max={1}
              step={VOLUME_STEP}
              value={[s.volume]}
              onValueChange={([v]) => dispatch(setVolume(v ?? 0))}
              onValueCommit={() => playSound('hit')}
            />
          </div>
          <ToggleRow label={t('settings.haptics')} hint={t('settings.hapticsHint')} checked={s.haptics} onChange={(v) => dispatch(setHaptics(v))} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>{t('settings.game')}</CardTitle></CardHeader>
        <CardContent className="gap-5">
          <ToggleRow label={t('settings.rotate')} hint={t('settings.rotateHint')} checked={s.viewRotation} onChange={(v) => dispatch(setViewRotation(v))} />
          <ToggleRow
            label={t('settings.clock')}
            hint={t('settings.clockHint', { s: RULES.SHOT_CLOCK_MS / MS_PER_S })}
            checked={s.defaultShotClock}
            onChange={(v) => dispatch(setDefaultShotClock(v))}
          />
        </CardContent>
      </Card>

      <Button variant="outline" onClick={() => dispatch(resetSettings())}>{t('settings.reset')}</Button>

      <details className="text-sm text-muted-foreground">
        <summary className="cursor-pointer py-1">{t('settings.dev')}</summary>
        <div className="flex gap-3 pt-2">
          <Link to="/dev/sandbox" className="underline">{t('nav.sandbox')}</Link>
          <Link to="/dev/determinism" className="underline">{t('nav.determinism')}</Link>
        </div>
      </details>
    </div>
  );
}
