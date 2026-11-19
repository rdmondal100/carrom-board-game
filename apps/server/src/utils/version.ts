import pkg from '../../package.json' with { type: 'json' };

/** The server's package.json version (inlined into the bundle by the build). */
export const VERSION: string = pkg.version;
