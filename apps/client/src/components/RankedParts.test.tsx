import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import en from '@/i18n/en.json';
import { setLang } from '@/i18n/t';
import { RankedResultScreen, resultTitleKey } from './RankedParts';

const players = [
  { seat: 0, userId: 'me', ratingBefore: 1000, ratingAfter: 984 },
  { seat: 2, userId: 'op', ratingBefore: 1000, ratingAfter: 1016 },
];

describe('ranked result', () => {
  beforeEach(() => setLang('en'));
  afterEach(cleanup);

  it('RANK-8 headline: win, loss, and abandon from each side', () => {
    const r = { type: 'rankedResult' as const, winner: 'B' as const, abandoned: false, players };
    expect(resultTitleKey(r, players[0])).toBe('ranked.loss');
    expect(resultTitleKey(r, players[1])).toBe('ranked.win');
    const left = { ...r, abandoned: true };
    expect(resultTitleKey(left, players[0])).toBe('ranked.abandonLoss');
    expect(resultTitleKey(left, players[1])).toBe('ranked.abandonWin');
  });

  it('RANK-8 the result screen shows the rating change; waits while saving', () => {
    const noop = () => {};
    const { rerender } = render(<RankedResultScreen result={null} userId="me" onAgain={noop} onHome={noop} />);
    expect(screen.getByText(en['ranked.saving'])).toBeTruthy();
    expect((screen.getByRole('button', { name: en['ranked.again'] }) as HTMLButtonElement).disabled).toBe(true);
    rerender(
      <RankedResultScreen result={{ type: 'rankedResult', winner: 'B', abandoned: false, players }} userId="me" onAgain={noop} onHome={noop} />,
    );
    expect(screen.getByText(en['ranked.loss'])).toBeTruthy();
    expect(screen.getByTestId('rating-change').textContent).toBe('Rating 1000 → 984 (−16)');
  });
});
