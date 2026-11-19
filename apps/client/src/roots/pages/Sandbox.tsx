import { useCallback, useRef, useState } from 'react';
import type { Seat, ShotEvent, ShotInput } from '@carrom/engine';
import { useBoardCanvas } from '@/game/useBoardCanvas';
import { t, useLang } from '@/i18n/t';

const SEATS: readonly Seat[] = [0, 1, 2, 3];
const LOG_MAX = 200;

type LogLine = { kind: 'shot'; power: number } | { kind: 'event'; ev: ShotEvent };

function describe(line: LogLine): string {
  if (line.kind === 'shot') return t('event.shot', { power: line.power.toFixed(2) });
  const { ev } = line;
  const ms = Math.round(ev.t);
  if (ev.type === 'hit') return t('event.hit', { t: ms, a: ev.a, b: ev.b });
  if (ev.type === 'frame') return t('event.frame', { t: ms, id: ev.id });
  if (ev.type === 'pocketBounce') return t('event.pocketBounce', { t: ms, id: ev.id, pocket: ev.pocket });
  return t('event.pocket', { t: ms, id: ev.id, pocket: ev.pocket });
}

export function Sandbox() {
  useLang();
  const host = useRef<HTMLDivElement>(null);
  const [seat, setSeat] = useState<Seat>(0);
  const [playing, setPlaying] = useState(false);
  const [placedOk, setPlacedOk] = useState(true);
  const [log, setLog] = useState<LogLine[]>([]);

  const push = useCallback((lines: LogLine[]) => {
    setLog((old) => [...lines.reverse(), ...old].slice(0, LOG_MAX));
  }, []);

  const board = useBoardCanvas(host, 0, {
    onShot: (input: ShotInput) => push([{ kind: 'shot', power: input.power }]),
    onEvents: (events) => push(events.map((ev) => ({ kind: 'event', ev }))),
    onPlayingChange: setPlaying,
    onPlacedChange: setPlacedOk,
  });

  const chooseSeat = (s: Seat) => {
    setSeat(s);
    board.current.setSeat(s);
  };
  const reset = () => {
    board.current.reset(seat);
    setLog([]);
  };

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <span>{t('sandbox.seat')}</span>
        {SEATS.map((s) => (
          <button
            key={s}
            type="button"
            disabled={playing}
            onClick={() => chooseSeat(s)}
            className={`px-3 py-1 rounded border border-amber-900/60 disabled:opacity-50 ${s === seat ? 'bg-amber-700' : ''}`}
          >
            {t('sandbox.seatN', { n: s })}
          </button>
        ))}
        <button
          type="button"
          disabled={playing}
          onClick={reset}
          className="ml-auto px-3 py-1 rounded bg-amber-800 disabled:opacity-50"
        >
          {t('sandbox.reset')}
        </button>
      </div>

      <div ref={host} className="w-full flex justify-center select-none" />

      <p className="text-sm opacity-80 min-h-5">
        {playing ? t('sandbox.playing') : placedOk ? t('sandbox.hint') : t('sandbox.blocked')}
      </p>

      <section>
        <h2 className="font-semibold text-sm mb-1">{t('sandbox.log')}</h2>
        <ol className="text-xs font-mono max-h-48 overflow-y-auto bg-black/30 rounded p-2">
          {log.length === 0 && <li className="opacity-60">{t('sandbox.logEmpty')}</li>}
          {log.map((line, i) => <li key={log.length - i}>{describe(line)}</li>)}
        </ol>
      </section>
    </div>
  );
}
