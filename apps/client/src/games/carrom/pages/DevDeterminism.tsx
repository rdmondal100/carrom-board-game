import { useCallback, useEffect, useRef, useState } from 'react';
import { DETERMINISM_CHUNK } from '@/constants/view';
import { DETERMINISM_RUNS, EXPECTED_HASH, runPhy7 } from '@/games/carrom/determinismFixture';
import { t, useLang } from '@/i18n/t';

interface Result { done: number; bad: number; last: string }

/** BRD-8: run PHY-7 DETERMINISM_RUNS times in the browser, in chunks. */
export function DevDeterminism() {
  useLang();
  const [result, setResult] = useState<Result>({ done: 0, bad: 0, last: '' });
  const runId = useRef(0);

  const run = useCallback(() => {
    const id = ++runId.current;
    let done = 0;
    let bad = 0;
    let last = '';
    const chunk = () => {
      if (id !== runId.current) return;
      const end = Math.min(DETERMINISM_RUNS, done + DETERMINISM_CHUNK);
      for (; done < end; done++) {
        last = runPhy7();
        if (last !== EXPECTED_HASH) bad++;
      }
      setResult({ done, bad, last });
      if (done < DETERMINISM_RUNS) setTimeout(chunk, 0);
    };
    setTimeout(chunk, 0);
    return () => {
      if (runId.current === id) runId.current++;
    };
  }, []);

  useEffect(() => run(), [run]);

  const finished = result.done === DETERMINISM_RUNS;
  const pass = finished && result.bad === 0;

  return (
    <div className="flex flex-col gap-3">
      <h2 className="font-semibold text-lg">{t('det.title')}</h2>
      <p className="text-sm">{t('det.progress', { done: result.done, total: DETERMINISM_RUNS })}</p>
      <p className="text-sm font-mono">{t('det.expected', { hash: EXPECTED_HASH })}</p>
      <p className="text-sm font-mono">{t('det.got', { hash: result.last || '—' })}</p>
      {finished && (
        <p
          data-testid="determinism-result"
          className={`text-2xl font-bold ${pass ? 'text-green-400' : 'text-red-400'}`}
        >
          {pass ? t('det.pass', { n: DETERMINISM_RUNS }) : t('det.fail', { bad: result.bad })}
        </p>
      )}
      <button
        type="button"
        onClick={run}
        disabled={!finished}
        className="self-start px-3 py-1 rounded bg-amber-800 disabled:opacity-50"
      >
        {t('det.run')}
      </button>
    </div>
  );
}
