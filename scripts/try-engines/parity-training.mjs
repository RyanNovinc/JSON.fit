// Parity: the /try/ page's training against the app's own path.
//   node scripts/try-engines/parity-training.mjs <app dir>     (after build.sh)
// Builds parity-app-training.ts (the app's screens' writes and WorkoutBuildScreen's
// build, from the app source, same esbuild stubs) and, for several answer
// sets, diffs its program against the web engine's buildProgramFrom: days,
// exercises, sets, reps, RIR, blocks, deloads, everything in the JSON. Also
// checks what the questions show: Volume's pick, ramp-in line and weekly time
// per tier, Days' minutes on every tile (2 to 6) and the lower-volume
// suggestion's, and what Days opens on (training runs first, so nothing from
// the meal side). Since the volume picker (26 Oct 2026) it also checks every
// Volume step (Minimum, the tiers, a custom number: growth %, weekly time, the
// Less / More trades), Set my own's readout, the Days week line, the summary
// ("Here's your week": rows, Training week, session panel and fixes, and a week
// sheet Save), and the page's port of utils/volumeChoice over every input.
// Exits 1 on any difference.
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

const man = { sex: 'male', ageYears: 34, heightCm: 180, weightKg: 92, bodyFatPct: 25, goalWeightKg: 82, goalBodyFatPct: 13, trainingState: 'consistent', activityLevel: 'light', route: 'lean' };
const woman = { sex: 'female', ageYears: 41, heightCm: 165, weightKg: 74, bodyFatPct: 34, goalWeightKg: 64, goalBodyFatPct: 26, trainingState: 'new', activityLevel: 'sedentary', route: 'lean' };
const lifter = { sex: 'male', ageYears: 22, heightCm: 183, weightKg: 66, bodyFatPct: 12, goalWeightKg: 80, goalBodyFatPct: 13, trainingState: 'advanced', activityLevel: 'moderate', route: 'bulk' };
const back = { sex: 'female', ageYears: 29, heightCm: 170, weightKg: 58, bodyFatPct: 24, goalWeightKg: 63, goalBodyFatPct: 24, trainingState: 'returning', activityLevel: 'moderate', route: 'capped' };
const base = { priority: [], aux: [], avoid: [], core: true, rep: 'classic' };
const SETS = [
  { name: 'man 4 days 8 weeks moderate', about: man, a: { ...base, days: 4, length: '8_weeks', volume: '12-16' } },
  { name: 'new woman 3 days 12 weeks conservative, glutes', about: woman, a: { ...base, days: 3, length: '12_weeks', volume: '8-12', priority: ['Glutes', 'Hamstrings'], rep: 'higher' } },
  { name: 'advanced 6 days 1 year high, mix, avoid', about: lifter, a: { ...base, days: 6, length: '1_year', volume: '16-20', rep: 'mix', aux: ['neck', 'forearms'], avoid: ['Heavy deadlifts', 'Overhead pressing'], core: false } },
  { name: 'returning 2 days 4 weeks, heavier', about: back, a: { ...base, days: 2, length: '4_weeks', volume: '12-16', rep: 'heavier', priority: ['Side Delts', 'Lats', 'Chest'] } },
  { name: '5 days 6 months, injury prevention, own weekdays', about: man, a: { ...base, days: 5, week: [0, 1, 3, 4, 6], length: '6_months', volume: '12-16', aux: ['hip_abductors', 'hip_adductors', 'shins'] } },
  { name: '4 days 8 weeks (opened on), High lowered to Moderate on Days', about: lifter, a: { ...base, days: 4, length: '8_weeks', volume: '16-20', lowerTo: '12-16' } },
  { name: 'Minimum, 3 days 8 weeks', about: man, a: { ...base, days: 3, length: '8_weeks', volume: '4-8' } },
  { name: 'new woman Minimum, 2 days, glutes', about: woman, a: { ...base, days: 2, length: '4_weeks', volume: '4-8', priority: ['Glutes'] } },
  { name: 'Set my own 14, 4 days 12 weeks, 3 priorities', about: man, a: { ...base, days: 4, length: '12_weeks', volume: 'custom', custom: 14, priority: ['Chest', 'Lats', 'Glutes'] } },
  { name: 'Set my own 20 on 2 days, lowered to High on Days', about: lifter, a: { ...base, days: 2, length: '8_weeks', volume: 'custom', custom: 20, lowerTo: '16-20' } },
  { name: 'Set my own 5, summary week sheet: Mon Wed Fri Sat mornings, Rebuild for 4 days', about: back, a: { ...base, days: 3, length: '12_weeks', volume: 'custom', custom: 5, rep: 'higher', sheet: { days: [1, 3, 5, 6], time: 'morning', rebuild: true } } },
  { name: 'Moderate, summary week sheet: days change, 6:15 pm', about: woman, a: { ...base, days: 4, length: '8_weeks', volume: '12-16', sheet: { days: null, time: 'evening', exactMinute: 18 * 60 + 15 } } },
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

// The page's port of utils/volumeChoice (try.js, between the volume-kit markers), against the app's own functions.
const tryJs = readFileSync(path.join(SITE, 'try/try.js'), 'utf8');
const kitSrc = tryJs.slice(tryJs.indexOf('/* volume-kit:start */'), tryJs.indexOf('/* volume-kit:end */'));
const volumeKit = new Function(kitSrc + '\nreturn volumeKit;')();
{
  const st = await E.trainingStart(man);
  const K = volumeKit(st.volume), V = A.VC;
  const vals = ['4-8', '8-12', '12-16', '16-20', 'custom', 'not_sure', null, undefined, 'junk'];
  const nums = [null, undefined, 0, 3, 4, 5, 6, 10, 11, 12, 14, 16, 17, 18, 19, 22, 23, 40, -2, 13.6, '14', ' ', 'x', NaN];
  let n = 0;
  const check = (what, app, web) => { n++; const d = firstDiff(app, web); if (d) { fail++; say(`  DIFF volume kit ${what}: ${d}`); } };
  for (let s = -2; s <= 30; s += 0.5) check(`growthPercent(${s})`, V.growthPercent(s), K.growthPercent(s));
  for (let m = -400; m <= 400; m++) { check(`halfHoursLabel(${m})`, V.halfHoursLabel(m), K.halfHoursLabel(m)); check(`weekTimeDelta(${m})`, V.weekTimeDelta(m), K.weekTimeDelta(m)); }
  for (let a = 0; a <= 24; a++) for (let b = 0; b <= 24; b++) check(`growthDelta(${a},${b})`, V.growthDelta(a, b), K.growthDelta(a, b));
  for (const x of nums) { check(`sanitiseCustomSets(${x})`, V.sanitiseCustomSets(x), K.sanitiseCustomSets(x)); check(`volumeSteps(${x})`, V.volumeSteps(x), K.volumeSteps(x)); }
  for (let k = 0; k <= 25; k++) check(`tierForSets(${k})`, V.tierForSets(k), K.tierForSets(k));
  for (const v of vals) for (const x of nums) {
    check(`sanitiseVolume(${v},${x})`, V.sanitiseVolume(v, x), K.sanitiseVolume(v, x));
    check(`volumeLabel(${v},${x})`, V.volumeLabel(v, x), K.volumeLabel(v, x));
    check(`volumeShortLabel(${v},${x})`, V.volumeShortLabel(v, x), K.volumeShortLabel(v, x));
    check(`lowerVolume(${v},${x})`, V.lowerVolume(v, x), K.lowerVolume(v, x));
    if (v === 'custom' || V.sanitiseVolume(v, x)) check(`volumeOverride(${v},${x})`, JSON.parse(JSON.stringify(V.volumeOverride(v, x))), K.volumeOverride(v, x));
  }
  say(`volume kit: the page's port matches utils/volumeChoice on ${n} inputs${fail ? ' (with differences)' : ''}`);
}

const strip = (q) => { const { lastUpdatedAt, ...r } = q || {}; return r; };
const tileView = (t) => Object.fromEntries(Object.entries(t).map(([n, e]) => [n, e && { headline: e.headline, average: e.average, days: e.days, week: e.week }]));
for (const T of SETS) {
  // The route's lock-in, as RouteScreen saves it (no activity or training yet).
  const profile = E.lockProfileFor(T.about);
  const custom = T.a.volume === 'custom' ? T.a.custom : null;
  // Web: what the page shows and saves (rVolume, ownSheet, rDays, rTrainSummary, savedThrough(4), T.weekOps).
  const st = await E.trainingStart(T.about);
  const K = volumeKit(st.volume), C = st.volume.copy;
  const steps = K.volumeSteps(custom), mins = {};
  for (const s of steps) mins[s.key] = (await E.sessionEstimate(T.about, null, {}, { ...K.volumeOverride(s.value, s.customWeeklySets), totalTrainingDays: st.volumeDays })).week;
  const webQ6 = {
    recommended: st.recommendedVolume, rampsIn: st.rampsIn,
    steps: steps.map((s, i) => {
      const trade = (o) => (o ? `${K.growthDelta(s.sets, o.sets)} · ${K.weekTimeDelta(mins[o.key] - mins[s.key])}` : null);
      return { key: s.key, name: s.name, what: s.what, growth: K.growthPercent(s.sets), pctLink: K.fill(C.pctLink, { n: K.growthPercent(s.sets) }), hours: K.halfHoursLabel(mins[s.key]), less: trade(steps[i - 1]), more: trade(steps[i + 1]) };
    }),
  };
  let webOwn = null;
  if (custom != null) {
    const e = await E.sessionEstimate(T.about, null, {}, { ...K.volumeOverride('custom', custom), totalTrainingDays: st.volumeDays });
    webOwn = { sets: custom, growth: K.growthPercent(custom) + '%', week: K.halfHoursLabel(e.week), use: K.fill(C.ownUse, { n: custom }), tier: K.tierForSets(custom) };
  }
  const vSaved = K.volumeOverride(T.a.volume, custom);
  const webTiles = {};
  for (const n of st.dayOptions) webTiles[n] = await E.sessionEstimate(T.about, vSaved, vSaved, { totalTrainingDays: n, ...K.volumeOverride(T.a.volume, custom) });
  const down = K.lowerVolume(T.a.volume, custom);
  const webDown = down ? await E.sessionEstimate(T.about, vSaved, vSaved, { totalTrainingDays: T.a.days, volumePreference: down }) : null;
  const webQ3 = {
    weekLine: [K.fill(C.daysWeekLine, { name: K.volumeShortLabel(T.a.volume, custom) }), K.fill(C.daysWeekHours, { hours: K.halfHoursLabel(webTiles[T.a.days].week) })],
    cardLabel: K.volumeLabel(T.a.volume, custom), down: webDown && { headline: webDown.headline, average: webDown.average, label: K.volumeLabel(down) },
  };
  const vol = T.a.lowerTo || T.a.volume;
  const state = { priorityMuscles: T.a.priority, auxiliaryMuscles: T.a.aux, includeDirectCore: T.a.core };
  const saved = {
    // savedThrough: the pick, and the number Volume saved (a lower tier on Days keeps it stored).
    ...K.volumeOverride(T.a.volume, custom), volumePreference: vol, totalTrainingDays: T.a.days, programDuration: T.a.length, selectedEquipment: st.defaultEquipment,
    refinementPresets: await E.activePresets(st.sexKey, state), priorityMuscleGroups: T.a.priority, auxiliaryMuscles: T.a.aux, movementLimitations: T.a.avoid,
    ...(st.sex ? { gender: st.sex } : {}), includeDirectCore: T.a.core, repStyle: T.a.rep,
  };
  // The page's week: what Days opened on, unless a number or weekdays were tapped.
  const tapped = T.a.days !== st.start.selected || !!T.a.week;
  const week = tapped ? (T.a.week || await E.weekFor(T.a.days)) : st.start.days;
  const ops = [{ kind: 'days', input: { daysTouched: tapped || st.start.touched, timeTouched: false, hadWeek: st.start.hadWeek, varies: st.start.varies, days: week, selected: T.a.days, time: st.start.time } }];
  // The summary, as rTrainSummary builds it.
  const webSummary = async () => {
    const wr = await E.weekRow(T.about, saved, ops);
    const fixes = await E.summaryFixes(saved);
    const value = { totalTrainingDays: saved.totalTrainingDays, programDuration: saved.programDuration, selectedEquipment: saved.selectedEquipment, volumePreference: saved.volumePreference, customWeeklySets: saved.customWeeklySets,
      priorityMuscleGroups: saved.priorityMuscleGroups || [], auxiliaryMuscles: saved.auxiliaryMuscles || [], movementLimitations: saved.movementLimitations || [], includeDirectCore: saved.includeDirectCore !== false, repStyle: saved.repStyle || 'classic' };
    const res = await E.sessionPanel(T.about, saved, saved, JSON.parse(JSON.stringify(value)), fixes, null);
    return {
      volume: K.volumeLabel(saved.volumePreference, saved.customWeeklySets), days: saved.totalTrainingDays, length: saved.programDuration,
      week: { weekValue: wr.weekValue, timeValue: wr.timeValue, detail: wr.detail }, fixes: fixes.map((f) => ({ key: f.key, label: f.label, note: f.note })),
      panel: { headline: res.est.headline, average: res.est.average, days: res.est.days, longLine: res.longLine, offered: res.offered },
    };
  };
  const webSum = await webSummary();
  let webAfter = null;
  if (T.a.sheet) {
    ops.push({ kind: 'sheet', patch: { days: T.a.sheet.days, time: T.a.sheet.time, exactMinute: T.a.sheet.exactMinute ?? null, asked: true } });
    if (T.a.sheet.rebuild) saved.totalTrainingDays = T.a.sheet.days.length;
    webAfter = await webSummary();
  }
  const web = await E.buildProgramFrom(T.about, saved, ops);
  // App: the screens, from the app source.
  const appQ6 = await A.q6View(profile, custom);
  const appOwn = custom != null ? await A.ownView(profile, custom) : null;
  const appQ3 = await A.q3View(profile, T.a.volume, T.a.days, custom);
  const appStart = await A.q3Start(profile);
  const app = await A.appProgram(profile, T.a);
  const checks = [
    ['answers', firstDiff(strip(app.questionnaire), strip(web.profile.questionnaire))],
    ['program', firstDiff(app.program, web.program)],
    ['notes', firstDiff(app.notes, web.notes)],
    ['Volume screen', firstDiff(appQ6, webQ6)],
    ['Set my own sheet', firstDiff(appOwn, webOwn)],
    ['Days tiles', firstDiff(tileView(appQ3.tiles), tileView(webTiles))],
    ['Days week line, card and lower-volume suggestion', firstDiff({ weekLine: appQ3.weekLine, cardLabel: appQ3.cardLabel, down: appQ3.down }, webQ3)],
    ['Days opens on', firstDiff(appStart, st.start)],
    ['summary', firstDiff(app.summary, webSum)],
    ['summary after the week sheet', firstDiff(app.after, webAfter)],
  ];
  const cur = appQ6.steps.find((s) => s.key === (custom != null && !K.tierForSets(custom) ? 'custom' : T.a.volume));
  say(`${T.name}: ${shape(app.program)} | Volume ${cur.name} ${cur.growth}% ${cur.hours} (${appQ6.steps.map((s) => s.hours).join(' / ')}) | Days ${appQ3.weekLine.join(' ')}, tiles ${Object.values(appQ3.tiles).map((e) => e.headline).join('/')} min${appQ3.down ? `, ${appQ3.down.label} ${appQ3.down.headline}` : ''} | summary ${app.summary.volume}, ${app.summary.week.weekValue}, ${app.summary.panel.headline} min${app.summary.panel.offered.length ? ' + ' + app.summary.panel.offered.map((f) => f.label).join(', ') : ''}${app.after ? ` -> sheet ${app.after.week.weekValue} ${app.after.week.timeValue}, ${app.after.days} days` : ''}`);
  for (const [what, d] of checks) if (d) { fail++; say(`  DIFF ${what}: ${d}`); }
}
say(fail ? `${fail} difference(s)` : 'training parity OK: the web program is the app\'s, exactly');
process.exit(fail ? 1 : 0);
