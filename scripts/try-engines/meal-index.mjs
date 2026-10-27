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
// My foods, as the app does it (src/utils/mealCombos.ts mealPhotoFile): a seed's own photo
// (images/meals/myfood-<seed>.webp), a shared one (milks: the glass of milk; the rice cup: the rice
// side), else its curated twin. Size (__small/__regular/__large) and _soy variants share their seed's.
const MYFOOD = 'myfood_';
const seedOf = (slug) => String(slug).slice(MYFOOD.length).split('__')[0].replace(/_soy$/, '');
const SHARED = { ao_lite_milk: 'myfood-sn-milk', ao_soy_milk: 'myfood-sn-milk', ao_rice_cup: 'side-rice' };
const TWIN = { sn_banana: 'banana_snack', sn_jerky: 'beef_jerky', sn_edamame: 'edamame', sn_whey_water: 'protein_shake', sn_whey_milk: 'protein_shake',
  sn_protein_bar: 'protein_bar', sn_boiled_eggs: 'hard_boiled_eggs', sn_tuna: 'tuna_pouch', sn_greek_yog: 'greek_yogurt_snack', sn_mixed_nuts: 'mixed_nuts',
  sn_trail_mix: 'trail_mix', bf_pb_toast: 'pb_banana_toast', bf_overnight_oats: 'overnight_oats', bf_yog_muesli: 'greek_yoghurt_bowl', bf_oats: 'muscle_oats',
  sn_greek_yog_berries: 'greek_yogurt_snack', sn_protein_yog: 'greek_yogurt_snack', sn_cheese_crackers: 'cheese_snack', sn_choc: 'dark_chocolate',
  sn_dates: 'dried_fruit', sn_sultanas: 'dried_fruit' };
const out = {};
const files = {};
let missing = [];
const twinLater = [];
for (const m of E.allMeals()) {
  const s = siteMeals[m.slug] || (m.batch?.variant_of && siteMeals[m.batch.variant_of]) || null;
  const mine = String(m.slug).startsWith(MYFOOD) ? (() => { const seed = seedOf(m.slug); return ['myfood-' + seed.replace(/_/g, '-'), SHARED[seed]].find(has) || null; })() : null;
  const tries = [mine, s && slugifyImage(s.image_filename), slugifyImage(m.image_filename), slugifyImage(m.slug), 'batch-' + slugifyImage(m.slug)];
  const stem = tries.find(has) || null;
  if (!stem && String(m.slug).startsWith(MYFOOD) && TWIN[seedOf(m.slug)]) twinLater.push([m.slug, TWIN[seedOf(m.slug)]]);
  const pageSlug = [m.slug, m.batch?.variant_of].find((x) => x && existsSync(path.join(site, 'r', x, 'index.html'))) || null;
  out[m.slug] = { i: stem, r: pageSlug };
  if (!stem && !String(m.slug).startsWith('myfood_')) missing.push(m.slug);
  // The app's image filenames (meal and plate photos) -> site photo, for screens drawn from filenames.
  if (m.image_filename && stem) files[m.image_filename] = files[m.image_filename] || stem;
  for (const p of m.plates || []) {
    const ps = [slugifyImage(p.image_filename)].find(has);
    if (p.image_filename && (ps || stem)) files[p.image_filename] = files[p.image_filename] || ps || stem;
  }
}
for (const [slug, twin] of twinLater) if (out[twin] && out[twin].i) out[slug].i = out[twin].i;
out.__files = files;
writeFileSync(path.join(site, 'try/meal-index.json'), JSON.stringify(out));
// Exercise name -> /exercises/#<slug> (the site's exercise library).
const exFile = path.join(site, 'exercises/exercises.json');
const ex = existsSync(exFile) ? JSON.parse(readFileSync(exFile, 'utf8')).exercises : [];
writeFileSync(path.join(site, 'try/exercise-index.json'), JSON.stringify(Object.fromEntries(ex.map((e) => [e.name, e.slug]))));
const myNo = Object.keys(out).filter((k) => k.startsWith(MYFOOD) && !out[k].i);
process.stderr.write(`meal-index: ${Object.keys(out).length} meals, ${Object.values(out).filter((x) => x && x.i).length} with photos, ${Object.values(out).filter((x) => x && x.r).length} with recipe pages; no photo (not My foods): ${missing.length}; My foods without a photo: ${myNo.length}${myNo.length ? ' (' + myNo.join(', ') + ')' : ''}\n`);
