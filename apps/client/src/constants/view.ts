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
  frameEdge: 0x3b1d0c,
  surface: 0xe9cf9b,
  line: 0x3a2412,
  pocket: 0x111111,
  white: 0xf7f1e3,
  whiteEdge: 0xb9ab8c,
  black: 0x2a2a2a,
  blackEdge: 0x000000,
  red: 0xc8102e,
  redEdge: 0x7c0a1c,
  striker: 0x2f6fd6,
  strikerEdge: 0x1b3f7a,
  blocked: 0xff2a2a,
  guide: 0xffffff,
  pull: 0x000000,
} as const;

/** Alpha values for overlays. */
export const GUIDE_ALPHA = 0.9;
export const PULL_ALPHA = 0.35;
