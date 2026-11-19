// UI numbers for the board view. Engine sizes come from @carrom/engine config;
// everything here is a screen/feel number. Never inline these elsewhere.

/** Drag length for full power, as a fraction of the inner board width in px. */
export const AIM_MAX_DRAG = 0.3;
/** Releasing closer than this to the press point cancels, fraction of board px. */
export const AIM_CANCEL_RADIUS = 0.04;
/** Nudge above the engine's smallest forward component so a clamped aim never trips its limit check. */
export const AIM_EDGE_EPS = 1e-9;
/** Guide line length at power 1, in board units (L). */
export const GUIDE_MAX_LEN = 0.45;
/** How long a pocketed coin takes to shrink away. */
export const POCKET_ANIM_MS = 220;
/** Longest frame time fed to playback, so a hidden tab does not jump to the end. */
export const MAX_FRAME_MS = 100;

/** Frame (wooden border) width, in board units (L). */
export const FRAME_WIDTH = 0.075;
/** Centre circle radius, in coin diameters (encloses the 19-coin rack). */
export const CENTRE_CIRCLE_COINS = 2.6;
/** Line width, in board units. */
export const LINE_WIDTH = 0.003;
/** Pressing within this many striker radii of its centre starts an aim. */
export const STRIKER_TOUCH_SCALE = 1.6;
/** Half-width of the band around the baseline that moves the striker, in striker diameters. */
export const BASELINE_TOUCH_STRIKERS = 1.2;
/** Upper limit on the whole canvas size (board + frames) on wide screens, px. */
export const MAX_CANVAS_PX = 720;
/** Smallest canvas we lay out, px. */
export const MIN_CANVAS_PX = 200;
/** PHY-7 runs per chunk on the determinism page before yielding to the browser. */
export const DETERMINISM_CHUNK = 25;

export const BOARD_COLOURS = {
  frame: 0x5a2e14,
  frameLight: 0x7a4421,
  frameEdge: 0x2e1608,
  surface: 0xecd5a4,
  surfaceGlow: 0xf6e6c2,
  surfaceEdge: 0xd9b97f,
  line: 0x3a2412,
  /** Board markings (baseline end circles, centre ring). Green, so the red queen stands out. */
  accent: 0x1f6b45,
  pocket: 0x0b0b0b,
  pocketRim: 0x3b1d0c,
  shadow: 0x000000,
  blocked: 0xff2a2a,
  guide: 0xffffff,
  pull: 0x000000,
} as const;

/** A coin's look: radial shading from `hi` (top-left light) through `base` to `edge`. */
export interface PieceStyle { hi: number; base: number; edge: number; ring: number; ringLight: number }

export const PIECE_STYLES = {
  white: { hi: 0xffffff, base: 0xf2e7cf, edge: 0xb8a47c, ring: 0x9c8760, ringLight: 0xffffff },
  black: { hi: 0x8a8a8a, base: 0x2b2b2b, edge: 0x050505, ring: 0x000000, ringLight: 0x9a9a9a },
  red: { hi: 0xff8a98, base: 0xd3132f, edge: 0x6e0613, ring: 0x6e0613, ringLight: 0xffb3bd },
  striker: { hi: 0xbcd6ff, base: 0x2f6fd6, edge: 0x153672, ring: 0x153672, ringLight: 0xd6e6ff },
} as const satisfies Record<string, PieceStyle>;

/** Piece shading, as fractions of the piece radius. */
export const PIECE_SHADOW_OFFSET = { x: 0.12, y: 0.18 };
export const PIECE_SHADOW_ALPHA = 0.3;
export const PIECE_RING_RADIUS = 0.62;
export const PIECE_RING_ALPHA = 0.5;
export const PIECE_SHINE = { x: -0.36, y: -0.42, r: 0.2, alpha: 0.45 };

/** Corner arrows: run along each diagonal between these distances from the centre, in board units. */
export const ARROW_FROM = 0.36;
export const ARROW_TO = 0.17;
/** Arrowhead length, in board units. */
export const ARROW_HEAD = 0.02;
/** Frame bevel width, as a fraction of the frame width. */
export const FRAME_BEVEL = 0.18;

/** Alpha values for overlays. */
export const GUIDE_ALPHA = 0.9;
export const PULL_ALPHA = 0.35;

/** Shot clock ring (LOC-5): radius in striker radii, width in board units. */
export const CLOCK_RING_SCALE = 1.45;
export const CLOCK_RING_WIDTH = 0.006;
/** Below this fraction of time left the ring turns to the warning colour. */
export const CLOCK_LOW_FRACTION = 0.25;
export const CLOCK_COLOURS = { track: 0x000000, ok: 0x2ecc71, low: 0xff3b30 } as const;
export const CLOCK_TRACK_ALPHA = 0.25;
/** A full turn, for the ring arc (radians); the arc starts at 12 o'clock. */
export const FULL_TURN = 2 * Math.PI;
export const CLOCK_START_ANGLE = -Math.PI / 2;

/** How long a toast stays up, ms. */
export const TOAST_MS = 3500;
/** localStorage key for the "turn the board to the shooter" setting (LOC-3). */
export const ROTATE_KEY = 'carrom.rotateView';
