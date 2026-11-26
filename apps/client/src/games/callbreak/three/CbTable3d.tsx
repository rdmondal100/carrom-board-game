import { useEffect, useRef } from 'react';
import { RoundPoints, SeatBadge, type TableProps } from '@/games/callbreak/components/CbTable';
import { spotOf } from '@/games/callbreak/components/TrickMotion';
import { t } from '@/i18n/t';
import { useAppSelector } from '@/store/store';
import { createCbScene, type CbScene } from './cbScene';

/** Where each other seat's badge sits over the 3D table. */
const BADGE_AT = { left: 'left-0 top-1/2 -translate-y-1/2', right: 'right-0 top-1/2 -translate-y-1/2' } as const;

/** T3D-6 the Callbreak table in WebGL 3D: same props as the 2D table, plus `onFail` (T3D-2). */
export function CbTable3d(p: TableProps & { onFail: () => void }) {
  const host = useRef<HTMLDivElement>(null);
  const scene = useRef<CbScene | null>(null);
  const quality = useAppSelector((s) => s.settings.quality);
  const fail = useRef(p.onFail);
  useEffect(() => { fail.current = p.onFail; });

  useEffect(() => {
    const el = host.current;
    if (!el) return;
    try {
      scene.current = createCbScene(el, quality, () => fail.current());
    } catch {
      fail.current();
      return;
    }
    return () => { scene.current?.dispose(); scene.current = null; };
  }, [quality]);

  useEffect(() => {
    scene.current?.update({
      me: p.me, trick: p.trick, winner: p.winner, handSizes: p.handSizes, dealer: p.dealer, dealing: p.dealing ?? false,
      back: p.back, table: p.table,
    });
  });

  const badge = (seat: number) => <SeatBadge seat={seat} p={p} spot={spotOf(seat, p.me)} bare />;
  // The top and bottom seats sit above and below the table; the side seats overlap its rim.
  return (
    <div className="flex w-full max-w-xl flex-col items-center" role="region" aria-label={t('callbreak.table')}>
      <div className="z-10 -mb-2">{badge((p.me + 2) % 4)}</div>
      <div className="relative aspect-[16/10] max-h-[44vh] w-full">
        <div ref={host} className="absolute inset-0" data-testid="cb-table-3d" />
        <div className={`absolute ${BADGE_AT.left}`}>{badge((p.me + 1) % 4)}</div>
        <div className={`absolute ${BADGE_AT.right}`}>{badge((p.me + 3) % 4)}</div>
        {p.points && <RoundPoints points={p.points} names={p.names} />}
      </div>
      <div className="z-10 -mt-2">{badge(p.me)}</div>
    </div>
  );
}
