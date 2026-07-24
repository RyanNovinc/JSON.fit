#!/usr/bin/env node
/*
 * build-social-images.mjs — 1200x630 JPEG link-preview images for every recipe.
 *
 * WHY: og:image wants a fixed 1.91:1 card under a few hundred KB. The dish
 * photos in images/meals/ are square-ish PNGs at whatever size the renderer
 * produced, and some are >1MB — Facebook and iMessage will either re-crop them
 * badly or skip them. So we center-crop each one to 1200x630 and step the JPEG
 * quality down until the file fits under MAX_BYTES.
 *
 * USAGE (from the repo root):
 *     npm run build:social          # only rebuilds what's stale
 *     node scripts/build-social-images.mjs --force
 *
 * OUTPUT:
 *     images/social/<meal-slug>.jpg              one per meal (always)
 *     images/social/<meal-slug>/<plate-id>.jpg   only when that plate has its
 *                                                own image_filename, so a plate
 *                                                like pulled_pork/tacos shares
 *                                                the taco photo, not the roast.
 *                                                Disable with --meals-only.
 *
 * A rebuild is skipped when the output already exists and is newer than its
 * source, so re-running is cheap and only touches what actually changed.
 */

import { readFileSync, writeFileSync, existsSync, statSync, mkdirSync } from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';

const MEALS_JSON = path.resolve('r/meals.json');
const SRC_DIR = path.resolve('images/meals');
const OUT_DIR = path.resolve('images/social');
const WIDTH = 1200;
const HEIGHT = 630;
const MAX_BYTES = 300 * 1024;
// Walked top-down until the encode fits under MAX_BYTES. 82 clears it for every
// image in the library today; the lower rungs are headroom for busier photos.
const QUALITY_LADDER = [82, 76, 70, 64, 58, 52, 45];

const FORCE = process.argv.includes('--force');
const MEALS_ONLY = process.argv.includes('--meals-only');

/* ---------- helpers ---------- */

// Mirrors slugifyImage() in r/index.html — image_filename in meals.json is the
// authored name ("Butter Chicken Curry.png"); on disk it's hyphenated lowercase.
function slugifyImage(f) {
  if (!f) return '';
  const ext = (f.match(/\.(png|jpe?g|webp)$/i) || ['', 'png'])[1].toLowerCase();
  const base = f.replace(/\.(png|jpe?g|webp)$/i, '');
  const slug = base
    .normalize('NFKD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^\w\s-]/g, '').trim()
    .replace(/[\s_]+/g, '-').replace(/-+/g, '-')
    .toLowerCase();
  return slug + '.' + ext;
}

// Prefer the lossless master; fall back to whatever variant is on disk.
function resolveSource(imageFilename) {
  const slug = slugifyImage(imageFilename);
  if (!slug) return null;
  const stem = slug.replace(/\.(png|jpe?g|webp)$/i, '');
  for (const ext of ['png', 'jpg', 'jpeg', 'webp']) {
    const p = path.join(SRC_DIR, `${stem}.${ext}`);
    if (existsSync(p)) return p;
  }
  return null;
}

function isFresh(outPath, srcPath) {
  if (FORCE || !existsSync(outPath)) return false;
  return statSync(outPath).mtimeMs >= statSync(srcPath).mtimeMs;
}

async function encode(srcPath, outPath) {
  const pipeline = sharp(srcPath).resize(WIDTH, HEIGHT, {
    fit: 'cover',
    position: 'centre',
  });

  let last = null;
  for (const quality of QUALITY_LADDER) {
    const buf = await pipeline
      .clone()
      .jpeg({ quality, mozjpeg: true, chromaSubsampling: '4:2:0' })
      .toBuffer();
    last = { buf, quality };
    if (buf.length <= MAX_BYTES) break;
  }

  mkdirSync(path.dirname(outPath), { recursive: true });
  writeFileSync(outPath, last.buf); // write the buffer we measured — re-encoding would change the size we just tuned
  return last;
}

/* ---------- main ---------- */

let meals;
try {
  meals = JSON.parse(readFileSync(MEALS_JSON, 'utf8'));
} catch (e) {
  console.error(`Could not read ${MEALS_JSON}: ${e.message}`);
  console.error('Run this from the repo root (the folder that contains r/meals.json).');
  process.exit(1);
}

// Collect the work first so one bad row can't leave a half-built directory.
const jobs = [];
const missing = [];

for (const [slug, meal] of Object.entries(meals)) {
  if (!meal) continue;

  const mealSrc = resolveSource(meal.image_filename);
  if (mealSrc) jobs.push({ out: path.join(OUT_DIR, `${slug}.jpg`), src: mealSrc, label: `${slug}.jpg` });
  else missing.push(`${slug} (meal image "${meal.image_filename || '—'}")`);

  if (MEALS_ONLY) continue;

  for (const plate of meal.plates || []) {
    // Only worth its own card when the plate actually looks different.
    if (!plate.image_filename || plate.image_filename === meal.image_filename) continue;
    const plateSrc = resolveSource(plate.image_filename);
    if (plateSrc) {
      jobs.push({
        out: path.join(OUT_DIR, slug, `${plate.id}.jpg`),
        src: plateSrc,
        label: `${slug}/${plate.id}.jpg`,
      });
    } else {
      missing.push(`${slug}/${plate.id} (plate image "${plate.image_filename}")`);
    }
  }
}

let built = 0, skipped = 0, biggest = 0, lowestQuality = 100;

for (const job of jobs) {
  if (isFresh(job.out, job.src)) { skipped++; continue; }
  const { buf, quality } = await encode(job.src, job.out);
  const kb = Math.round(buf.length / 1024);
  biggest = Math.max(biggest, buf.length);
  lowestQuality = Math.min(lowestQuality, quality);
  const warn = buf.length > MAX_BYTES ? '  ⚠ OVER BUDGET' : '';
  console.log(`  images/social/${job.label}  ${kb}KB  q${quality}${warn}`);
  built++;
}

console.log(
  `\n${built} image${built === 1 ? '' : 's'} written, ${skipped} already current` +
  (built ? `. Largest ${Math.round(biggest / 1024)}KB, lowest quality q${lowestQuality} (budget ${MAX_BYTES / 1024}KB).` : '.')
);

if (missing.length) {
  console.warn(`\n⚠ No source image found for ${missing.length}:`);
  for (const m of missing) console.warn(`    ${m}`);
  console.warn('  Those pages fall back to the meal image, or to /og-image.png.');
}
