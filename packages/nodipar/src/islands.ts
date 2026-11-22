// NODI-2 the island graph: mooring, ownership, par chains and round points.
import { BORSHA_CURRENT, NODI, TABLES, type BoardState, type Piece, type Table } from '@carrom/engine';
import { LAYOUTS, NODI_RULES, type Layout } from './config';
import type { NodiConfig, Team } from './types';

export const TEAMS: readonly Team[] = ['A', 'B'];

export const layoutOf = (c: NodiConfig): Layout => LAYOUTS[c.players];

/** The engine table for a game: the layout's river, with the Borsha current when on. */
export function tableOf(c: NodiConfig): Table {
  const id = layoutOf(c).table;
  return { ...TABLES[id], current: c.borsha ? BORSHA_CURRENT[id] : TABLES[id].current };
}

export const seatsOf = (c: NodiConfig): number[] => (c.players === 2 ? [0, 2] : [0, 1, 2, 3]);

/** 1v1: seat 0 is A, seat 2 is B. 2v2: seats 0+2 are A, 1+3 are B. */
export const teamOf = (c: NodiConfig, seat: number): Team =>
  (c.players === 2 ? (seat === 0 ? 'A' : 'B') : seat % 2 === 0 ? 'A' : 'B');

/** The two banks a side's par must link. */
export function parBanks(c: NodiConfig, team: Team): [number, number] {
  return c.players === 4 && team === 'B' ? [1, 3] : [0, 2];
}

export const boatId = (seat: number, k: number): string => `${seat}-${k}`;

export function boatOf(id: string): { seat: number; boat: number } {
  const [s, k] = id.split('-');
  return { seat: Number(s), boat: Number(k) };
}

/** Every boat of every seat, all in hand (pocketed) at the bank. */
export function emptyRiver(c: NodiConfig): BoardState {
  const pieces: Piece[] = [];
  for (const seat of seatsOf(c)) {
    for (let k = 0; k < NODI_RULES.BOATS; k++) {
      pieces.push({
        id: boatId(seat, k), kind: 'boat', x: 0, y: 0, vx: 0, vy: 0,
        r: NODI.BOAT_D / 2, m: NODI.BOAT_MASS, pocketed: true,
      });
    }
  }
  return { pieces };
}

/** Island whose ring holds this boat's centre, or -1. */
export function islandOf(p: Pick<Piece, 'x' | 'y' | 'pocketed'>, layout: Layout): number {
  if (p.pocketed) return -1;
  return layout.islands.findIndex((i) => {
    const dx = p.x - i.x;
    const dy = p.y - i.y;
    return dx * dx + dy * dy < i.r * i.r;
  });
}

/** Owner of each island: the side with the most moored boats (tie = nobody). */
export function ownersOf(board: BoardState, c: NodiConfig): (Team | null)[] {
  const layout = layoutOf(c);
  const counts = layout.islands.map(() => ({ A: 0, B: 0 }));
  for (const p of board.pieces) {
    const i = islandOf(p, layout);
    if (i >= 0) counts[i]![teamOf(c, boatOf(p.id).seat)]++;
  }
  return counts.map((n) => (n.A > n.B ? 'A' : n.B > n.A ? 'B' : null));
}

/** Shortest chain of `team`'s islands from one of its banks to the other ([] = no par). */
export function parChain(owners: readonly (Team | null)[], c: NodiConfig, team: Team): number[] {
  const layout = layoutOf(c);
  const [from, to] = parBanks(c, team);
  const mine = (i: number) => owners[i] === team;
  const goal = new Set(layout.banks[to]);
  const prev = new Map<number, number>();
  const queue = (layout.banks[from] ?? []).filter(mine);
  for (const i of queue) prev.set(i, -1);
  for (let q = 0; q < queue.length; q++) {
    const i = queue[q]!;
    if (goal.has(i)) {
      const chain: number[] = [];
      for (let k = i; k >= 0; k = prev.get(k)!) chain.unshift(k);
      return chain;
    }
    for (const [a, b] of layout.links) {
      const j = a === i ? b : b === i ? a : -1;
      if (j >= 0 && mine(j) && !prev.has(j)) {
        prev.set(j, i);
        queue.push(j);
      }
    }
  }
  return [];
}

export interface Standing {
  owners: (Team | null)[];
  pars: Record<Team, number[]>;
  live: Record<Team, number>;
}

/** NODI-2 who owns what and what each side scores if the round ended now. */
export function standing(board: BoardState, c: NodiConfig): Standing {
  const layout = layoutOf(c);
  const owners = ownersOf(board, c);
  const pars = { A: parChain(owners, c, 'A'), B: parChain(owners, c, 'B') };
  const live = { A: 0, B: 0 };
  owners.forEach((o, i) => { if (o) live[o] += layout.islands[i]!.points; });
  for (const t of TEAMS) if (pars[t].length > 0) live[t] += NODI_RULES.PAR_BONUS;
  return { owners, pars, live };
}
