import { useEffect, type ReactNode } from 'react';
import { Check, Coins, Flame, Globe, Layers, Play, RefreshCw, Star, Target, Trophy, type LucideIcon } from 'lucide-react';
import { toast } from 'sonner';
import { PROGRESS, type MissionKind, type MissionView, type StreakView } from '@carrom/protocol';
import { Button } from '@/components/ui/button';
import { t } from '@/i18n/t';
import { cn } from '@/lib/utils';
import { claimMission, fetchProgress, swapMission, type ProgressData } from '@/store/progressSlice';
import { useAppDispatch, useAppSelector } from '@/store/store';

/** PRG-8 the level number on a player's avatar. */
export function LevelBadge({ level, className }: { level: number; className?: string }) {
  return (
    <span data-testid="level-badge" title={t('level.n', { n: level })}
      className={cn('grid h-4 min-w-4 place-items-center rounded-full bg-linear-to-b from-amber-200 to-amber-500 px-1 text-[10px] leading-none font-extrabold text-amber-950 tabular-nums ring-2 ring-background', className)}>
      {level}
    </span>
  );
}

/** PRG-8 level and the XP bar to the next one. */
export function LevelBar({ level, levelXp, levelNeed }: { level: number; levelXp: number; levelNeed: number }) {
  const pct = Math.min(100, Math.round((levelXp / Math.max(1, levelNeed)) * 100));
  return (
    <div className="flex items-center gap-3" data-testid="level-bar">
      <span className="grid size-11 shrink-0 place-items-center rounded-2xl bg-linear-to-b from-amber-300 to-orange-500 text-lg font-extrabold text-amber-950 shadow-[0_3px_0_#b45309]">
        {level}
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline justify-between gap-2 text-sm">
          <span className="flex items-center gap-1 font-bold"><Star className="size-4 text-amber-300" />{t('level.n', { n: level })}</span>
          <span className="text-xs text-white/70 tabular-nums">{t('level.xp', { xp: levelXp, need: levelNeed })}</span>
        </div>
        <div className="mt-1 h-2 overflow-hidden rounded-full bg-white/10" role="progressbar" aria-valuemin={0} aria-valuemax={levelNeed} aria-valuenow={levelXp}
          aria-label={t('level.next', { left: levelNeed - levelXp, next: level + 1 })}>
          <div className="h-full rounded-full bg-linear-to-r from-amber-300 to-orange-500 transition-[width] duration-700" style={{ width: `${pct}%` }} />
        </div>
      </div>
    </div>
  );
}

/** PRG-8 the streak week: 7 tiles with their coins, past days ticked, today lit. */
export function StreakCard({ streak }: { streak: StreakView }) {
  const week = PROGRESS.streakCoins;
  return (
    <section className="flex flex-col gap-3 rounded-3xl border border-orange-300/25 bg-linear-to-br from-orange-500/20 via-rose-500/10 to-transparent p-4" data-testid="streak-card">
      <div className="flex items-center gap-3">
        <span className="grid size-11 shrink-0 place-items-center rounded-2xl bg-linear-to-b from-orange-300 to-rose-500 shadow-[0_3px_0_#9f1239]">
          <Flame className="size-6 text-white" />
        </span>
        <div className="min-w-0 flex-1">
          <h3 className="font-display text-lg leading-tight font-bold">{t('streak.title')}</h3>
          <p className="text-xs text-white/75">{t('streak.desc', { coins: week[week.length - 1]! })}</p>
        </div>
        {streak.count > 0 && (
          <span className="shrink-0 rounded-full bg-black/25 px-2 py-1 text-xs font-bold text-orange-200">{t('streak.count', { n: streak.count })}</span>
        )}
      </div>
      <ol className="grid grid-cols-7 gap-1.5">
        {week.map((coins, i) => {
          const day = i + 1;
          const done = day < streak.day || (day === streak.day && streak.claimedToday);
          const today = day === streak.day;
          const state = done ? 'done' : today ? 'today' : 'later';
          return (
            <li key={day} data-testid={`streak-day-${day}`} data-state={state} aria-current={today ? 'date' : undefined}
              className={cn('flex flex-col items-center gap-0.5 rounded-xl px-0.5 py-1.5 text-center ring-1 transition',
                done && 'bg-orange-400/25 ring-orange-300/40',
                today && !done && 'bg-amber-300 text-amber-950 ring-amber-200 animate-pulse',
                state === 'later' && 'bg-white/5 ring-white/10 text-white/70')}>
              <span className="text-[10px] font-semibold opacity-80">{today ? t('streak.today') : t('streak.day', { n: day })}</span>
              {done ? <Check className="size-4 text-orange-200" /> : <Coins className={cn('size-4', day === week.length ? 'text-amber-200' : 'opacity-80')} />}
              <span className="text-xs font-bold tabular-nums">{coins}</span>
            </li>
          );
        })}
      </ol>
    </section>
  );
}

const KIND_ICONS: Record<MissionKind, LucideIcon> = { play: Play, win: Trophy, online: Globe, variety: Layers };

/** PRG-8 a mission's text, e.g. "Play Ludo × 2". */
export function missionLabel(m: Pick<MissionView, 'kind' | 'game' | 'target'>): string {
  return m.game === null
    ? t(`mission.${m.kind}.any`, { n: m.target })
    : t(`mission.${m.kind}.game`, { n: m.target, game: t(`games.${m.game}.name`) });
}

interface MissionsCardProps {
  missions: readonly MissionView[];
  swapsLeft: number;
  /** The mission index being claimed or swapped. */
  busy: number | null;
  onClaim: (index: number) => void;
  onSwap: (index: number) => void;
}

/** PRG-8 today's missions: progress, the reward, claim when complete, swap while a swap is left. */
export function MissionsCard({ missions, swapsLeft, busy, onClaim, onSwap }: MissionsCardProps) {
  return (
    <section className="flex flex-col gap-3 rounded-3xl border border-sky-300/25 bg-linear-to-br from-sky-500/20 via-indigo-500/10 to-transparent p-4" data-testid="missions-card">
      <div className="flex items-center gap-3">
        <span className="grid size-11 shrink-0 place-items-center rounded-2xl bg-linear-to-b from-sky-300 to-indigo-500 shadow-[0_3px_0_#3730a3]">
          <Target className="size-6 text-white" />
        </span>
        <div className="min-w-0 flex-1">
          <h3 className="font-display text-lg leading-tight font-bold">{t('missions.title')}</h3>
          <p className="text-xs text-white/75">{t('missions.desc')}</p>
        </div>
      </div>
      <ul className="flex flex-col gap-2">
        {missions.map((m, i) => {
          const Icon = KIND_ICONS[m.kind];
          const complete = m.progress >= m.target;
          const pct = Math.round((m.progress / m.target) * 100);
          return (
            <li key={m.id} data-testid={`mission-${i}`}
              className={cn('flex items-center gap-3 rounded-2xl bg-black/20 p-2.5 ring-1 ring-white/10', m.claimed && 'opacity-60')}>
              <span className={cn('grid size-9 shrink-0 place-items-center rounded-xl', complete ? 'bg-emerald-400/25 text-emerald-200' : 'bg-white/10 text-sky-200')}>
                <Icon className="size-4.5" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold">{missionLabel(m)}</p>
                <div className="mt-1 flex items-center gap-2">
                  <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-white/10">
                    <div className={cn('h-full rounded-full transition-[width] duration-700', complete ? 'bg-emerald-400' : 'bg-sky-400')} style={{ width: `${pct}%` }} />
                  </div>
                  <span className="text-[11px] text-white/70 tabular-nums">{m.progress}/{m.target}</span>
                </div>
                <p className="mt-0.5 text-[11px] font-medium text-amber-200/90">{t('missions.reward', { coins: m.coins, xp: m.xp })}</p>
              </div>
              {m.claimed ? (
                <span className="flex shrink-0 items-center gap-1 text-xs font-bold text-emerald-300"><Check className="size-4" />{t('missions.done')}</span>
              ) : complete ? (
                <Button size="sm" className="shrink-0" data-testid={`mission-claim-${i}`} disabled={busy !== null} onClick={() => onClaim(i)}>
                  {t('missions.claim')}
                </Button>
              ) : swapsLeft > 0 ? (
                <Button size="icon" variant="ghost" className="size-8 shrink-0 text-white/70" data-testid={`mission-swap-${i}`}
                  aria-label={t('missions.swap')} title={t('missions.swap')} disabled={busy !== null} onClick={() => onSwap(i)}>
                  <RefreshCw className={cn('size-4', busy === i && 'animate-spin')} />
                </Button>
              ) : null}
            </li>
          );
        })}
      </ul>
    </section>
  );
}

/**
 * PRG-8 the signed-in player's "Today": level, the streak week and the missions,
 * loaded when it opens. `compact` (a one-game app's home) shows the missions only.
 */
export function TodayPanel({ compact = false }: { compact?: boolean }) {
  const dispatch = useAppDispatch();
  const userId = useAppSelector((s) => s.auth.user?.id);
  const { data, busy } = useAppSelector((s) => s.progress);
  useEffect(() => {
    if (userId) void dispatch(fetchProgress());
  }, [dispatch, userId]);
  if (!userId || !data) return null;

  const claim = (index: number) => {
    dispatch(claimMission(index)).unwrap()
      .then((r) => {
        if (!r.reward) return;
        toast.success(t('missions.claimed', { coins: r.reward.coins, xp: r.reward.xp }));
        if (r.reward.level) toast.success(t('reward.levelUp', { level: r.reward.level, coins: r.reward.levelCoins ?? 0 }));
      })
      .catch(() => toast.error(t('missions.err')));
  };
  const swap = (index: number) => {
    dispatch(swapMission(index)).unwrap().catch(() => toast.error(t('missions.err')));
  };
  const missions = <MissionsCard missions={data.missions} swapsLeft={data.swapsLeft} busy={busy} onClaim={claim} onSwap={swap} />;
  if (compact) return <div className="w-full text-left">{missions}</div>;
  return <TodayView data={data} missions={missions} />;
}

function TodayView({ data, missions }: { data: ProgressData; missions: ReactNode }) {
  return (
    <section className="flex flex-col gap-3" data-testid="today">
      <div className="rounded-3xl border border-white/10 bg-white/[0.04] p-4">
        <LevelBar level={data.level} levelXp={data.levelXp} levelNeed={data.levelNeed} />
      </div>
      <div className="grid gap-3 md:grid-cols-2">
        <StreakCard streak={data.streak} />
        {missions}
      </div>
    </section>
  );
}
