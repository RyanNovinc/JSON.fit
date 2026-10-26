// Runs profiles through the node build of the /try/ engines and checks the numbers.
//   node scripts/try-engines/smoke.mjs     (after build.sh)
import { createRequire } from 'node:module';
import path from 'node:path';
import { readFileSync, existsSync } from 'node:fs';
const require = createRequire(import.meta.url);
const HERE = path.dirname(new URL(import.meta.url).pathname);
const SITE = path.resolve(HERE, '../..');
const quiet = process.argv.includes('-v') ? null : console.log;
if (quiet) console.log = () => {};
const say = (...a) => process.stdout.write(a.join(' ') + '\n');
console.warn = () => {}; console.error = () => {};
require(path.join(HERE, 'out/engines.cjs'));
const E = globalThis.JsonFitEngines;
const index = JSON.parse(readFileSync(path.join(SITE, 'try/meal-index.json'), 'utf8'));
const PROFILES = [
  { name: 'man cut gym 4', about: { sex: 'male', ageYears: 34, heightCm: 180, weightKg: 92, bodyFatPct: 25, goalWeightKg: 82, goalBodyFatPct: 13, trainingState: 'consistent', activityLevel: 'light', trainingSessionsPerWeek: 3.5, route: 'lean' }, food: { mealsPerDay: 3, dietPattern: 'any' }, training: { days: 4, equipment: 'commercial_gym' } },
  { name: 'woman cut veg 3 home', about: { sex: 'female', ageYears: 41, heightCm: 165, weightKg: 74, bodyFatPct: 34, goalWeightKg: 64, goalBodyFatPct: 26, trainingState: 'new', activityLevel: 'sedentary', trainingSessionsPerWeek: 1.5, route: 'lean' }, food: { mealsPerDay: 3, dietPattern: 'vegetarian', allergies: ['Nuts'] }, training: { days: 3, equipment: 'home_gym' } },
  { name: 'skinny man gain 6', about: { sex: 'male', ageYears: 22, heightCm: 183, weightKg: 66, bodyFatPct: 12, goalWeightKg: 80, goalBodyFatPct: 13, trainingState: 'new', activityLevel: 'moderate', trainingSessionsPerWeek: 5.5, route: 'bulk' }, food: { mealsPerDay: 4, dietPattern: 'any', snackFrequency: '2' }, training: { days: 6, equipment: 'commercial_gym' } },
  { name: 'woman gain capped 2 bodyweight', about: { sex: 'female', ageYears: 29, heightCm: 170, weightKg: 58, bodyFatPct: 24, goalWeightKg: 63, goalBodyFatPct: 24, trainingState: 'returning', activityLevel: 'moderate', trainingSessionsPerWeek: 1.5, route: 'capped' }, food: { mealsPerDay: 2, dietPattern: 'pescatarian', allergies: ['Dairy'] }, training: { days: 2, equipment: 'bodyweight' } },
  { name: 'vegan man picks', about: { sex: 'male', ageYears: 45, heightCm: 175, weightKg: 85, bodyFatPct: 22, goalWeightKg: 80, goalBodyFatPct: 15, trainingState: 'advanced', activityLevel: 'heavy', trainingSessionsPerWeek: 3.5, route: 'lean' }, food: { mealsPerDay: 3, dietPattern: 'vegan' }, training: { days: 5, equipment: 'basic_equipment' } },
  { name: 'defaults', about: null, food: {}, training: { days: 3 } },
];
let fail = 0;
const bad = (m) => { fail++; say('  FAIL', m); };
for (const P of PROFILES) {
  const sex = P.about?.sex || 'male';
  const d = E.defaults(sex);
  const about = P.about || { sex, ageYears: d.ageYears, heightCm: d.heightCm, weightKg: d.weightKg, bodyFatPct: d.bodyFatPct, goalWeightKg: d.goalWeightKg, goalBodyFatPct: d.goalBodyFatPct, trainingState: 'consistent', activityLevel: 'moderate', trainingSessionsPerWeek: 3.5, route: 'lean' };
  try {
    const rv = E.routeView(about); const opts = rv.previews;
    const r = await E.buildRoute(about);
    const m = r.macros;
    say(`${P.name}: phase ${r.phase}; ${r.phases.map((p) => `${p.kind}->${p.exitBodyFatPct}%/${p.exitWeightKg ?? '?'}kg ${p.estMonths.join('-')}mo`).join(' | ')}; ${m.calories} kcal P${m.protein} C${m.carbs} F${m.fat}; options ${JSON.stringify(Object.fromEntries(Object.entries(opts).map(([k, v]) => [k, v?.cuts])))}`);
    if (!(m.calories > 1100 && m.calories < 5000)) bad('kcal ' + m.calories);
    if (!r.phases.length) bad('no phases');
    if (!r.curve) bad('no curve');
    const grid = E.mainsGrid({ dietPattern: P.food.dietPattern, allergies: P.food.allergies });
    const picks = P.name === 'vegan man picks' ? grid.meals.slice(0, 3).map((x) => x.slug) : [];
    const meals = await E.buildMeals(about, { ...P.food, picks });
    const days = Object.values(meals.plan.dailyMeals);
    const t = meals.report.targets;
    const inBand = meals.report.days.filter((x) => x.kcal >= t.kcalLo && x.kcal <= t.kcalHi && x.protein >= t.proteinLo).length;
    say(`  meals ${meals.ms} ms: ${days.length} days, ${meals.report.counts.meals} meals, ${inBand}/7 days in kcal+protein band, misses ${JSON.stringify(meals.report.misses)}; grid ${grid.meals.length} (recommend ${grid.recommend}); cooks ${meals.cooks.map((c) => c.date + ': ' + c.pots.map((p) => p.name).join(' + ') + ' ' + c.handsOnMinutes + ' min ' + c.tubs + ' tubs').join('; ') || 'none'}; ${meals.week?.headline}; grocery ${meals.grocery.rows.length} rows`);
    if (days.length !== 7) bad('days ' + days.length);
    const slugs = new Set(); days.forEach((dd) => dd.meals.forEach((x) => slugs.add(x.curated_meal_slug)));
    const noPhoto = [...slugs].filter((s) => !index[s]?.i);
    if (noPhoto.length) say('  no photo:', noPhoto.join(', '));
    if (P.food.dietPattern === 'vegetarian' || P.food.dietPattern === 'vegan') say('  slugs:', [...slugs].join(', '));
    for (const s of [...slugs]) if (index[s]?.i && !existsSync(path.join(SITE, 'images/meals', index[s].i + '.webp'))) bad('missing image ' + s);
    if (!meals.grocery.rows.length) bad('no grocery');
    const w = await E.buildProgram(about, P.training);
    const b0 = w.program.blocks[0];
    const exs = b0.days.flatMap((x) => x.exercises);
    say(`  program: ${w.program.routine_name}, ${w.program.blocks.length} blocks, ${b0.days.length} days, ${exs.length} exercises, rest ${exs.slice(0, 3).map((e) => e._restSec).join('/')}s, appBuildsGym ${w.appBuildsGym}; volume ${JSON.stringify(w.volume).slice(0, 160)}`);
    if (!exs.length) bad('no exercises');
    if (exs.some((e) => !(e._restSec > 0))) bad('rest missing');
  } catch (e) {
    bad(P.name + ' threw ' + (e?.stack || e));
  }
}
say(fail ? `${fail} failure(s)` : 'all profiles OK');
process.exit(fail ? 1 : 0);
