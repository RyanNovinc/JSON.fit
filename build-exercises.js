#!/usr/bin/env node
/*
 * build-exercises.js — builds the public exercise library for json.fit/exercises/
 *
 * Run from the website repo root:
 *   node build-exercises.js               (finds the app repo on disk)
 *   node build-exercises.js --app /path/to/AI-Workout-Generator
 *
 * What it does:
 *   1. Reads exercises.md (the canon the AI reads) and takes every exercise's tags,
 *      equipment and category from it. exercises.md is the single source of truth.
 *   2. Converts every animation frame in <app>/exercise-images/<slug>/<blue|pink>/
 *      to webp at 760 px wide and writes it to images/exercises/<slug>/<sex>/<start|end>.webp.
 *      Frames already converted and newer than their source are skipped, so re-runs are fast.
 *   3. Pulls each exercise's coaching cue (target, setup, execution, feel, mistake, why,
 *      sources, confidence) out of <app>/src/data/exerciseCues.ts by bundling that file
 *      with esbuild and calling its own lookup, so the site shows exactly what the app shows.
 *   4. Writes exercises/exercises.json, which exercises/index.html reads.
 *   5. Checks its own output and lists anything missing. Exit code 1 if any exercise has
 *      no frames or no cue.
 *
 * Needs: sharp (already in package.json) and esbuild (npm install --no-save esbuild).
 */
'use strict';
const fs = require('fs');
const path = require('path');
const os = require('os');

const SITE = __dirname;
const OUT_IMG = path.join(SITE, 'images', 'exercises');
const OUT_JSON = path.join(SITE, 'exercises', 'exercises.json');
const WIDTH = 760;

// ---------- locate the app repo ----------
function findAppRepo() {
  const argi = process.argv.indexOf('--app');
  if (argi > -1 && process.argv[argi + 1]) return path.resolve(process.argv[argi + 1]);
  const home = os.homedir();
  const roots = ['Desktop', 'Documents', 'Projects', 'Developer', 'Code', 'dev', 'repos', ''].map((d) => path.join(home, d));
  const isApp = (dir) => fs.existsSync(path.join(dir, 'exercise-images')) && fs.existsSync(path.join(dir, 'src', 'data', 'exerciseCues.ts'));
  const seen = new Set();
  function walk(dir, depth) {
    if (depth > 3 || seen.has(dir)) return null;
    seen.add(dir);
    let entries;
    try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch { return null; }
    if (isApp(dir)) return dir;
    for (const e of entries) {
      if (!e.isDirectory() || e.name.startsWith('.') || e.name === 'node_modules' || e.name === 'Library') continue;
      const hit = walk(path.join(dir, e.name), depth + 1);
      if (hit) return hit;
    }
    return null;
  }
  for (const r of roots) { const hit = walk(r, 0); if (hit) return hit; }
  return null;
}

// ---------- exercises.md ----------
function slugify(name) {
  return name.toLowerCase().replace(/[^\w\s-]/g, '').trim().replace(/[\s_]+/g, '-');
}
function parseLibrary() {
  const md = fs.readFileSync(path.join(SITE, 'exercises.md'), 'utf8');
  const out = [];
  const re = /^### (.+?)\n([\s\S]*?)(?=^### |(?![\s\S]))/gm;
  let m;
  while ((m = re.exec(md))) {
    const name = m[1].trim(); const body = m[2];
    const field = (k) => { const r = body.match(new RegExp('^- ' + k + ': (.+)$', 'm')); return r ? r[1].trim() : ''; };
    const list = (s) => s.split(',').map((x) => x.trim()).filter((x) => x && x !== '(none)');
    out.push({ name, slug: slugify(name), primary: list(field('Primary')), secondary: list(field('Secondary')), equipment: field('Equipment'), category: field('Category') });
  }
  return out;
}

// ---------- rest tier (mirrors the categories in rest-guidance.md) ----------
const HEAVY = new Set(['Barbell Back Squat', 'Barbell Front Squat', 'Safety Bar Squat', 'Conventional Deadlift', 'Sumo Deadlift', 'Trap Bar Deadlift', 'Barbell Bench Press', 'Incline Barbell Bench Press', 'Decline Barbell Bench Press', 'Standing Barbell Overhead Press', 'Seated Barbell Overhead Press', 'Barbell Row', 'Pendlay Row', 'Weighted Pull-up', 'Weighted Dip', 'Pull-up', 'Chin-up', 'Neutral-Grip Pull-up', 'Romanian Deadlift', 'Stiff-Leg Deadlift']);
const UNI = ['Bulgarian', 'Lunge', 'Step-Up', 'Single-Arm', 'Single-Leg', 'Split Squat', 'Pistol'];
const LOWCOST = ['Lateral Raise', 'Rear Delt', 'Face Pull', 'Calf', 'Wrist', 'Neck', 'Shrug', 'Reverse Fly', 'Tibialis', 'Band'];
function tierOf(e) {
  const n = e.name;
  if (e.category === 'Isometric') return { tier: 'Isometric hold', rest: ['60 s', '45 s', '30 s'] };
  if (HEAVY.has(n)) return { tier: 'Heavy compound', rest: ['3–5 min', '2.5–3 min', '2 min'] };
  if (UNI.some((w) => n.includes(w))) return { tier: 'Unilateral compound', rest: ['90 s–2 min a side', '75–90 s a side', '60 s a side'] };
  if (e.category === 'Compound') return { tier: 'Moderate compound', rest: ['2.5–3 min', '2 min', '75–90 s'] };
  if (LOWCOST.some((w) => n.includes(w))) return { tier: 'Low-cost isolation', rest: ['90 s', '75 s', '60 s'] };
  return { tier: 'High-cost isolation', rest: ['2 min', '75–90 s', '60 s'] };
}

// ---------- frames ----------
async function convertFrames(app, ex, sharp) {
  const src = path.join(app, 'exercise-images', ex.slug);
  const result = { blue: 0, pink: 0, big: [] };
  for (const sex of ['blue', 'pink']) {
    const dir = path.join(src, sex);
    if (!fs.existsSync(dir)) continue;
    const files = fs.readdirSync(dir);
    for (const which of ['start', 'end']) {
      const f = files.find((x) => /\.png$/i.test(x) && x.toLowerCase().startsWith(which));
      if (!f) continue;
      const inPath = path.join(dir, f);
      const outDir = path.join(OUT_IMG, ex.slug, sex);
      const outPath = path.join(outDir, which + '.webp');
      fs.mkdirSync(outDir, { recursive: true });
      const fresh = fs.existsSync(outPath) && fs.statSync(outPath).mtimeMs >= fs.statSync(inPath).mtimeMs;
      if (!fresh) await sharp(inPath).resize({ width: WIDTH }).webp({ quality: 80, effort: 6 }).toFile(outPath);
      const kb = fs.statSync(outPath).size / 1024;
      if (kb > 20) result.big.push(path.relative(SITE, outPath) + ' (' + kb.toFixed(0) + ' KB)');
      result[sex]++;
    }
  }
  return result;
}

// ---------- cues ----------
function loadCues(app) {
  const esbuild = require('esbuild');
  const entry = path.join(app, 'src', 'data', 'exerciseCues.ts');
  const built = esbuild.buildSync({
    entryPoints: [entry], bundle: true, platform: 'node', format: 'cjs', write: false, logLevel: 'silent',
    external: ['react', 'react-native', 'react-native-*', 'expo', 'expo-*', '@expo/*', '@react-native*', '@react-navigation/*'],
    loader: { '.png': 'empty', '.jpg': 'empty', '.webp': 'empty', '.json': 'json' },
  });
  const code = built.outputFiles[0].text;
  const mod = { exports: {} };
  new Function('module', 'exports', 'require', code)(mod, mod.exports, require);
  const M = mod.exports;
  const lookupFn = ['getExerciseCue', 'getCue', 'resolveCue', 'lookupCue'].map((k) => M[k]).find((f) => typeof f === 'function');
  const table = M.EXERCISE_CUES || M.default?.EXERCISE_CUES || Object.values(M).find((v) => v && typeof v === 'object' && Object.values(v).some((c) => c && c.execution));
  return function cueFor(name, slug) {
    let c = null;
    if (lookupFn) { try { c = lookupFn(name); } catch { c = null; } }
    if (!c && M.resolveCueSlug && table) { try { const id = M.resolveCueSlug(name); c = id ? table[id] : null; } catch { c = null; } }
    if (!c && table) {
      const vals = Object.values(table);
      c = vals.find((v) => v && (v.displayName || '').toLowerCase() === name.toLowerCase()) || vals.find((v) => v && v.slug === slug) || null;
    }
    if (!c || !c.execution) return null;
    const arr = (x) => (Array.isArray(x) ? x : x ? [String(x)] : []);
    return { target: c.target || '', setup: arr(c.setup), execution: arr(c.execution), feel: c.feel || '', mistake: c.mistake || '', quickCue: c.quickCue || '', why: c.why || '', sources: arr(c.sources), confidence: c.confidence || '' };
  };
}

// ---------- main ----------
(async () => {
  const app = findAppRepo();
  if (!app) { console.error('App repo not found. Run: node build-exercises.js --app /path/to/AI-Workout-Generator'); process.exit(1); }
  console.log('App repo:', app);
  let sharp; try { sharp = require('sharp'); } catch { console.error('sharp is missing. Run: npm install'); process.exit(1); }
  try { require('esbuild'); } catch { console.error('esbuild is missing. Run: npm install --no-save esbuild'); process.exit(1); }

  const lib = parseLibrary();
  console.log('exercises.md:', lib.length, 'exercises');
  const cueFor = loadCues(app);

  const problems = []; const big = []; let frames = 0; let cues = 0;
  const rows = [];
  for (const e of lib) {
    const r = await convertFrames(app, e, sharp);
    frames += r.blue + r.pink; big.push(...r.big);
    const sexes = ['blue', 'pink'].filter((s) => r[s] === 2);
    if (sexes.length === 0) problems.push('no frames: ' + e.name + ' (expected exercise-images/' + e.slug + '/)');
    else if (sexes.length === 1) problems.push('only ' + sexes[0] + ' frames: ' + e.name);
    const cue = cueFor(e.name, e.slug);
    if (cue) cues++; else problems.push('no cue: ' + e.name);
    const t = tierOf(e);
    rows.push({ name: e.name, slug: e.slug, primary: e.primary, secondary: e.secondary, equipment: e.equipment, category: e.category, tier: t.tier, rest: t.rest, sexes, cue });
  }
  fs.mkdirSync(path.dirname(OUT_JSON), { recursive: true });
  fs.writeFileSync(OUT_JSON, JSON.stringify({ generated: new Date().toISOString(), count: rows.length, exercises: rows }, null, 1));

  console.log('\nFrames written or up to date:', frames, '(expected', lib.length * 4 + ')');
  console.log('Cues found:', cues, 'of', lib.length);
  console.log('JSON:', path.relative(SITE, OUT_JSON), (fs.statSync(OUT_JSON).size / 1024).toFixed(0), 'KB');
  const totalKb = (function sum(dir) { let s = 0; for (const f of fs.readdirSync(dir, { withFileTypes: true })) s += f.isDirectory() ? sum(path.join(dir, f.name)) : fs.statSync(path.join(dir, f.name)).size; return s; })(OUT_IMG) / 1024;
  console.log('Images total:', (totalKb / 1024).toFixed(1), 'MB');
  if (big.length) { console.log('\nFrames over 20 KB (fine, just noting):'); big.forEach((b) => console.log('  ' + b)); }
  if (problems.length) { console.log('\nPROBLEMS:'); problems.forEach((p) => console.log('  ' + p)); process.exit(1); }
  console.log('\nAll', lib.length, 'exercises have four frames and a cue. Done.');
})().catch((err) => { console.error(err); process.exit(1); });
