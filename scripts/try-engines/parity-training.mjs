// Parity: the /try/ page's training against the app's own path.
//   node scripts/try-engines/parity-training.mjs <app dir>     (after build.sh)
// Builds parity-app-training.ts (the app's screens' writes and WorkoutBuildScreen's
// build, from the app source, same esbuild stubs) and, for several answer
// sets, diffs its program against the web engine's buildProgramFrom: days,
// exercises, sets, reps, RIR, blocks, deloads, everything in the JSON. Also
// checks the Days screen's live session length. Exits 1 on any difference.
import { createRequire } from 'node:module';
import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
const require = createRequire(import.meta.url);
const HERE = path.dirname(new URL(import.meta.url).pathname);
const SITE = path.resolve(HERE, '../..');
const APP = path.resolve(process.argv[2] || '');
if (!process.argv[2]) { console.error('usage: parity-training.mjs <app dir>'); process.exit(2); }
const S = path.join(SITE, 'scripts/app-meals/stubs');
const OUT = path.join(HERE, 'out');
writeFileSync(path.join(OUT, 'parity-app-training.ts'), readFileSync(path.join(HERE, 'parity-app-training.ts'), 'utf8').replace(/APP_DIR/g, APP));
execFileSync('npx', ['esbuild', path.join(OUT, 'parity-app-training.ts'), '--bundle', '--log-level=warning', '--platform=node', '--format=cjs', `--outfile=${path.join(OUT, 'parity-app-training.cjs')}`,
  `--alias:react-native=${S}/rn.js`, `--alias:@react-native-async-storage/async-storage=${S}/asyncstorage.js`, `--alias:expo-notifications=${S}/empty.js`,
  `--alias:expo-file-system=${S}/fs`, `--alias:react=${S}/react.js`, `--alias:@react-navigation/native=${S}/nav.js`,
  '--define:process.env.EXPO_PUBLIC_WORKOUT_GENERATOR="1"', '--define:__DEV__=false'], { cwd: APP, stdio: 'inherit' });
const say = (...a) => process.stdout.write(a.join(' ') + '\n');
console.log = () => {}; console.warn = () => {}; console.error = () => {};
// Two bundles, two in-memory storages: run one side at a time and never interleave.
require(path.join(OUT, 'engines.cjs'));
const E = globalThis.JsonFitEngines;
require(path.join(OUT, 'parity-app-training.cjs'));
const A = globalThis.AppTraining;

const man = { sex: 'male', ageYears: 34, heightCm: 180, weightKg: 92, bodyFatPct: 25, goalWeightKg: 82, goalBodyFatPct: 13, trainingState: 'consistent', activityLevel: 'light', trainingSessionsPerWeek: 3.5, route: 'lean' };
const woman = { sex: 'female', ageYears: 41, heightCm: 165, weightKg: 74, bodyFatPct: 34, goalWeightKg: 64, goalBodyFatPct: 26, trainingState: 'new', activityLevel: 'sedentary', trainingSessionsPerWeek: 1.5, route: 'lean' };
const lifter = { sex: 'male', ageYears: 22, heightCm: 183, weightKg: 66, bodyFatPct: 12, goalWeightKg: 80, goalBodyFatPct: 13, trainingState: 'advanced', activityLevel: 'moderate', trainingSessionsPerWeek: 5.5, route: 'bulk' };
const back = { sex: 'female', ageYears: 29, heightCm: 170, weightKg: 58, bodyFatPct: 24, goalWeightKg: 63, goalBodyFatPct: 24, trainingState: 'returning', activityLevel: 'moderate', trainingSessionsPerWeek: 1.5, route: 'capped' };
const base = { priority: [], aux: [], avoid: [], core: true, rep: 'classic' };
const SETS = [
  { name: 'man 4 days 8 weeks moderate', about: man, a: { ...base, days: 4, length: '8_weeks', volume: '12-16' } },
  { name: 'new woman 3 days 12 weeks conservative, glutes', about: woman, a: { ...base, days: 3, length: '12_weeks', volume: '8-12', priority: ['Glutes', 'Hamstrings'], rep: 'higher' } },
  { name: 'advanced 6 days 1 year high, mix, avoid', about: lifter, a: { ...base, days: 6, length: '1_year', volume: '16-20', rep: 'mix', aux: ['neck', 'forearms'], avoid: ['Heavy deadlifts', 'Overhead pressing'], core: false } },
  { name: 'returning 2 days 4 weeks, heavier', about: back, a: { ...base, days: 2, length: '4_weeks', volume: '12-16', rep: 'heavier', priority: ['Side Delts', 'Lats', 'Chest'] } },
  { name: '7 days 6 months, injury prevention', about: man, a: { ...base, days: 7, length: '6_months', volume: '12-16', aux: ['hip_abductors', 'hip_adductors', 'shins'] } },
  { name: '1 day 8 weeks', about: woman, a: { ...base, days: 1, length: '8_weeks', volume: '8-12' } },
];

function firstDiff(a, b, p = '') {
  if (JSON.stringify(a) === JSON.stringify(b)) return null;
  if (typeof a !== 'object' || typeof b !== 'object' || !a || !b) return `${p || '(root)'}: app ${JSON.stringify(a)?.slice(0, 80)} vs web ${JSON.stringify(b)?.slice(0, 80)}`;
  for (const k of new Set([...Object.keys(a), ...Object.keys(b)])) { const d = firstDiff(a[k], b[k], p + '.' + k); if (d) return d; }
  return `${p}: key order`;
}
function shape(prog) {
  const b0 = prog.blocks[0];
  const exs = b0.days.flatMap((d) => d.exercises);
  return `${prog.blocks.length} blocks, ${b0.days.filter((d) => d.exercises.length).length} days, ${exs.length} exercises, wk1 sets ${exs.reduce((t, e) => t + (+e.sets_weekly?.['1'] || 0), 0)}, deloads ${prog.blocks.map((b) => (b.deload_weeks || []).join('/') || '-').join(' ')}`;
}
let fail = 0;
for (const T of SETS) {
  const route = await E.buildRoute(T.about);
  const profile = route.profile;
  // Web: the page's answers, as the page saves them (savedThrough(4)).
  const st = await E.trainingStart(T.about);
  const state = { priorityMuscles: T.a.priority, auxiliaryMuscles: T.a.aux, includeDirectCore: T.a.core };
  const saved = {
    totalTrainingDays: T.a.days, programDuration: T.a.length, selectedEquipment: st.defaultEquipment, volumePreference: T.a.volume,
    refinementPresets: await E.activePresets(st.sexKey, state), priorityMuscleGroups: T.a.priority, auxiliaryMuscles: T.a.aux, movementLimitations: T.a.avoid,
    ...(st.sex ? { gender: st.sex } : {}), includeDirectCore: T.a.core, repStyle: T.a.rep,
  };
  const web = await E.buildProgramFrom(T.about, saved, { daysTouched: false, timeTouched: false, hadWeek: false, varies: false, days: null, selected: T.a.days, time: null });
  const webPanel = await E.sessionPanel(T.about, null, {}, { totalTrainingDays: T.a.days });
  const app = await A.appProgram(profile, T.a);
  const appQ3 = await A.q3Estimate(profile, T.a.days);
  const strip = (q) => { const { lastUpdatedAt, ...r } = q || {}; return r; };
  const dq = firstDiff(strip(app.questionnaire), strip(web.profile.questionnaire));
  const dp = firstDiff(app.program, web.program);
  const dn = firstDiff(app.notes, web.notes);
  const de = firstDiff({ days: appQ3.days, headline: appQ3.headline }, { days: webPanel.est.days, headline: webPanel.est.headline });
  say(`${T.name}: ${shape(app.program)} | Q3 about ${appQ3.headline} min`);
  for (const [what, d] of [['answers', dq], ['program', dp], ['notes', dn], ['Q3 session length', de]]) if (d) { fail++; say(`  DIFF ${what}: ${d}`); }
}
say(fail ? `${fail} difference(s)` : 'training parity OK: the web program is the app\'s, exactly');
process.exit(fail ? 1 : 0);
