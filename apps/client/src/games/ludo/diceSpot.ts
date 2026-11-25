/** A board corner as the viewer sees it. */
export type Corner = 'bl' | 'tl' | 'tr' | 'br';
export type Facing = 0 | 90 | 180 | 270;

const CORNERS: readonly Corner[] = ['bl', 'tl', 'tr', 'br'];
const FACINGS: readonly Facing[] = [0, 90, 180, 270];

/**
 * MOT-1 where the die sits for `turnSeat` on a board seen from `viewSeat`
 * (whose yard is bottom left, see `rotationFor`). Play runs clockwise, so the
 * next seats are top left, top right, bottom right. `facing` turns the die and
 * its prompt toward the edge that player sits at (CSS degrees, clockwise).
 */
export function diceSpot(turnSeat: number, viewSeat: number): { corner: Corner; facing: Facing } {
  const rel = (((turnSeat - viewSeat) % 4) + 4) % 4;
  return { corner: CORNERS[rel]!, facing: FACINGS[rel]! };
}
