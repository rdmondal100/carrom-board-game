type Level = 'info' | 'warn' | 'error';

/** Quiet under Vitest so test output stays readable. */
const silent = process.env.VITEST !== undefined;

function write(level: Level, msg: string, extra?: unknown): void {
  if (silent) return;
  const line = `${new Date().toISOString()} ${level.toUpperCase()} ${msg}`;
  const out = level === 'info' ? console.log : console.error;
  if (extra === undefined) out(line);
  else out(line, extra);
}

export const logger = {
  info: (msg: string, extra?: unknown) => write('info', msg, extra),
  warn: (msg: string, extra?: unknown) => write('warn', msg, extra),
  error: (msg: string, extra?: unknown) => write('error', msg, extra),
};
