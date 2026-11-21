import { Suspense, useId } from 'react';
import { Link } from 'react-router';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Slider } from '@/components/ui/slider';
import { Row, ToggleRow } from '@/components/SettingsRows';
import { useGames } from '@/games/GamesContext';
import { LANGS, t, useLang, type Lang } from '@/i18n/t';
import { playSound } from '@/lib/sound';
import { resetSettings, setHaptics, setLanguage, setVoiceMode, setVolume, VOICE_MODES, type VoiceMode } from '@/store/settingsSlice';
import { useAppDispatch, useAppSelector } from '@/store/store';

const PERCENT = 100;
const VOLUME_STEP = 0.05;

/** UI-2: language, volume, haptics, VOICE-4 voice; then each game's own card (HAPP-1). */
export function Settings() {
  useLang();
  const s = useAppSelector((st) => st.settings);
  const dispatch = useAppDispatch();
  const langId = useId();
  const volId = useId();
  const voiceId = useId();
  const { games } = useGames();
  const dev = games.flatMap((g) => g.devRoutes ?? []);

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
          <Row
            id={voiceId}
            label={t('settings.voice')}
            hint={t('settings.voiceHint')}
            control={(
              <Select value={s.voiceMode} onValueChange={(v) => dispatch(setVoiceMode(v as VoiceMode))}>
                <SelectTrigger id={voiceId} className="w-36"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {VOICE_MODES.map((m) => <SelectItem key={m} value={m}>{t(`settings.voiceMode.${m}`)}</SelectItem>)}
                </SelectContent>
              </Select>
            )}
          />
        </CardContent>
      </Card>

      {games.map((g) => g.SettingsCard && <Suspense key={g.id}><g.SettingsCard /></Suspense>)}

      <Button variant="outline" onClick={() => dispatch(resetSettings())}>{t('settings.reset')}</Button>

      {dev.length > 0 && (
        <details className="text-sm text-muted-foreground">
          <summary className="cursor-pointer py-1">{t('settings.dev')}</summary>
          <div className="flex gap-3 pt-2">
            {dev.map((d) => <Link key={d.path} to={`/${d.path}`} className="underline">{t(d.labelKey)}</Link>)}
          </div>
        </details>
      )}
    </div>
  );
}
