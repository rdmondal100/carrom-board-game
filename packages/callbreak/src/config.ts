/** CB-2 table and rule numbers. Every Callbreak constant lives here. */
export const CB = {
  SEATS: 4,
  /** Cards per hand (the whole deck dealt to four). */
  HAND: 13,
  /** The call (bid) range. */
  MIN_BID: 1,
  MAX_BID: 8,
  /** CB-3 game lengths in rounds; the first is the default. */
  ROUND_OPTIONS: [5, 3],
  /** CB-3 points are kept in tenths: making the call = call × 10 + 1 per extra trick. */
  POINT: 10,
  /** CB-4 a hand with none of these ranks (and no spade) is redealt: J, Q, K. */
  FACE_RANKS: [11, 12, 13],
  /** Redeals in a row before the deal stands anyway (never reached in practice). */
  MAX_REDEALS: 50,
  /** Same turn clock and takeover as the other games. */
  CLOCK_MS: 20_000,
  TIMEOUTS_FOR_BOT: 2,
} as const;

/** How long the client shows each part of a move; the server's clock waits for it. */
export const CB_ANIM = {
  DEAL_MS: 900,
  BID_MS: 300,
  CARD_MS: 350,
  TRICK_MS: 900,
  ROUND_MS: 3000,
} as const;
