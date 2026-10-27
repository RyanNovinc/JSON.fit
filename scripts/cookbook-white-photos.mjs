#!/usr/bin/env node
/**
 * cookbook-white-photos.mjs: cut the meal photos out of their black studio background so the
 * print-friendly (white) cookbook can sit them on white paper.
 *
 *   node scripts/cookbook-white-photos.mjs                 # every photo in cookbook/build/img/
 *   node scripts/cookbook-white-photos.mjs a.jpg b.jpg     # just these (names in cookbook/build/img/)
 *
 * Writes cookbook/build/white-photos/<stem>.webp (transparent, for the web) and <stem>.jpg
 * (on white with a soft shadow, for the PDF), and leaves the originals alone. Run `node scripts/build-cookbook.mjs --images ...` first so the print
 * JPEGs exist.
 *
 * How: every house photo is the dish on pure black. The background is the near-black,
 * low-colour area that touches the edge of the frame (flood fill from the border), so dark
 * food inside the plate (rendang, chocolate) is kept. Faint grey steam counts as background
 * too: on white paper it would print as a smudge. The mask edge is feathered by a small blur.
 */
import { readdirSync, mkdirSync, existsSync } from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';

const ROOT = process.cwd();
const SRC = path.join(ROOT, 'cookbook/build/img');
const OUT = path.join(ROOT, 'cookbook/build/white-photos');
mkdirSync(OUT, { recursive: true });

const DARK = 8;       // background: the studio black is true black (0), so only this dark...
const GREY_L = 120;   // ...or a faint grey (steam) up to this luminance
const GREY_SAT = 18;  // ...when its colour spread (max - min channel) is below this
const OPEN_R = 6;     // steam wisps thinner than about twice this (px at 1100 wide) are cut off

export async function cutOut(file, outFile) {
  const { data, info } = await sharp(file).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  const { width: W, height: H } = info;
  const n = W * H;
  const bgLike = new Uint8Array(n);
  for (let i = 0; i < n; i++) {
    const r = data[i * 3], g = data[i * 3 + 1], b = data[i * 3 + 2];
    const L = 0.2126 * r + 0.7152 * g + 0.0722 * b;
    const sat = Math.max(r, g, b) - Math.min(r, g, b);
    bgLike[i] = L < DARK || (L < GREY_L && sat < GREY_SAT) ? 1 : 0;
  }
  // Flood fill the background from every border pixel.
  const bg = new Uint8Array(n);
  const stack = new Int32Array(n);
  let sp = 0;
  const push = (i) => { if (bgLike[i] && !bg[i]) { bg[i] = 1; stack[sp++] = i; } };
  for (let x = 0; x < W; x++) { push(x); push((H - 1) * W + x); }
  for (let y = 0; y < H; y++) { push(y * W); push(y * W + W - 1); }
  while (sp) {
    const i = stack[--sp], x = i % W, y = (i / W) | 0;
    if (x > 0) push(i - 1); if (x < W - 1) push(i + 1);
    if (y > 0) push(i - W); if (y < H - 1) push(i + W);
  }
  // Drop small floating bits of foreground (stray steam, crumbs off the plate): keep the
  // biggest piece and anything at least 2% of it.
  const comp = new Int32Array(n).fill(-1);
  const sizes = [];
  for (let s = 0; s < n; s++) {
    if (bg[s] || comp[s] >= 0) continue;
    const id = sizes.length; let size = 0; sp = 0; stack[sp++] = s; comp[s] = id;
    while (sp) {
      const i = stack[--sp]; size++;
      const x = i % W, y = (i / W) | 0;
      for (const j of [x > 0 ? i - 1 : -1, x < W - 1 ? i + 1 : -1, y > 0 ? i - W : -1, y < H - 1 ? i + W : -1]) {
        if (j >= 0 && !bg[j] && comp[j] < 0) { comp[j] = id; stack[sp++] = j; }
      }
    }
    sizes.push(size);
  }
  const big = Math.max(0, ...sizes);
  const alpha = Buffer.alloc(n);
  for (let i = 0; i < n; i++) alpha[i] = !bg[i] && sizes[comp[i]] >= big * 0.02 ? 255 : 0;
  // Open the mask (shrink, then grow back) to cut thin wisps of steam that are still attached
  // to the food; solid food survives. Kept inside the original mask so nothing grows.
  // (sharp runs threshold before blur within one pipeline, so they're two steps.)
  const raw1 = (buf) => sharp(buf, { raw: { width: W, height: H, channels: 1 } });
  const blurThr = async (buf, t) => raw1(await raw1(buf).blur(OPEN_R).extractChannel(0).raw().toBuffer()).threshold(t).extractChannel(0).raw().toBuffer();
  const shrunk = await blurThr(alpha, 250);
  const opened = await blurThr(shrunk, 6);
  for (let i = 0; i < n; i++) alpha[i] = alpha[i] && opened[i] ? 255 : 0;
  // Feather, then pull the edge in by about a pixel: the outermost pixels are mixed with the
  // black studio and would print as a dark rim on white.
  const blurred = await sharp(alpha, { raw: { width: W, height: H, channels: 1 } }).blur(2.2).extractChannel(0).raw().toBuffer();
  const soft = await raw1(blurred).linear(2, -255).extractChannel(0).raw().toBuffer();
  if (soft.length !== n) throw new Error('mask size ' + soft.length + ' vs ' + n);
  const keptShare = alpha.reduce((a, v) => a + (v ? 1 : 0), 0) / n;
  await sharp(data, { raw: { width: W, height: H, channels: 3 } })
    .joinChannel(soft, { raw: { width: W, height: H, channels: 1 } })
    .webp({ quality: 80, alphaQuality: 90 })
    .toFile(outFile);
  // The print copy: the cut-out already on white with a soft shadow under it, as a JPEG. A PDF
  // stores transparent images and CSS shadows uncompressed (the book went from 13 MB to 97 MB).
  const shade = await raw1(await raw1(soft).blur(18).extractChannel(0).raw().toBuffer()).linear(0.2, 0).extractChannel(0).raw().toBuffer();
  const shadowRGBA = Buffer.alloc(n * 4);
  for (let i = 0; i < n; i++) { shadowRGBA[i * 4] = 20; shadowRGBA[i * 4 + 1] = 20; shadowRGBA[i * 4 + 2] = 26; shadowRGBA[i * 4 + 3] = shade[i]; }
  const pad = 24;
  const shadowPng = await sharp(shadowRGBA, { raw: { width: W, height: H, channels: 4 } }).png().toBuffer();
  const cutPng = await sharp(outFile).png().toBuffer();
  await sharp({ create: { width: W, height: H + pad, channels: 3, background: '#ffffff' } })
    .composite([{ input: shadowPng, top: 14, left: 0 }, { input: cutPng, top: 0, left: 0 }])
    .jpeg({ quality: 72, mozjpeg: true })
    .toFile(outFile.replace(/\.webp$/, '.jpg'));
  return { keptShare, pieces: sizes.filter((s) => s >= big * 0.02).length };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const only = process.argv.slice(2);
  const files = (only.length ? only : readdirSync(SRC).filter((f) => f.endsWith('.jpg')));
  for (const f of files) {
    const src = path.join(SRC, f);
    if (!existsSync(src)) { console.warn('missing', f); continue; }
    const r = await cutOut(src, path.join(OUT, f.replace(/\.jpg$/, '.webp')));
    console.log(f.padEnd(52), 'kept', (r.keptShare * 100).toFixed(1) + '%', 'pieces', r.pieces);
  }
}
