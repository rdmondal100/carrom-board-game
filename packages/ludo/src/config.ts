/** LUDO-1 board and rule numbers. Every Ludo constant lives here. */
export const LUDO = {
  /** Squares on the shared track. */
  TRACK: 52,
  /** Track squares between two colours' start squares (a quarter of the track). */
  QUARTER: 13,
  /** Last track step of a token (0 = its start square); the next step enters its home column. */
  LAST_TRACK: 50,
  /** Progress of a finished token: home column steps 51..55, then home. */
  HOME: 56,
  /** Progress of a token still in its yard. */
  YARD: -1,
  TOKENS: 4,
  DIE_SIDES: 6,
  /** The roll that brings a token out of the yard and gives another roll. */
  SIX: 6,
  /** This many 6s in a row lose the turn (the third isn't played). */
  SIXES_LOSE: 3,
  /** Safe (star) squares, as steps from each colour's start: the start square and 8 ahead. */
  SAFE_OFFSETS: [0, 8],
  /** LUDO-4 same shot clock as carrom (RULES.SHOT_CLOCK_MS), and RUL-10 takeover after two timeouts. */
  CLOCK_MS: 20_000,
  TIMEOUTS_FOR_BOT: 2,
  /** Rolls that pass in a row before the game asks for a tap to roll (stops endless blocked loops). */
  MAX_AUTO_PASSES: 200,
} as const;

/** How long the client animates each part of a move; the server's clock waits for it. */
export const LUDO_ANIM = {
  DICE_MS: 600,
  HOP_MS: 160,
  CAPTURE_MS: 400,
  PASS_MS: 500,
} as const;

/** LUDO-5 bot scores (hard and medium) and its sleep in the room. */
export const LUDO_BOT = {
  FINISH: 100,
  CAPTURE: 80,
  LEAVE_YARD: 50,
  ENTER_COLUMN: 40,
  SAFE: 25,
  /** Per point of progress (a tiebreak: move the token that is further on). */
  PROGRESS: 0.1,
  /** Hard: weight of the chance the moved token can be captured next turn. */
  DANGER: 60,
} as const;
