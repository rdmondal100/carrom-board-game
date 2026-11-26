import { useId } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Row } from '@/components/SettingsRows';
import { ViewToggle } from '@/components/ViewToggle';
import { useGames } from '@/games/GamesContext';
import { isPlayable } from '@/games/types';
import { webglSupported } from '@/game3d/support';
import { t } from '@/i18n/t';
import { QUALITIES, setQuality, type Quality } from '@/store/settingsSlice';
import { useAppDispatch, useAppSelector } from '@/store/store';

/** T3D-1 Settings: 2D or 3D board for each game, and the 3D detail level. */
export function ViewSettingsCard() {
  const dispatch = useAppDispatch();
  const quality = useAppSelector((s) => s.settings.quality);
  const { games } = useGames();
  const qualityId = useId();
  return (
    <Card data-testid="view-settings">
      <CardHeader><CardTitle>{t('view.title')}</CardTitle></CardHeader>
      <CardContent className="gap-4">
        <p className="text-sm text-muted-foreground">{webglSupported() ? t('view.hint') : t('view.noWebgl')}</p>
        {games.filter(isPlayable).map((g) => (
          <div key={g.id} className="flex items-center justify-between gap-3">
            <span className="flex items-center gap-2 font-medium"><g.Icon className="size-5" />{t(g.nameKey)}</span>
            <ViewToggle game={g.id} />
          </div>
        ))}
        <Row id={qualityId} label={t('view.quality')} hint={t('view.qualityHint')} control={(
          <Select value={quality} onValueChange={(v) => dispatch(setQuality(v as Quality))}>
            <SelectTrigger id={qualityId} className="w-36"><SelectValue /></SelectTrigger>
            <SelectContent>
              {QUALITIES.map((q) => <SelectItem key={q} value={q}>{t(`view.quality.${q}`)}</SelectItem>)}
            </SelectContent>
          </Select>
        )} />
      </CardContent>
    </Card>
  );
}
