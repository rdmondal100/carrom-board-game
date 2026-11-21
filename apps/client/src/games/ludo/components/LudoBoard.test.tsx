import { fireEvent, render, screen } from '@testing-library/react';
import { LUDO } from '@hub/ludo';
import { describe, expect, it, vi } from 'vitest';
import { ludoLook } from '@/games/ludo/skins';
import { LudoBoard } from './LudoBoard';

const Y = LUDO.YARD;

describe('ludo board', () => {
  it('LUDO-6 draws every token in play; only legal tokens of the seat on turn take taps', () => {
    const look = ludoLook(undefined);
    const onPick = vi.fn();
    render(
      <LudoBoard seats={[0, 2]} tokens={[[Y, 5, Y, Y], [], [Y, Y, 30, Y], []]} board={look.board} tokenSkinOf={() => look.tokens}
        viewSeat={0} turnSeat={0} legal={[1]} onPick={onPick} label="board" />,
    );
    expect(screen.getAllByTestId(/^token-/)).toHaveLength(8);
    expect(screen.getByTestId('token-0-1').getAttribute('data-progress')).toBe('5');
    fireEvent.click(screen.getByTestId('token-0-0'));
    fireEvent.click(screen.getByTestId('token-2-2'));
    expect(onPick).not.toHaveBeenCalled();
    fireEvent.click(screen.getByTestId('token-0-1'));
    expect(onPick).toHaveBeenCalledWith(1);
    expect(screen.getAllByRole('button')).toHaveLength(1);
  });

  it('LUDO-8 equipped items change the look; unknown ids fall back to classic', () => {
    expect(ludoLook({ tokens: 'gem-tokens', board: 'night-ludo-board', dice: 'gold-dice' }).tokens.shape).toBe('gem');
    expect(ludoLook({ tokens: 'teak-board', board: 'nope', dice: '' })).toEqual(ludoLook(undefined));
  });
});
