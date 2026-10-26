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
  { name: 'man cut gym 4', about: { sex: 'male', ageYears: 34, heightCm: 180, weightKg: 92, bodyFatPct: 25, goalWeightKg: 82, goalBodyFatPct: 13, trainingState: 'consistent', activityLevel: 'light', route: 'lean' }, food: { mealsPerDay: 3, dietPattern: 'any' }, training: { days: 4 } },
  { name: 'woman cut veg 3 home', about: { sex: 'female', ageYears: 41, heightCm: 165, weightKg: 74, bodyFatPct: 34, goalWeightKg: 64, goalBodyFatPct: 26, trainingState: 'new', activityLevel: 'sedentary', route: 'lean' }, food: { mealsPerDay: 3, dietPattern: 'vegetarian', allergies: ['Nuts'] }, training: { days: 3 } },
  { name: 'skinny man gain 6', about: { sex: 'male', ageYears: 22, heightCm: 183, weightKg: 66, bodyFatPct: 12, goalWeightKg: 80, goalBodyFatPct: 13, trainingState: 'new', activityLevel: 'moderate', route: 'bulk' }, food: { mealsPerDay: 4, dietPattern: 'any', snackFrequency: '2', lowAppetite: true }, training: { days: 6 } },
  { name: 'woman gain capped 2 bodyweight', about: { sex: 'female', ageYears: 29, heightCm: 170, weightKg: 58, bodyFatPct: 24, goalWeightKg: 63, goalBodyFatPct: 24, trainingState: 'returning', activityLevel: 'moderate', trainingChoice: 'yes', route: 'capped' }, food: { mealsPerDay: 2, dietPattern: 'pescatarian', allergies: ['Dairy'] }, training: { days: 2, mealsFirst: true } },
  { name: 'vegan man picks', about: { sex: 'male', ageYears: 45, heightCm: 175, weightKg: 85, bodyFatPct: 22, goalWeightKg: 80, goalBodyFatPct: 15, trainingState: 'advanced', activityLevel: 'heavy', route: 'lean' }, food: { mealsPerDay: 3, dietPattern: 'vegan' }, training: { days: 5 } },
  { name: 'defaults, meals first, not training', about: null, food: {}, training: { days: 3, mealsFirst: true } },
];
let fail = 0;
const bad = (m) => { fail++; say('  FAIL', m); };
for (const P of PROFILES) {
  const sex = P.about?.sex || 'male';
  const d = E.defaults(sex);
  const about = P.about || { sex, ageYears: d.ageYears, heightCm: d.heightCm, weightKg: d.weightKg, bodyFatPct: d.bodyFatPct, goalWeightKg: d.goalWeightKg, goalBodyFatPct: d.goalBodyFatPct, trainingState: 'consistent', activityLevel: 'moderate', trainingChoice: 'no', route: 'lean' };
  try {
    const rv = E.routeView(about); const opts = rv.previews;
    const r = await E.buildRoute(about);
    const m = r.macros;
    say(`${P.name}: phase ${r.phase}; ${r.phases.map((p) => `${p.kind}->${p.exitBodyFatPct}%/${p.exitWeightKg ?? '?'}kg ${p.estMonths.join('-')}mo`).join(' | ')}; ${m.calories} kcal P${m.protein} C${m.carbs} F${m.fat}; options ${JSON.stringify(Object.fromEntries(Object.entries(opts).map(([k, v]) => [k, v?.cuts])))}`);
    if (!(m.calories > 1100 && m.calories < 5000)) bad('kcal ' + m.calories);
    if (!r.phases.length) bad('no phases');
    if (!r.curve) bad('no curve');
    // Training first, as the finish line orders it: the answers the workout questions save
    // (training-part.ts buildProgramFrom). The meal questions then count its minutes.
    const st = await E.trainingStart(about);
    const saved = { totalTrainingDays: P.training.days, programDuration: P.training.length || '8_weeks', selectedEquipment: st.defaultEquipment, volumePreference: st.recommendedVolume,
      refinementPresets: [], priorityMuscleGroups: [], auxiliaryMuscles: [], movementLimitations: [], gender: st.sex, includeDirectCore: true, repStyle: 'classic' };
    const w = await E.buildProgramFrom(about, saved);
    const b0 = w.program.blocks[0];
    const exs = b0.days.flatMap((x) => x.exercises);
    const logs = w.views.logs;
    say(`  program: ${w.program.routine_name}, ${w.program.blocks.length} blocks, ${b0.days.filter((x) => x.exercises.length).length} days, ${exs.length} exercises; ${w.views.landingMeta}; hero ${w.views.hero.label}; rest ${logs[0].exercises.slice(0, 3).map((e) => e.rest.moderate).join('/')}s; paces ${JSON.stringify(logs[0].paces)}`);
    if (!exs.length) bad('no exercises');
    if (logs.some((l) => l.exercises.some((e) => !(e.rest?.moderate > 0)))) bad('rest missing');
    const food = { dietType: 'balanced', dietPattern: 'any', allergies: [], skip: [], keepLower: [], sleep: { bed: 1350, wake: 390, strictness: 'moderate', overrides: {} }, mealsPerDay: 3, snackFrequency: 'ai_decide', mealVariety: 'balanced', snacks: { ticked: ['sn_banana', 'sn_greek_yog'], own: [] }, dessertFrequency: '0', dessertDays: [], slowCooker: '5_6l', slowCookerCount: 1, blender: 'yes', freezerTubs: 16, shopCadence: 'weekly', stockUp: false, startDate: 'tomorrow', picks: { saved: false, keys: [], allergenOk: {}, versionChoices: {}, useUp: [] }, ...P.food,
      plan: P.training.mealsFirst ? null : { program: w.program, totalTrainingDays: P.training.days } };
    const sm = (await E.mealView(about, food, 'summary')).summary;
    const known = (await E.mealView(about, food, 'active')).trainingKnown;
    say(`  training counted: ${sm.labels.training} (${sm.answers.trainingMinutesPerWeek} min, ${sm.answers.trainingSessionsPerWeek} sessions)${known ? ', training question skipped' : ''}`);
    if (!P.training.mealsFirst && !known) bad('training question not skipped with a plan');
    if (typeof sm.answers.trainingMinutesPerWeek !== 'number') bad('no training minutes');
    const pv = (await E.mealView(about, food, 'picks')).picker;
    const mainsTab = pv.tabs.find((t) => t.shelf === 'lunch') || pv.tabs.find((t) => t.shelf === 'dinner');
    const grid = { meals: mainsTab.lists.all.top, recommend: pv.mainsRec };
    if (P.name === 'vegan man picks') food.picks = { ...food.picks, saved: true, keys: grid.meals.slice(0, 3).map((s) => mainsTab.planSlot + '|' + s) };
    const meals = await E.buildMeals(about, food);
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
  } catch (e) {
    bad(P.name + ' threw ' + (e?.stack || e));
  }
}
say(fail ? `${fail} failure(s)` : 'all profiles OK');
process.exit(fail ? 1 : 0);
