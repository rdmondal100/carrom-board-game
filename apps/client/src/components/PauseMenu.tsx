import { useId, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';
import { Switch } from '@/components/ui/switch';
import { t } from '@/i18n/t';
import { setViewRotation } from '@/store/settingsSlice';
import { useAppDispatch, useAppSelector } from '@/store/store';

interface Props {
  onResume: () => void;
  onRestart: () => void;
  onQuit: () => void;
}

type Confirm = null | 'restart' | 'quit';

/** LOC-8: resume, restart (confirm), quit (confirm). Also the LOC-3 rotation switch (a setting, UI-2). */
export function PauseMenu({ onResume, onRestart, onQuit }: Props) {
  const [confirm, setConfirm] = useState<Confirm>(null);
  const rotate = useAppSelector((s) => s.settings.viewRotation);
  const dispatch = useAppDispatch();
  const rotateId = useId();
  return (
    <Dialog open onOpenChange={(open) => { if (!open) onResume(); }}>
      <DialogContent className="max-w-xs" aria-describedby={undefined}>
        <DialogTitle className="text-center">{t('pause.title')}</DialogTitle>
        {confirm === null ? (
          <>
            <Button autoFocus onClick={onResume}>{t('pause.resume')}</Button>
            <Button variant="outline" onClick={() => setConfirm('restart')}>{t('pause.restart')}</Button>
            <Button variant="outline" onClick={() => setConfirm('quit')}>{t('pause.quit')}</Button>
            <div className="mt-1 flex items-center justify-between gap-3 text-sm">
              <label htmlFor={rotateId}>{t('pause.rotate')}</label>
              <Switch id={rotateId} checked={rotate} onCheckedChange={(v) => dispatch(setViewRotation(v))} />
            </div>
          </>
        ) : (
          <>
            <DialogDescription className="text-center text-base text-foreground">
              {t(confirm === 'restart' ? 'pause.confirmRestart' : 'pause.confirmQuit')}
            </DialogDescription>
            <div className="flex gap-2">
              <Button variant="destructive" className="flex-1" onClick={confirm === 'restart' ? onRestart : onQuit}>{t('confirm.yes')}</Button>
              <Button variant="outline" className="flex-1" autoFocus onClick={() => setConfirm(null)}>{t('confirm.no')}</Button>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
