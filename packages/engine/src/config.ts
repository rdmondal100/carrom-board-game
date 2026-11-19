// Every engine constant lives here. Units: board inner side L = 1.0,
// time in seconds unless a name ends in _MS. Origin at board centre.

export interface Config {
  /** Inner board side. */
  L: number;
  /** Half the inner board side: frames sit at x, y = ±HALF_L. */
  HALF_L: number;
  COIN_D: number;
  /** 2.0 × COIN_D (owner asked for a bigger striker); never below 1.6 × COIN_D. */
  STRIKER_D: number;
  /** Must stay below 2 × COIN_D so two coins can't pass side by side. */
  POCKET_D: number;
  /** Pocket centre distance from each of its two frames. */
  POCKET_INSET: number;
  /** A coin crossing the rim faster than this bounces back out instead of dropping, L/s. */
  POCKET_MAX_DROP_SPEED: number;
  /** Share of the into-the-pocket speed a bounced coin keeps (it comes back out). */
  POCKET_RESTITUTION: number;
  COIN_MASS: number;
  /** Heavy next to a coin so coins barely turn it (owner: 5 × COIN_MASS). */
  STRIKER_MASS: number;
  /** Constant (sliding) part of every piece's slow-down, L/s². */
  FRICTION_DECEL: number;
  /** Speed-proportional part of the slow-down, 1/s: fast pieces brake hard, slow ones glide out. */
  FRICTION_DRAG: number;
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
  /** Grid spacing used to search for the nearest free spot for a returned coin. */
  PLACE_GRID_STEP: number;
}

const L = 1.0;
const COIN_D = 0.043;

export const config: Config = {
  L,
  HALF_L: L / 2,
  COIN_D,
  STRIKER_D: 2.0 * COIN_D,
  POCKET_D: 1.3 * COIN_D,
  POCKET_INSET: 0.65 * COIN_D,
  POCKET_MAX_DROP_SPEED: 3.0,
  POCKET_RESTITUTION: 0.5,
  COIN_MASS: 1,
  STRIKER_MASS: 5,
  FRICTION_DECEL: 0.25,
  FRICTION_DRAG: 0.45,
  FRAME_RESTITUTION: 0.8,
  PIECE_RESTITUTION: 0.9,
  MAX_SPEED: 4.5,
  MIN_POWER: 0.1,
  MAX_POWER: 1.0,
  REST_SPEED: 0.01,
  DT: 1 / 240,
  BASELINE_INSET: 0.16,
  BASELINE_HALF: 0.28,
  // Any direction, including back toward the shooter's own frame (owner).
  MAX_AIM_ANGLE_DEG: 180,
  MIN_AIM_FORWARD: -1, // cos 180°, written out: no trig at runtime
  MAX_SHOT_MS: 10_000,
  MAX_EVENTS_PER_STEP: 2000,
  PLACE_GAP: 1e-9,
  PLACE_GRID_STEP: COIN_D / 8,
};
