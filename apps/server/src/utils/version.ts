import { readFileSync } from 'node:fs';

/** The server's package.json version; works from src/ (dev, tests) and dist/ (start). */
export const VERSION: string = (
  JSON.parse(readFileSync(new URL('../../package.json', import.meta.url), 'utf8')) as { version: string }
).version;
