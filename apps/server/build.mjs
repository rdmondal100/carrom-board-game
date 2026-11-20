// Bundle the server: workspace packages (@carrom/*, @hub/*, shipped as .ts) are inlined,
// npm packages stay external and load from node_modules at run time.
import { rmSync } from 'node:fs';
import { build } from 'esbuild';

const externalNpm = {
  name: 'external-npm',
  setup(b) {
    b.onResolve({ filter: /^[^./]/ }, (args) =>
      args.path.startsWith('@carrom/') || args.path.startsWith('@hub/') ? undefined : { path: args.path, external: true });
  },
};

rmSync('dist', { recursive: true, force: true });

await build({
  entryPoints: ['src/index.ts'],
  outfile: 'dist/index.js',
  bundle: true,
  platform: 'node',
  format: 'esm',
  target: 'node22',
  sourcemap: true,
  plugins: [externalNpm],
});
