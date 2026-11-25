import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { DiceDock } from './DiceDock';

const dock = (seat: number, face: boolean) =>
  render(<DiceDock seat={seat} viewSeat={0} face={face} board={<div />} die={<span>die</span>} />);

describe('dice dock', () => {
  afterEach(cleanup);

  it('MOT-1 same device: the die sits in the turn seat corner, facing that player', () => {
    dock(2, true);
    const d = screen.getByTestId('dice-dock');
    expect(d.getAttribute('data-corner')).toBe('tr');
    expect(d.getAttribute('data-facing')).toBe('180');
  });

  it('MOT-1 online: the die moves to the corner but stays upright', () => {
    dock(1, false);
    const d = screen.getByTestId('dice-dock');
    expect(d.getAttribute('data-corner')).toBe('tl');
    expect(d.getAttribute('data-facing')).toBe('0');
  });
});
