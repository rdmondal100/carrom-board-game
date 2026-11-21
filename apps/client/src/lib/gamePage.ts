/** HAPP-2 the page part of a game path: '/g/carrom/local/play' → 'local/play'; null outside a game. */
export function gamePageOf(path: string): string | null {
  return /^\/g\/[^/]+\/(.+)$/.exec(path)?.[1] ?? null;
}
