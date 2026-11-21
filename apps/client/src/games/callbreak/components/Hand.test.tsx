import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cbLook } from '@/games/callbreak/skins';
import { CbPreview } from './CbPreview';
import { Hand } from './Hand';

describe('callbreak hand', () => {
  afterEach(cleanup);

  it('CB-7 every card shows; only legal cards are lifted and take taps', () => {
    const onPlay = vi.fn();
    render(<Hand cards={['AS', 'KH', '2H', '9D']} legal={['KH', '2H']} onPlay={onPlay} label="hand" />);
    expect(screen.getAllByTestId(/^card-/)).toHaveLength(4);
    expect(screen.getAllByRole('button')).toHaveLength(2);
    fireEvent.click(screen.getByTestId('card-AS'));
    expect(onPlay).not.toHaveBeenCalled();
    fireEvent.click(screen.getByTestId('card-2H'));
    expect(onPlay).toHaveBeenCalledWith('2H');
  });

  it('CB-7 not your turn: no card takes a tap', () => {
    render(<Hand cards={['AS', 'KH']} legal={[]} onPlay={vi.fn()} label="hand" />);
    expect(screen.queryAllByRole('button')).toHaveLength(0);
  });

  it('CB-9 equipped card backs and tables change the look; unknown ids fall back to classic', () => {
    expect(cbLook({ cardBack: 'royal-card-back', table: 'night-table' }).back.pattern).toBe('royal');
    expect(cbLook({ cardBack: 'gold-dice', table: 'nope' })).toEqual(cbLook(undefined));
    render(<CbPreview equipped={{ cardBack: 'nakshi-card-back' }} />);
    expect(screen.getAllByTestId('card-back')).toHaveLength(2);
  });
});
