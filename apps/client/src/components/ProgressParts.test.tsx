import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { MissionView } from '@carrom/protocol';
import en from '@/i18n/en.json';
import { setLang } from '@/i18n/t';
import { LevelBar, missionLabel, MissionsCard, StreakCard } from './ProgressParts';

const mission = (over: Partial<MissionView>): MissionView => ({
  id: 'play-any', kind: 'play', game: null, target: 3, coins: 40, xp: 30, progress: 0, claimed: false, ...over,
});

const MISSIONS = [
  mission({ progress: 1 }),
  mission({ id: 'win-ludo', kind: 'win', game: 'ludo', target: 1, coins: 50, xp: 40, progress: 1 }),
  mission({ id: 'online-any', kind: 'online', target: 2, coins: 60, xp: 50, progress: 2, claimed: true }),
];

describe('progress cards', () => {
  beforeEach(() => setLang('en'));
  afterEach(cleanup);

  it('PRG-8 MissionsCard: claim only when complete; swap on unfinished ones; claimed shows done', () => {
    const onClaim = vi.fn();
    const onSwap = vi.fn();
    render(<MissionsCard missions={MISSIONS} swapsLeft={1} busy={null} onClaim={onClaim} onSwap={onSwap} />);
    expect(screen.queryByTestId('mission-claim-0')).toBeNull();
    expect(screen.getByTestId('mission-swap-0')).toBeTruthy();
    fireEvent.click(screen.getByTestId('mission-claim-1'));
    expect(onClaim).toHaveBeenCalledWith(1);
    fireEvent.click(screen.getByTestId('mission-swap-0'));
    expect(onSwap).toHaveBeenCalledWith(0);
    const done = screen.getByTestId('mission-2');
    expect(within(done).getByText(en['missions.done'])).toBeTruthy();
    expect(within(done).queryByRole('button')).toBeNull();
    expect(within(screen.getByTestId('mission-1')).getByText('Win at Ludo × 1')).toBeTruthy();
  });

  it('PRG-8 MissionsCard: no swap button when no swaps are left; buttons wait while busy', () => {
    render(<MissionsCard missions={MISSIONS} swapsLeft={0} busy={1} onClaim={() => {}} onSwap={() => {}} />);
    expect(screen.queryByTestId('mission-swap-0')).toBeNull();
    expect((screen.getByTestId('mission-claim-1') as HTMLButtonElement).disabled).toBe(true);
  });

  it('PRG-8 StreakCard lights today; earlier days are done', () => {
    render(<StreakCard streak={{ count: 2, day: 3, claimedToday: false }} />);
    expect(screen.getByTestId('streak-day-1').dataset.state).toBe('done');
    expect(screen.getByTestId('streak-day-2').dataset.state).toBe('done');
    expect(screen.getByTestId('streak-day-3').dataset.state).toBe('today');
    expect(screen.getByTestId('streak-day-3').getAttribute('aria-current')).toBe('date');
    expect(screen.getByTestId('streak-day-4').dataset.state).toBe('later');
    expect(screen.getByText('2-day streak')).toBeTruthy();
    cleanup();
    render(<StreakCard streak={{ count: 3, day: 3, claimedToday: true }} />);
    expect(screen.getByTestId('streak-day-3').dataset.state).toBe('done');
  });

  it('PRG-8 labels and the level bar in Bangla and English', () => {
    expect(missionLabel({ kind: 'play', game: 'carrom', target: 2 })).toBe('Play Carrom × 2');
    expect(missionLabel({ kind: 'variety', game: null, target: 2 })).toBe('Play 2 different games');
    setLang('bn');
    expect(missionLabel({ kind: 'win', game: null, target: 2 })).toBe('2টা খেলায় জেতো');
    setLang('en');
    render(<LevelBar level={3} levelXp={50} levelNeed={200} />);
    expect(screen.getByText('Level 3')).toBeTruthy();
    expect(screen.getByRole('progressbar').getAttribute('aria-valuenow')).toBe('50');
  });
});
