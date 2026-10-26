// Parity: the page's meal build against the app's own meal path.
//
//   node scripts/try-engines/parity.mjs <app repo or worktree>   (after build.sh)
//
// For several sets of answers, runs (a) the page's engine (out/engines.cjs, the
// node build of try/engines.min.js: mealView/buildMeals in meals-part.ts) and
// (b) parity-app.ts, the app's screens transcribed handler by handler, bundled
// here from the same app checkout with the same stubs and flags. Both build a
// week with the app's generateMealPlanFromStorage; this diffs the weeks: every
// meal on every day (slot, recipe, plate, time, kcal and macros), each day's
// totals, the cook days and pots, and the shopping list. Any difference fails.
//
// The generator stops its search on a wall clock (3.5 s), so both runs get the
// same fake clock: a fixed date, and Date.now() advancing 10 microseconds a
// call, so the search is the same length every run.
import { createRequire } from 'node:module';
import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import path from 'node:path';
const require = createRequire(import.meta.url);
const HERE = path.dirname(new URL(import.meta.url).pathname);
const SITE = path.resolve(HERE, '../..');
const APP = path.resolve(process.argv[2] || path.join(process.env.HOME, 'Desktop/Claude/worktrees/jsonfit-tf-1044'));
const OUT = path.join(HERE, 'out');
mkdirSync(OUT, { recursive: true });
const S = path.join(SITE, 'scripts/app-meals/stubs');
writeFileSync(path.join(OUT, 'parity-app.ts'), readFileSync(path.join(HERE, 'parity-app.ts'), 'utf8').replaceAll('APP_DIR', APP));
execFileSync('npx', ['esbuild', path.join(OUT, 'parity-app.ts'), '--bundle', '--log-level=error', '--platform=node', '--format=cjs',
  `--alias:react-native=${S}/rn.js`, `--alias:@react-native-async-storage/async-storage=${S}/asyncstorage.js`,
  `--alias:expo-notifications=${S}/empty.js`, `--alias:expo-file-system=${S}/fs`, `--alias:react=${S}/react.js`, `--alias:@react-navigation/native=${S}/nav.js`,
  '--define:process.env.EXPO_PUBLIC_BATCH_PLANNER="1"', '--define:process.env.EXPO_PUBLIC_BATCH_LIBRARY="1"',
  '--define:process.env.EXPO_PUBLIC_MEAL_GENERATOR="1"', '--define:process.env.EXPO_PUBLIC_WORKOUT_GENERATOR="1"',
  '--define:__DEV__=false', `--outfile=${path.join(OUT, 'parity-app.cjs')}`], { cwd: APP, stdio: 'inherit' });

const say = (...a) => process.stdout.write(a.join(' ') + '\n');
console.log = () => {}; console.warn = () => {}; console.error = () => {};

// The fake clock (both bundles read the global Date at call time).
const RealDate = Date;
const T0 = RealDate.parse('2026-10-26T09:00:00+11:00');
let now = T0;
class FakeDate extends RealDate {
  constructor(...a) { if (a.length) super(...a); else super(now); }
  static now() { now += 0.01; return Math.floor(now); }
}
const resetClock = () => { now = T0; };
globalThis.Date = FakeDate;

require(path.join(OUT, 'engines.cjs'));
const WEB = globalThis.JsonFitEngines;
require(path.join(OUT, 'parity-app.cjs'));
const APPRUN = globalThis.AppMealPath;

const base = (o) => ({ dietType: 'balanced', customMacros: null, dietPattern: 'any', allergies: [], skip: [], keepLower: [], sleep: { bed: 1350, wake: 390, strictness: 'moderate', overrides: {} },
  mealsPerDay: 3, snackFrequency: 'ai_decide', mealVariety: 'balanced', snacks: { ticked: ['sn_banana', 'sn_greek_yog', 'sn_almonds', 'sn_whey_milk', 'sn_toast_pb'], own: [] },
  lowAppetite: false, dessertFrequency: '0', dessertDays: [], slowCooker: '5_6l', slowCookerCount: 1, blender: null, freezerTubs: 16, shopCadence: 'weekly', stockUp: false,
  startDate: 'tomorrow', picks: { saved: false, keys: [], allergenOk: {}, versionChoices: {}, useUp: [] }, ...o });
const man = { sex: 'male', ageYears: 34, heightCm: 180, weightKg: 92, bodyFatPct: 25, goalWeightKg: 82, goalBodyFatPct: 13, trainingState: 'consistent', activityLevel: 'light', trainingSessionsPerWeek: 3.5, route: 'lean' };
const woman = { sex: 'female', ageYears: 41, heightCm: 165, weightKg: 74, bodyFatPct: 34, goalWeightKg: 64, goalBodyFatPct: 26, trainingState: 'new', activityLevel: 'sedentary', trainingSessionsPerWeek: 1.5, route: 'lean' };
const gainer = { sex: 'male', ageYears: 22, heightCm: 183, weightKg: 66, bodyFatPct: 12, goalWeightKg: 80, goalBodyFatPct: 13, trainingState: 'new', activityLevel: 'moderate', trainingSessionsPerWeek: 5.5, route: 'bulk' };
const SETS = [
  { name: 'man cut, defaults, choose for me', about: man, food: base({}) },
  { name: 'woman cut, vegetarian, nuts, skip mushroom, sleep moved, 4 meals, dessert 3 nights, no slow cooker', about: woman,
    food: base({ dietType: 'high_protein', dietPattern: 'vegetarian', allergies: ['Nuts', 'Kiwi'], skip: ['mushrooms', 'coriander'], keepLower: ['salt'], sleep: { bed: 1380, wake: 360, strictness: 'maximum', overrides: { lunch: '1:00 PM' } },
      mealsPerDay: 4, snackFrequency: '1', mealVariety: 'variety', snacks: { ticked: ['sn_banana', 'sn_greek_yog'], own: [{ name: 'Protein bar', kcal: 210, protein: 20, serve: '1 bar' }] },
      dessertFrequency: 'few_per_week', dessertDays: [1, 3, 5], slowCooker: 'none', blender: 'no', freezerTubs: 8 }) },
  { name: 'gainer, low appetite, picks + use-up, chest freezer, cook2, stock up', about: gainer,
    food: base({ dietType: 'custom', customMacros: { protein: 30, carbs: 45, fat: 25 }, mealsPerDay: 5, snackFrequency: '2', lowAppetite: true, dessertFrequency: 'every_night', dessertDays: [0, 1, 2, 3, 4, 5, 6],
      slowCooker: '7l_plus', slowCookerCount: 2, blender: 'yes', freezerTubs: 60, shopCadence: 'cook2', stockUp: true, startDate: 'today',
      picks: { saved: true, keys: [], allergenOk: {}, versionChoices: {}, useUp: ['chicken', 'rice'] } }) },
  { name: 'man, no snacks, skip sleep, pescatarian, weekly', about: man,
    food: base({ dietType: 'low_carb', dietPattern: 'pescatarian', allergies: ['Shellfish'], sleep: { skipped: true }, mealsPerDay: 2, snackFrequency: '0', dessertFrequency: 'once_per_week', dessertDays: [6], freezerTubs: 30, shopCadence: 'shop2_cook1' }) },
];

const pick3 = async (S) => {
  // The third set picks the first three mains and the first breakfast the picker shows.
  if (!S.food.picks.saved) return;
  const v = await WEB.mealView(S.about, S.food, 'picks');
  const mains = v.picker.tabs.find((t) => t.shelf === 'lunch') || v.picker.tabs.find((t) => t.shelf === 'dinner');
  const bf = v.picker.tabs.find((t) => t.shelf === 'breakfast');
  const keys = [...mains.lists.all.top.slice(0, 3).map((s) => `${mains.planSlot}|${s}`), ...(bf ? [`breakfast|${bf.lists.all.top[0]}`] : [])];
  S.food.picks.keys = keys;
};

const dayView = (plan) => Object.keys(plan.dailyMeals).sort().map((d) => ({ d, meals: plan.dailyMeals[d].meals.map((m) => [m.type, m.time, m.curated_meal_slug, m.plate_id ?? null, m.name, Math.round(m.calories), Math.round(m.macros.protein), Math.round(m.macros.carbs), Math.round(m.macros.fat)].join('|')) }));
const totals = (report) => report.days.map((x) => [x.date, Math.round(x.kcal), Math.round(x.protein)].join('|'));
let fails = 0;
for (const S of SETS) {
  const lines = [];
  try {
    resetClock(); await pick3(S);
    resetClock();
    const w = await WEB.buildMeals(S.about, S.food);
    resetClock();
    const a = await APPRUN(WEB.lockProfileFor(S.about), S.about, S.food);
    const cmp = (label, x, y) => { const sx = JSON.stringify(x), sy = JSON.stringify(y); if (sx !== sy) lines.push(`${label}: web ${sx.slice(0, 300)} | app ${sy.slice(0, 300)}`); };
    cmp('days', dayView(w.plan), dayView(a.plan));
    cmp('totals', totals(w.report), totals(a.report));
    cmp('targets', w.report.targets, a.report.targets);
    cmp('cooks', w.cooks.map((c) => [c.date, c.pots.map((p) => p.name + ' x' + p.tubs)]), (a.plan.batch?.cookDays ?? []).filter((c) => (c.pots ?? []).length).sort((x, y) => (x.date < y.date ? -1 : 1)).map((c) => [c.date, c.pots.map((p) => p.name + ' x' + p.tubs)]));
    cmp('shopping', w.grocery.rows.map((r) => [r.key, r.name, r.amount, r.category]), a.grocery.map((r) => [r.key, r.name, r.amount, r.category]));
    say(`${lines.length ? 'DIFF' : 'same'}  ${S.name}: ${w.report.counts.meals} meals, ${w.cooks.length} cook(s), ${w.grocery.rows.length} shopping rows, app steps ${a.steps.length}`);
  } catch (e) {
    lines.push('threw ' + (e?.stack || e));
  }
  for (const l of lines) { fails++; say('  ' + l); }
}
say(fails ? `${fails} difference(s)` : 'parity OK: the page builds the same week as the app');
process.exit(fails ? 1 : 0);
