import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { boatId, LAYOUTS, newNodi, standing, TURNS, type NodiState } from '@hub/nodipar';
import en from '@/i18n/en.json';
import { setLang } from '@/i18n/t';
import { ScoreStrip } from './NodiParts';
import { NodiPreview } from './NodiPreview';

const ISL = LAYOUTS[2].islands;

/** Seat 0 holds the left chain (a par); seat 2 holds the right island. */
function sample(): NodiState {
  const s = newNodi({ players: 2, borsha: false }, 1, 0);
  const at: Record<string, [number, number]> = {
    [boatId(0, 0)]: [ISL[0]!.x, ISL[0]!.y], [boatId(0, 1)]: [ISL[2]!.x, ISL[2]!.y], [boatId(0, 2)]: [ISL[5]!.x, ISL[5]!.y],
    [boatId(2, 0)]: [ISL[4]!.x, ISL[4]!.y],
  };
  const board = { pieces: s.board.pieces.map((p) => (at[p.id] ? { ...p, x: at[p.id]![0], y: at[p.id]![1], pocketed: false } : p)) };
  return { ...s, board, ...standing(board, s.config), moves: [2, 0, 1, 0] };
}

describe('NODI-4 HUD and NODI-6 preview', () => {
  beforeEach(() => setLang('en'));
  afterEach(cleanup);

  it('NODI-4 the score strip shows live points, a par, and moves left per seat', () => {
    render(<ScoreStrip view={sample()} names={['Rina', '', 'Tuhin', '']} bots={[2]} me={0} />);
    expect(screen.getByTestId('live-A').textContent).toBe(en['nodi.points'].replace('{n}', '8'));
    expect(screen.getByTestId('live-B').textContent).toBe(en['nodi.points'].replace('{n}', '1'));
    expect(screen.getByText(en['nodi.par'])).toBeTruthy();
    expect(screen.getByText(en['nodi.movesLeft'].replace('{n}', String(TURNS - 2)))).toBeTruthy();
    expect(screen.getByLabelText(en['nodi.bot'])).toBeTruthy();
  });

  it('NODI-6 the shop preview draws the river with every island, whirlpool, rock and some boats', () => {
    const { container } = render(<NodiPreview equipped={{ boat: 'golden-boat', river: 'moonlit-river' }} />);
    expect(container.querySelector('svg')).toBeTruthy();
    // 7 islands × up to 3 circles, 2 whirlpools, 3 rocks, 6 boats.
    expect(container.querySelectorAll('circle').length).toBeGreaterThanOrEqual(7 * 2 + 2 + 3 + 6);
    expect(container.querySelectorAll('line').length).toBe(2); // seat 0's par chain
  });
});
