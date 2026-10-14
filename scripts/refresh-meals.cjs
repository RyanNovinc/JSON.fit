#!/usr/bin/env node
/**
 * refresh-meals.cjs — rebuild r/meals.json from the app's source data.
 *
 *   node scripts/refresh-meals.cjs --app ~/Desktop/AI-Workout-Generator
 *   node scripts/build-recipe-pages.mjs      # then regenerate /r/ pages
 *
 * Reads src/data/curated_meals.ts, src/data/ingredients.ts and
 * src/data/web_image_overrides.json from the app repo (read-only) and writes
 * r/meals.json in the shape the site expects:
 *   - every ingredient carries display_name from the ingredient DB
 *   - meals with base_ingredients + sauce_variants are flattened: each method
 *     gets the default variant's ingredients and instructions, and `variants`
 *     carries every variant with per-method ingredients/instructions
 *   - image_filename values already in r/meals.json are kept (they match the
 *     files on disk); new meals fall back to the app's value
 *   - SIDES (steamed rice etc.) are left out; they are plan fillers, not meals
 */
const fs = require('fs');
const path = require('path');
const os = require('os');

const argv = process.argv.slice(2);
const appArg = argv[argv.indexOf('--app') + 1];
const APP = appArg && argv.includes('--app') ? appArg.replace(/^~/, os.homedir()) : path.join(os.homedir(), 'Desktop', 'AI-Workout-Generator');
const OUT = path.resolve('r/meals.json');
const SIDES = new Set(['baked_potato', 'berries', 'steamed_mixed_veg', 'steamed_rice']);

function loadTs(file, exportRe) {
  let src = fs.readFileSync(file, 'utf8');
  src = src.replace(/import[^;]+;/g, '').replace(exportRe, 'module.exports = ');
  src = src.replace(/\nexport (const|type|interface|function)[\s\S]*$/m, '\n');
  const tmp = path.join(os.tmpdir(), 'jsonfit-' + path.basename(file) + '.cjs');
  fs.writeFileSync(tmp, src);
  const mod = require(tmp);
  fs.unlinkSync(tmp);
  return mod;
}

const MEALS = loadTs(path.join(APP, 'src/data/curated_meals.ts'), /export const CURATED_MEALS: Record<[^>]+> = /);
const ING = loadTs(path.join(APP, 'src/data/ingredients.ts'), /export const INGREDIENTS: Record<[^>]+> = /);
let overrides = {};
try { overrides = JSON.parse(fs.readFileSync(path.join(APP, 'src/data/web_image_overrides.json'), 'utf8')); } catch (e) {}
let existing = {};
try { existing = JSON.parse(fs.readFileSync(OUT, 'utf8')); } catch (e) {}

const named = (ing) => {
  const o = { ...ing };
  const db = ING[ing.ingredient_id];
  o.display_name = (db && db.display_name) || ing.display_name || String(ing.ingredient_id).replace(/_/g, ' ').replace(/^\w/, (c) => c.toUpperCase());
  return o;
};
const steps = (list) => (list || []).map((s) => ({ summary: s.summary, substeps: s.substeps || [s.summary] }));

let missingNames = 0;
const out = {};
for (const [slug, meal] of Object.entries(MEALS)) {
  if (SIDES.has(slug)) continue;
  const m = JSON.parse(JSON.stringify(meal));
  m.slug = slug;
  const base = (m.base_ingredients || []).map(named);
  const sv = m.sauce_variants || [];
  const def = sv.find((v) => v.is_default) || sv[0];

  m.methods = (m.methods || []).map((method) => {
    const mm = { ...method };
    if ((!mm.ingredients || !mm.ingredients.length) && def) {
      mm.ingredients = base.concat((def.ingredients || []).map(named));
      mm.instructions = steps((def.instructions || {})[mm.id]);
    } else {
      mm.ingredients = (mm.ingredients || []).map(named);
      mm.instructions = steps(mm.instructions);
    }
    return mm;
  });
  if (sv.length) {
    m.variants = sv.map((v) => {
      const methods = {};
      for (const method of m.methods) {
        methods[method.id] = {
          ingredients: base.concat((v.ingredients || []).map(named)),
          instructions: steps((v.instructions || {})[method.id]),
        };
      }
      return {
        id: v.id, display_name: v.display_name, shortcut_level: v.shortcut_level, is_default: !!v.is_default,
        extra_active_minutes: v.extra_active_minutes || 0, extra_total_minutes: v.extra_total_minutes || 0,
        notes: v.notes, methods,
      };
    });
  } else {
    m.variants = [];
  }
  delete m.base_ingredients; delete m.sauce_variants;
  m.plates = (m.plates || []).map((p) => ({ ...p, additional_ingredients: (p.additional_ingredients || []).map(named) }));

  // Images: keep what the site already resolves; else app override; else app value.
  const ov = overrides[slug] || {};
  const old = existing[slug];
  m.image_filename = (old && old.image_filename) || ov.image_filename || m.image_filename;
  m.plates = m.plates.map((p) => {
    const op = old && (old.plates || []).find((x) => x.id === p.id);
    const f = (op && op.image_filename) || (ov.plates && ov.plates[p.display_name]) || p.image_filename;
    return f ? { ...p, image_filename: f } : p;
  });
  for (const method of m.methods) for (const i of method.ingredients) if (!ING[i.ingredient_id]) missingNames++;
  out[slug] = m;
}
fs.writeFileSync(OUT, JSON.stringify(out, null, 2) + '\n');
const empty = Object.values(out).filter((m) => !m.methods[0] || !m.methods[0].ingredients.length).map((m) => m.slug);
console.log(`r/meals.json: ${Object.keys(out).length} meals (${Object.keys(MEALS).length - Object.keys(out).length} sides skipped); ingredients without a DB name: ${missingNames}; meals with no ingredients: ${empty.join(', ') || 'none'}`);
