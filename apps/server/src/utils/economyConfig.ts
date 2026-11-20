/** COS-2: coins given by the server. Looks are all coins buy; nothing changes a shot. */
export const ECONOMY = {
  /** An online (private or ranked) or Vs-bot game won. */
  win: 30,
  /** An online or Vs-bot game lost. */
  loss: 10,
  /** First claim each UTC day. */
  dailyBonus: 20,
  /** Vs-bot games are reported by the client, so only this many are rewarded per UTC day. */
  botGamesPerDay: 5,
} as const;

/** The UTC day of `now` as YYYY-MM-DD: the unit of "per day" above. */
export function dayKey(now: Date): string {
  return now.toISOString().slice(0, 10);
}
