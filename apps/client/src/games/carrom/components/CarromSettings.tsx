import { RULES } from '@carrom/rules';
import { ToggleRow } from '@/components/SettingsRows';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { t, useLang } from '@/i18n/t';
import { setDefaultShotClock, setViewRotation } from '@/store/settingsSlice';
import { useAppDispatch, useAppSelector } from '@/store/store';

const MS_PER_S = 1000;

/** UI-2 carrom's settings: view rotation and the default shot clock. */
export function CarromSettings() {
  useLang();
  const s = useAppSelector((st) => st.settings);
  const dispatch = useAppDispatch();
  return (
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
  );
}
