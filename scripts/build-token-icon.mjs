// Rasterizes public/marketing/token-circle.svg into static PNGs at the sizes
// wallets/explorers use, written to public/token/definSOL_{size}.png.
//
// The /marketing/asset route renders PNGs via next/og (satori + resvg-wasm),
// which rasterizes JSX, not an SVG file — so it can't be reused here. sharp
// (already present in node_modules as a Next transitive dep) is the available
// SVG -> PNG rasterizer; no new dependency is added.
//
//   node scripts/build-token-icon.mjs

import sharp from 'sharp';
import { readFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';

const SRC = 'public/marketing/token-circle.svg';
const OUT_DIR = 'public/token';
const SIZES = [512, 256, 128, 64, 32, 16];

const svg = readFileSync(SRC);
mkdirSync(OUT_DIR, { recursive: true });

for (const size of SIZES) {
  const out = join(OUT_DIR, `definSOL_${size}.png`);
  // Render the SVG at high density, then downscale to the target size for crisp
  // edges at every size (transparent outside the circle).
  await sharp(svg, { density: 512 })
    .resize(size, size, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png({ compressionLevel: 9 })
    .toFile(out);
  const meta = await sharp(out).metadata();
  console.log(`wrote ${out}  ${meta.width}x${meta.height}  (${meta.channels}ch, alpha=${meta.hasAlpha})`);
}

console.log('done.');
