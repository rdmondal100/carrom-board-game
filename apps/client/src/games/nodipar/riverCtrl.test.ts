import { describe, expect, it } from 'vitest';
import { stateHash } from '@carrom/engine';
import { boatId, flickOf, launchPoint, newNodi, nodiBot, nodiParModule, type NodiMove, type NodiState } from '@hub/nodipar';
import { aimForSeat, bankCoords, moveFrom, moveOf, playbackOf, touchAt } from './riverCtrl';

/** seat 0's boat 2 on the river at (x, y). */
function withBoat(x: number, y: number): NodiState {
  const s = newNodi({ players: 2, borsha: false }, 1, 0);
  return { ...s, board: { pieces: s.board.pieces.map((p) => (p.id === boatId(0, 2) ? { ...p, x, y, pocketed: false } : p)) } };
}

describe('NODI-4 river touch', () => {
  it('NODI-4 a press picks your boat, then the ready boat, then a spot along your bank', () => {
    const s = withBoat(0.1, 0.1);
    expect(touchAt(s, 0, { x: 0.11, y: 0.1 }, 0)).toEqual({ kind: 'boat', boat: 2 });
    expect(touchAt(s, 0, launchPoint(0, 0.2), 0.2)).toEqual({ kind: 'ready' });
    const bank = touchAt(s, 0, launchPoint(0, -0.3), 0.2);
    expect(bank?.kind).toBe('bank');
    expect(bank?.kind === 'bank' && bank.along).toBeCloseTo(-0.3, 9);
    expect(touchAt(s, 0, { x: 0, y: -0.2 }, 0)).toBeNull(); // open water
    expect(touchAt(s, 2, { x: 0.11, y: 0.1 }, 0)).toBeNull(); // not seat 2's boat
  });

  it('NODI-4 bank coordinates follow the seat: + along is the player\'s right', () => {
    expect(bankCoords(0, launchPoint(0, 0.25)).along).toBeCloseTo(0.25, 12);
    expect(bankCoords(2, launchPoint(2, -0.1)).along).toBeCloseTo(-0.1, 12);
    expect(bankCoords(0, launchPoint(0, 0)).across).toBeCloseTo(0, 12);
  });

  it('NODI-4 a drag seen from another seat aims in the shooter\'s own frame', () => {
    // Seen from seat 0 (seat 2 at the top of the screen), a pull down the screen points
    // seat 0's shot up the screen = toward seat 2, which is straight back for seat 2.
    const own = aimForSeat({ x: 0, y: 80 }, 400, 0, 0);
    expect(own).toMatchObject({ dirX: -0, dirY: 1, cancelled: false });
    const other = aimForSeat({ x: 0, y: 80 }, 400, 0, 2);
    expect(other.dirY).toBeCloseTo(-1, 12);
    expect(aimForSeat({ x: 1, y: 1 }, 400, 0, 0).cancelled).toBe(true);
  });

  it('NODI-4 a release makes a launch from the bank spot or a flick of the grabbed boat', () => {
    const aim = { dirX: 0, dirY: 1, power: 0.4, cancelled: false };
    expect(moveOf({ kind: 'ready', along: 0.1 }, aim)).toEqual({ kind: 'launch', x: 0.1, dirX: 0, dirY: 1, power: 0.4 });
    expect(moveOf({ kind: 'boat', boat: 3 }, aim)).toEqual({ kind: 'flick', boat: 3, dirX: 0, dirY: 1, power: 0.4 });
    const s = withBoat(0.1, 0.1);
    expect(moveFrom(s, 0, { kind: 'flick', boat: 2, dirX: 0, dirY: 1, power: 0.3 })).toEqual({ x: 0.1, y: 0.1 });
    expect(moveFrom(s, 0, { kind: 'flick', boat: 1, dirX: 0, dirY: 1, power: 0.3 })).toBeNull();
  });
});

describe('NODI-4 playback', () => {
  function playToEnd(s: NodiState, seat: number, move: NodiMove) {
    const pb = playbackOf(s, seat, move);
    let out = pb.advance(0);
    for (let i = 0; i < 2000 && !out.done; i++) out = pb.advance(16.7);
    return out.state;
  }

  it('NODI-4 carrom\'s playback, run on the river, ends on exactly the rules\' board (calm and Borsha, 1v1 and 2v2)', () => {
    for (const config of [{ players: 2, borsha: false }, { players: 2, borsha: true }, { players: 4, borsha: true }] as const) {
      let s = nodiParModule.newGame(config, 3);
      for (let i = 0; i < 6; i++) {
        const seat = s.turnSeat;
        const move = nodiBot(s, seat, 'easy', i);
        expect(stateHash(playToEnd(s, seat, move))).toBe(stateHash(flickOf(s, seat, move).final));
        const out = nodiParModule.applyMove(s, seat, s.turnId, move);
        if (!out.ok) throw new Error(out.message);
        s = out.state;
      }
    }
  });
});
