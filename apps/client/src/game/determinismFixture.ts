import { createRack, simulateShot, stateHash, type ShotInput } from '@carrom/engine';

/** The PHY-7 input from the engine acceptance tests. */
export const PHY7_BREAKING_SEAT = 2;
export const PHY7_INPUT: ShotInput = { seat: 2, x: 0.07, dirX: 0.05, dirY: 0.99875, power: 1 };

/** stateHash of the PHY-7 shot's final board, recorded in Node. */
export const EXPECTED_HASH = '2400dfde4a26d384';

export const DETERMINISM_RUNS = 1000;

/** One PHY-7 run; returns its final stateHash. */
export function runPhy7(): string {
  return stateHash(simulateShot(createRack(PHY7_BREAKING_SEAT), PHY7_INPUT).final);
}
