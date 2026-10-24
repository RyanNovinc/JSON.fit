#!/usr/bin/env node
/*
 * refresh-offered-meals.mjs: rebuild r/meals.json from the meals the app OFFERS.
 *
 *   sh scripts/app-meals/dump.sh ~/Desktop/Claude/worktrees/<app worktree>
 *   node scripts/refresh-offered-meals.mjs
 *   node scripts/build-recipe-pages.mjs
 *
 * Since app 1.0.44 (batch meals) the app offers 37 batch mains (one pot, 8 tubs),
 * the breakfasts and the desserts; the old mains, snacks and sides are no longer
 * offered. This replaces scripts/refresh-meals.cjs, which read every curated meal.
 *
 * Writes
 *   r/meals.json          the offered meals, batch mains first, then breakfasts,
 *                         desserts and backup meals (the smoothies). meals.html lists exactly this file.
 *   r/meals-retired.json  meals that used to be on the site and are no longer
 *                         offered. Their pages stay up (inbound links) with a note
 *                         pointing to the meals page, but they leave the meals page,
 *                         the sitemap and the llms files.
 *
 * Every number and step comes from the app. Two text rules are applied to the
 * copy on the way through (site copy rules): em dashes become a colon or a comma,
 * and one smoothie step's "within 30 minutes of a workout" reads "soon after a
 * workout". Nothing else is reworded.
 */
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import path from 'node:path';

const DUMP = path.resolve('scripts/app-meals/out/offered.json');
const OUT = path.resolve('r/meals.json');
const RETIRED = path.resolve('r/meals-retired.json');

if (!existsSync(DUMP)) {
  console.error('No scripts/app-meals/out/offered.json. Run: sh scripts/app-meals/dump.sh <app dir>');
  process.exit(1);
}
const { meals: offered, ingredients: ING } = JSON.parse(readFileSync(DUMP, 'utf8'));
const previous = existsSync(OUT) ? JSON.parse(readFileSync(OUT, 'utf8')) : {};
const retiredBefore = existsSync(RETIRED) ? JSON.parse(readFileSync(RETIRED, 'utf8')) : {};

/* ---------- text rules ---------- */

function cleanText(s) {
  let out = s.replace(/Best within 30 minutes of a workout/g, 'Best soon after a workout');
  // Em dashes: the first in a sentence reads as a colon, any later one as a comma.
  out = out.split(/(?<=[.!?])\s+/).map((sentence) => {
    let n = 0;
    return sentence.replace(/\s*—\s*/g, () => (n++ === 0 ? ': ' : ', '));
  }).join(' ');
  return out;
}
function cleanDeep(v) {
  if (typeof v === 'string') return cleanText(v);
  if (Array.isArray(v)) return v.map(cleanDeep);
  if (v && typeof v === 'object') {
    const o = {};
    for (const [k, x] of Object.entries(v)) o[k] = /^(url|image_filename|slug|id|ingredient_id)$/.test(k) ? x : cleanDeep(x);
    return o;
  }
  return v;
}

/* ---------- shape ---------- */

const named = (ing) => {
  const o = { ...ing };
  const db = ING[ing.ingredient_id];
  o.display_name = (db && db.display_name) || String(ing.ingredient_id).replace(/_/g, ' ').replace(/^\w/, (c) => c.toUpperCase());
  if (db && db.is_pantry_negligible) o.pantry_negligible = true;
  delete o.range_g;
  return o;
};
const subText = (s) => (typeof s === 'string' ? s : (s && (s.text || s.summary)) || '');
const steps = (list) => (list || []).map((s) => {
  const o = { summary: s.summary, substeps: (s.substeps || [s.summary]).map(subText) };
  if (s.title) o.title = s.title;
  if (s.phase) o.phase = s.phase;
  return o;
});

function shape(meal) {
  const m = JSON.parse(JSON.stringify(meal));
  const flags = m._flags || {};
  delete m._flags;
  const isBatch = !!m.batch;
  m.site = {
    section: isBatch ? 'batch' : m.cuisine === 'smoothie' ? 'backup' : flags.breakfast ? 'breakfast' : 'dessert',
    breakfast: !!flags.breakfast,
    dessert: !!flags.dessert,
    quick_or_made_ahead: !!flags.quick,
    blender: !!flags.blender,
  };
  m.methods = (m.methods || []).map((method) => ({
    ...method,
    ingredients: (method.ingredients || []).map(named),
    instructions: steps(method.instructions),
  }));
  m.plates = (m.plates || []).map((p) => {
    const q = { ...p, additional_ingredients: (p.additional_ingredients || []).map(named), additional_instructions: steps(p.additional_instructions) };
    delete q.plate_macros_range;
    delete q.health;
    return q;
  });
  m.variants = [];
  if (isBatch) {
    // The site's photo of a batch main: images/meals/batch-<slug>.webp (760 px, from the app's photo).
    m.app_image_filename = m.image_filename;
    m.image_filename = `batch_${m.slug}.webp`;
    for (const p of m.plates) delete p.image_filename;
    const b = m.batch;
    m.batch = {
      method: b.method, vessel: b.vessel, tubs: b.tubs, tub_weight_g: b.tub_weight_g,
      hands_on_minutes: b.hands_on_minutes, total_minutes: b.total_minutes,
      storage_tier: b.storage_tier, freezer_note: b.freezer_note, reheat: b.reheat,
      divide: b.divide, side: b.side, leftovers: b.leftovers,
    };
    delete m.sources;
  }
  return cleanDeep(m);
}

/* ---------- order: batch mains, breakfasts, desserts, backup meals (app order within each) ----------
 * Backup meals are the 12 smoothies (cuisine 'smoothie'). The app offers them at breakfast; the
 * site lists them on their own, never as breakfasts and never as "meal replacements". */

const shaped = offered.map(shape);
const rank = { batch: 0, breakfast: 1, dessert: 2, backup: 3 };
shaped.sort((a, b) => rank[a.site.section] - rank[b.site.section]);
const out = {};
for (const m of shaped) out[m.slug] = m;

/* ---------- retired: on the site before, not offered now ---------- */

const retired = { ...retiredBefore };
for (const [slug, meal] of Object.entries(previous)) {
  if (out[slug] || retired[slug] || meal.retired) continue;
  retired[slug] = cleanDeep({ ...meal, retired: true });
}
for (const slug of Object.keys(retired)) if (out[slug]) delete retired[slug]; // offered again

writeFileSync(OUT, JSON.stringify(out, null, 1) + '\n');
writeFileSync(RETIRED, JSON.stringify(retired, null, 1) + '\n');

const count = (s) => shaped.filter((m) => m.site.section === s).length;
console.log(`r/meals.json: ${shaped.length} offered (${count('batch')} batch mains, ${count('breakfast')} breakfasts, ${count('dessert')} desserts, ${count('backup')} backup meals; ${shaped.filter((m) => m.site.breakfast && m.site.dessert).length} counted as both breakfast and dessert)`);
console.log(`r/meals-retired.json: ${Object.keys(retired).length} meals no longer offered (pages kept, with a note)`);
