import { useState } from 'react';
import { t } from '@/i18n/t';

interface Props {
  rotate: boolean;
  onRotate: (on: boolean) => void;
  onResume: () => void;
  onRestart: () => void;
  onQuit: () => void;
}

type Confirm = null | 'restart' | 'quit';

const btn = 'w-full px-4 py-2 rounded font-semibold';

/** LOC-8: resume, restart (confirm), quit (confirm). Also the LOC-3 rotation switch. */
export function PauseMenu({ rotate, onRotate, onResume, onRestart, onQuit }: Props) {
  const [confirm, setConfirm] = useState<Confirm>(null);
  return (
    <div className="fixed inset-0 z-30 flex items-center justify-center bg-black/60 p-4">
      <div role="dialog" aria-modal="true" className="w-full max-w-xs rounded-xl bg-amber-950 p-5 flex flex-col gap-3 shadow-xl">
        <h2 className="text-lg font-bold text-center">{t('pause.title')}</h2>
        {confirm === null ? (
          <>
            <button type="button" autoFocus onClick={onResume} className={`${btn} bg-amber-700`}>{t('pause.resume')}</button>
            <button type="button" onClick={() => setConfirm('restart')} className={`${btn} border border-amber-700`}>{t('pause.restart')}</button>
            <button type="button" onClick={() => setConfirm('quit')} className={`${btn} border border-amber-700`}>{t('pause.quit')}</button>
            <label className="flex items-center gap-2 text-sm mt-1">
              <input type="checkbox" checked={rotate} onChange={(e) => onRotate(e.target.checked)} className="size-4" />
              {t('pause.rotate')}
            </label>
          </>
        ) : (
          <>
            <p className="text-center">{t(confirm === 'restart' ? 'pause.confirmRestart' : 'pause.confirmQuit')}</p>
            <div className="flex gap-2">
              <button type="button" onClick={confirm === 'restart' ? onRestart : onQuit} className={`${btn} bg-red-700`}>{t('confirm.yes')}</button>
              <button type="button" autoFocus onClick={() => setConfirm(null)} className={`${btn} border border-amber-700`}>{t('confirm.no')}</button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
