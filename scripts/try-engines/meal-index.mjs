#!/usr/bin/env node
// Writes try/meal-index.json: for every meal the engines can place, the site photo
// (images/meals/*.webp) and whether a recipe page exists at /r/<slug>/.
// Photo lookup, in order: r/meals.json (the site's own mapping of the app's photo
// to the site file), r/meals-retired.json, then the app's image_filename slugified
// the way scripts/build-recipe-pages.mjs does, then the slug itself.
//   node scripts/try-engines/meal-index.mjs <engines.cjs> <site dir>
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
const [, , bundle, site] = process.argv;
const require = createRequire(import.meta.url);
globalThis.self = globalThis;
console.log = () => {};
require(path.resolve(bundle));
const E = globalThis.JsonFitEngines;
const read = (p) => (existsSync(p) ? JSON.parse(readFileSync(p, 'utf8')) : {});
const siteMeals = { ...read(path.join(site, 'r/meals-retired.json')), ...read(path.join(site, 'r/meals.json')) };
const slugifyImage = (f) => String(f || '').replace(/\.(png|jpe?g|webp)$/i, '')
  .normalize('NFKD').replace(/[̀-ͯ]/g, '').replace(/[^\w\s-]/g, '').trim()
  .replace(/[\s_]+/g, '-').replace(/-+/g, '-').toLowerCase();
const has = (stem) => stem && existsSync(path.join(site, 'images/meals', stem + '.webp'));
const out = {};
let missing = [];
for (const m of E.allMeals()) {
  const s = siteMeals[m.slug] || (m.batch?.variant_of && siteMeals[m.batch.variant_of]) || null;
  const tries = [s && slugifyImage(s.image_filename), slugifyImage(m.image_filename), slugifyImage(m.slug), 'batch-' + slugifyImage(m.slug)];
  const stem = tries.find(has) || null;
  const pageSlug = [m.slug, m.batch?.variant_of].find((x) => x && existsSync(path.join(site, 'r', x, 'index.html'))) || null;
  out[m.slug] = { i: stem, r: pageSlug };
  if (!stem && !String(m.slug).startsWith('myfood_')) missing.push(m.slug);
}
writeFileSync(path.join(site, 'try/meal-index.json'), JSON.stringify(out));
// Exercise name -> /exercises/#<slug> (the site's exercise library).
const exFile = path.join(site, 'exercises/exercises.json');
const ex = existsSync(exFile) ? JSON.parse(readFileSync(exFile, 'utf8')).exercises : [];
writeFileSync(path.join(site, 'try/exercise-index.json'), JSON.stringify(Object.fromEntries(ex.map((e) => [e.name, e.slug]))));
process.stderr.write(`meal-index: ${Object.keys(out).length} meals, ${Object.values(out).filter((x) => x.i).length} with photos, ${Object.values(out).filter((x) => x.r).length} with recipe pages; no photo (not My foods): ${missing.length}\n`);
