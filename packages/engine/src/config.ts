// Every engine constant lives here. Units: board inner side L = 1.0,
// time in seconds unless a name ends in _MS. Origin at board centre.

export interface Config {
  /** Inner board side. */
  L: number;
  /** Half the inner board side: frames sit at x, y = ±HALF_L. */
  HALF_L: number;
  COIN_D: number;
  /** Tunable 1.7–2.0 × COIN_D, never below 1.6 × COIN_D. */
  STRIKER_D: number;
  /** Must stay below 2 × COIN_D so two coins can't pass side by side. */
  POCKET_D: number;
  /** Pocket centre distance from each of its two frames. */
  POCKET_INSET: number;
  COIN_MASS: number;
  /** Tunable 3–4 × COIN_MASS. */
  STRIKER_MASS: number;
  /** Constant deceleration for every piece, L/s². */
  FRICTION_DECEL: number;
  FRAME_RESTITUTION: number;
  PIECE_RESTITUTION: number;
  /** Striker speed at power 1.0, L/s. speed = MAX_SPEED × power. */
  MAX_SPEED: number;
  MIN_POWER: number;
  MAX_POWER: number;
  /** Below this speed a piece stops, L/s. */
  REST_SPEED: number;
  /** Fixed time step, s. */
  DT: number;
  /** Striker centre distance in from the seat's frame. */
  BASELINE_INSET: number;
  /** Striker slides ±BASELINE_HALF along the baseline. */
  BASELINE_HALF: number;
  MAX_AIM_ANGLE_DEG: number;
  /** cos(MAX_AIM_ANGLE_DEG): the smallest forward component of a legal aim. */
  MIN_AIM_FORWARD: number;
  /** Hard stop for one shot, ms. Shots are expected to rest within 5 s. */
  MAX_SHOT_MS: number;
  /** Safety cap on collisions resolved inside one step. */
  MAX_EVENTS_PER_STEP: number;
  /** Gap used when placing a piece next to another, so they don't overlap. */
  PLACE_GAP: number;
}

const L = 1.0;
const COIN_D = 0.043;

export const config: Config = {
  L,
  HALF_L: L / 2,
  COIN_D,
  STRIKER_D: 1.8 * COIN_D,
  POCKET_D: 1.5 * COIN_D,
  POCKET_INSET: 0.75 * COIN_D,
  COIN_MASS: 1,
  STRIKER_MASS: 3.5,
  FRICTION_DECEL: 1.6,
  FRAME_RESTITUTION: 0.8,
  PIECE_RESTITUTION: 0.9,
  MAX_SPEED: 4.5,
  MIN_POWER: 0.1,
  MAX_POWER: 1.0,
  REST_SPEED: 0.01,
  DT: 1 / 240,
  BASELINE_INSET: 0.16,
  BASELINE_HALF: 0.28,
  MAX_AIM_ANGLE_DEG: 85,
  MIN_AIM_FORWARD: 0.08715574274765817, // cos 85°, written out: no trig at runtime
  MAX_SHOT_MS: 10_000,
  MAX_EVENTS_PER_STEP: 2000,
  PLACE_GAP: 1e-9,
};
