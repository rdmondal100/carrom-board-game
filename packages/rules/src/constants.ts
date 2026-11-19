// Every rules constant lives here.
export const RULES = {
  COINS_PER_COLOUR: 9,
  /** Colour game: red's value on the board score. */
  RED_BONUS: 5,
  /** Colour game: red adds nothing once the winner's score ≥ target − this. */
  RED_CUTOFF_MARGIN: 5,
  /** Colour points games end after this many boards; the side ahead wins. */
  MAX_BOARDS: 9,
  /** Point game coin values. */
  POINT_VALUE: { white: 10, black: 5, red: 20 },
  SHOT_CLOCK_MS: 20_000,
  /** Timeouts in a row before a bot takes the seat. */
  TIMEOUTS_FOR_BOT: 2,
} as const;
