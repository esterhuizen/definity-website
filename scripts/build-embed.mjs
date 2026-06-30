// Bundles the embeddable direct-stake widget into a single standalone IIFE that
// any validator can drop on their site (React + Solana libs inlined). Output:
// public/embed/v1/widget.js, served at <origin>/embed/v1/widget.js.
import { build } from 'esbuild';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');

await build({
  entryPoints: [resolve(root, 'src/embed/mount.tsx')],
  bundle: true,
  format: 'iife',
  outfile: resolve(root, 'public/embed/v1/widget.js'),
  minify: true,
  sourcemap: false,
  target: ['es2020'],
  jsx: 'automatic',
  define: { 'process.env.NODE_ENV': '"production"' },
  alias: { '@': resolve(root, 'src') },
  legalComments: 'none',
  logLevel: 'info',
});

console.log('✓ built public/embed/v1/widget.js');
