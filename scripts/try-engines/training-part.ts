// Training for the /try/ page: the workout questions' live numbers and the
// program build, all from the app's own code. See entry.ts.
//
// The path is the app's (the next build: release 1.0.44 + release/integration,
// WORKOUT_GENERATOR on), from the onboarding finish line: Volume (Q6Volume,
// first since 24 Oct 2026) -> Days (Q3DaysPerWeek) -> How long
// (Q4ProgramDuration) -> Refinements -> the summary ("Here's your week",
// since 26 Oct 2026; the volume picker adds Minimum and a custom number) ->
// WorkoutBuild. Each screen saves its
// answer with updateQuestionnaireField, Days also saves the training week
// (daysScreenPatch), Q4 also saves the default equipment
// (Equipment left the flow), Refinements saves its fields, and WorkoutBuild
// reads them back with loadWorkoutProfile() and runs generateProgramAsync on
// them. The route's profile comes from storage too (locked there as
// RouteScreen does, entry.ts), so experience comes from the same trainingState.
// Training runs before meals, as the finish line orders it ("Next: my
// training"), so the profile has no activity or training sessions yet and the
// Days question opens on nothing the meal side said.
// @ts-nocheck

import { loadWorkoutProfile } from 'APP_DIR/src/utils/workoutGenerator';
import { generateProgramAsync } from 'APP_DIR/src/utils/workoutGenerator/generateProgram';
import { buildView } from 'APP_DIR/src/utils/workoutGenerator/display';
import { updateQuestionnaireField } from 'APP_DIR/src/utils/questionnaireStorage';
import { DEFAULT_EQUIPMENT, workoutStep } from 'APP_DIR/src/utils/questionnaireRouting';
import { builtFromStamp } from 'APP_DIR/src/utils/setupHub';
import { normalizeDeloadWeeks } from 'APP_DIR/src/utils/deloadWeeks';
import { daysScreenStart, daysScreenPatch, updateTrainingWeek, sanitiseTrainingWeek, ROUGH_LABEL, daysLabel as weekDaysLabel } from 'APP_DIR/src/utils/trainingWeek';
import { daysForCount, sortMonFirst, toggleTrainingDay } from 'APP_DIR/src/utils/weekStrip';
import {
  buildEstimateProfile, estimateSessionLength, sessionHeadSub, rampLine, sessionAssumptions, assumptionLine,
  longSessionLine, sessionLengthTone, usefulFixes, sessionDeltaLine, daysLabel, VOLUME_LABEL, volumeTypicalSets,
  volumePrioritySets, lowerVolume, refinementsDeltaLine,
  estimateDays, LONG_SESSION_MIN, FIX_MIN_SAVING, MIN_DAYS, MAX_DAYS, DEFAULT_DAYS,
} from 'APP_DIR/src/utils/sessionLengthEstimate';
import { weeklyMinutes, hoursLabel } from 'APP_DIR/src/hooks/useSessionEstimates';
import { VOLUME_COPY, TIER_COPY } from 'APP_DIR/src/data/volumeCopy';
import {
  TIER_VALUES, TIER_SETS, CUSTOM_SETS_MIN, CUSTOM_SETS_MAX, GROWTH_TOP_SETS, CUSTOM_VOLUME,
  recommendedVolume, volumeOverride,
} from 'APP_DIR/src/utils/volumeChoice';
import {
  moreDaysOptions, moreDaysNote, lowerVolumeNote, fewerPriorities, FEWER_PRIORITIES_KEEP,
} from 'APP_DIR/src/utils/sessionLengthEstimate';
import { clockLabel, sessionsForDays, ROUGH_START, DEFAULT_START } from 'APP_DIR/src/utils/trainingWeek';
import { rampsIn } from 'APP_DIR/src/utils/workoutGenerator/check';
import { trainingDayCount } from 'APP_DIR/src/utils/blockProgress';
import { REFINEMENT_PRESETS, applyPreset, removePreset, isPresetActive, presetSexKey } from 'APP_DIR/src/data/refinementPresets';
import { REP_STYLE_OPTIONS, REP_STYLE_LEAD, normalizeRepStyle } from 'APP_DIR/src/data/repStyles';
import { prepareDecisions, REP_STYLE_EVIDENCE, repStyleEvidenceContext } from 'APP_DIR/src/utils/evidenceContext';
import { CONFIDENCE_LABEL } from 'APP_DIR/src/data/evidence';
import { loadGoalsProfile } from 'APP_DIR/src/utils/goalsProfileStorage';
import { WorkoutStorage } from 'APP_DIR/src/utils/storage';
import { loadTrainingWeek, trainingOn, usualStartMinute } from 'APP_DIR/src/utils/trainingWeek';
import { nextTrainingDay } from 'APP_DIR/src/utils/weekStrip';
import { heroTodayState, weekDaysLink } from 'APP_DIR/src/utils/workoutsHero';
import { sessionCardLabels } from 'APP_DIR/src/utils/sessionCards';
import { todayShort } from 'APP_DIR/src/utils/todayLabel';
import { buildBlockCard } from 'APP_DIR/src/utils/homeTraining';
import { workoutSummary } from 'APP_DIR/src/components/import/importBuild';
import { isRestDayName } from 'APP_DIR/src/utils/restDay';
import { blockWeekCount, blockRowMeta, splitBlockName, rowOverline, blockPlanOverline } from 'APP_DIR/src/utils/planOverview';
import { estimateDayMinutes, dayMinutes, sessionMinutes, dayTimeExercises, setsForWeek } from 'APP_DIR/src/utils/sessionTime';
import { rirForSets, summarizeRir } from 'APP_DIR/src/utils/rirTargets';
import { resolveRest } from 'APP_DIR/src/utils/restResolver';
import { PACE_EXPLAINERS, PACE_FOOTER, PACE_SWITCH_NOTE, REST_REFERENCES, doiUrl } from 'APP_DIR/src/data/restPaceCopy';
import { getExerciseCue } from 'APP_DIR/src/data/exerciseCues';
import { blockRepStyle, repStyleOption } from 'APP_DIR/src/data/repStyles';
import { rawBlockSummary } from 'APP_DIR/src/utils/workoutGenerator/check';
import { trainingEvidenceContext } from 'APP_DIR/src/utils/evidenceContext';

/**
 * VOLUME_COPY as data the worker can post: each wording function is called
 * with a placeholder ({n}, {name}, {hours}), which the page fills in. The
 * words are the app's, verbatim (data/volumeCopy.ts).
 */
function volumeCopyData() {
  const out: any = {};
  const arg: Record<string, string> = { pctLink: '{n}', ownUse: '{n}', ownMin: '{n}', ownMax: '{n}', customWhat: '{n}', daysWeekLine: '{name}', daysWeekHours: '{hours}' };
  for (const [k, v] of Object.entries(VOLUME_COPY)) out[k] = typeof v === 'function' ? (v as any)(arg[k] ?? '{x}') : v;
  return out;
}

/** RefinementsScreen's chip lists (private there). */
const AUX_TITLES: Record<string, string> = {
  neck: 'Neck', forearms: 'Forearms', obliques: 'Obliques', serratus: 'Serratus',
  lower_back: 'Lower back', hip_abductors: 'Hip abductors', hip_adductors: 'Hip adductors', shins: 'Shins',
};
const auxTitle = (v: string) => AUX_TITLES[v] ?? v;

/** The order the screens save their answers in (each one an updateQuestionnaireField): Volume, Days, How long, Refinements. */
const SAVE_ORDER = [
  'volumePreference', 'customWeeklySets', 'totalTrainingDays', 'programDuration', 'selectedEquipment',
  'refinementPresets', 'priorityMuscleGroups', 'auxiliaryMuscles', 'movementLimitations', 'gender', 'includeDirectCore', 'repStyle',
];

let routeFor: (about: any) => Promise<any> = async () => { throw new Error('training: no route builder'); };
let ready = '';
const AS = require('@react-native-async-storage/async-storage');
const READY_KEY = '@try_training_ready';

/**
 * Storage as the app has it when the workout questions open: the route locked
 * (RouteScreen), and the answers the earlier workout screens saved, field by
 * field in screen order.
 */
async function storageFor(about: any, saved: any) {
  const key = JSON.stringify([about, saved]);
  // The meal and route builds wipe the same storage, so the marker lives in it.
  if (ready === key && (await AS.getItem(READY_KEY)) === key) return;
  ready = '';
  await routeFor(about); // wipes storage, saves and locks the route's profile
  for (const f of SAVE_ORDER) if (saved && saved[f] !== undefined) await updateQuestionnaireField(f as any, saved[f]);
  await AS.setItem(READY_KEY, key);
  ready = key;
}

/** Keys that change nothing in a build (the save stamp). */
function profileKey(p: any) {
  const { lastUpdatedAt, ...q } = p.questionnaire || {};
  return JSON.stringify([q, p.goalsProfile?.trainingState]);
}
const cache = new Map<string, any>();
function estimate(p: any) {
  const k = profileKey(p);
  if (cache.has(k)) return cache.get(k);
  const est = estimateSessionLength(p);
  if (cache.size > 60) cache.delete(cache.keys().next().value);
  cache.set(k, est);
  return est;
}

/**
 * What the workout questions open on, and the screens' fixed lists. Days
 * (Q3DaysPerWeekScreen) opens on the stored week, else a meal-side sessions
 * answer, else DEFAULT_DAYS, kept to 2 to 6 (a stored 1 or 7 opens as 2 or 6
 * and counts as changed, so it is saved so).
 */
async function daysOpening(answered?: number) {
  const profile = await loadGoalsProfile();
  const raw = await WorkoutStorage.loadTrainingWeek().catch(() => null);
  const w = raw ? sanitiseTrainingWeek(raw) : null;
  const start = daysScreenStart(answered, w as any, profile?.trainingSessionsPerWeek);
  const n = estimateDays(start.selected);
  const off = start.selected !== n || (start.days && start.days.length !== n);
  return {
    selected: n,
    days: off ? daysForCount(n) : start.days ? sortMonFirst(start.days) : daysForCount(n),
    varies: start.varies, time: start.time, touched: !!off, hadWeek: !!w?.asked,
  };
}

/**
 * Days opened again from the summary (edit mode): the stored week after the
 * writes so far, and the answer, as its load effect reads them.
 */
async function daysStart(about: any, saved: any, week: any, answered?: number) {
  ready = '';
  await storageFor(about, saved);
  await applyWeek(week);
  const out = await daysOpening(answered);
  ready = '';
  return out;
}

async function trainingStart(about: any) {
  await storageFor(about, null);
  const profile = await loadGoalsProfile();
  const opening = await daysOpening(undefined);
  const base = await loadWorkoutProfile();
  const prepared = prepareDecisions('training', repStyleEvidenceContext());
  const keep = (p: any) => REP_STYLE_EVIDENCE.includes(p.decision.id);
  const repEvidence = (prepared.featured.filter(keep).length ? prepared.featured.filter(keep) : prepared.all.filter(keep)).map((p: any) => ({
    id: p.decision.id, title: p.title, why: p.decision.why, found: p.decision.found, confidence: p.decision.confidence, forYou: p.forYou,
    sources: p.decision.sources.map((s: any) => ({ cite: s.cite, journal: s.journal, design: s.design, url: s.url, checked: s.checked })),
  }));
  return {
    start: opening,
    sex: profile?.sex ?? null,
    sexKey: presetSexKey(profile?.sex),
    recommendedVolume: recommendedVolume(profile?.trainingState),
    // The volume picker (26 Oct 2026): the copy, the tiers and the slider's ends (utils/volumeChoice).
    volume: {
      copy: volumeCopyData(), tierCopy: TIER_COPY, tierValues: TIER_VALUES, tierSets: TIER_SETS,
      min: CUSTOM_SETS_MIN, max: CUSTOM_SETS_MAX, top: GROWTH_TOP_SETS, custom: CUSTOM_VOLUME,
    },
    // TrainingWeekSheet: the rough times' starts, the exact time's clock labels (5 am to 10 pm, 15 min steps), plan sessions per day count.
    weekSheet: {
      roughStart: ROUGH_START, defaultStart: DEFAULT_START,
      clock: Object.fromEntries(Array.from({ length: (22 - 5) * 4 + 1 }, (_, i) => 5 * 60 + i * 15).map((m) => [m, clockLabel(m)])),
      sessionsFor: Object.fromEntries([1, 2, 3, 4, 5, 6, 7].map((n) => [n, sessionsForDays(n)])),
    },
    // Q6: the reassurance line, and the days its weekly times are worked out at.
    rampsIn: rampsIn(base?.goalsProfile?.trainingState),
    volumeDays: estimateDays(base?.questionnaire?.totalTrainingDays),
    // Q3: what the tiles offer and when a suggestion shows.
    dayOptions: Array.from({ length: MAX_DAYS - MIN_DAYS + 1 }, (_, i) => MIN_DAYS + i),
    minDays: MIN_DAYS, maxDays: MAX_DAYS, defaultDays: DEFAULT_DAYS,
    longMin: LONG_SESSION_MIN, fixMinSaving: FIX_MIN_SAVING,
    volumeLabel: VOLUME_LABEL,
    lowerVolume: Object.fromEntries(['4-8', '8-12', '12-16', '16-20'].map((v) => [v, lowerVolume(v)])),
    steps: ['Q6Volume', 'Q3DaysPerWeek', 'Q4ProgramDuration'].map((r) => workoutStep(r as any).label),
    roughTimes: (['morning', 'midday', 'evening', 'varies']).map((k) => ({ key: k, label: ROUGH_LABEL[k] })),
    presets: REFINEMENT_PRESETS,
    repStyles: REP_STYLE_OPTIONS,
    repLead: REP_STYLE_LEAD,
    repEvidence,
    confidenceLabel: CONFIDENCE_LABEL,
    defaultEquipment: DEFAULT_EQUIPMENT,
  };
}

/** The training week strip: a count fills it with the usual spread, a tap flips a day. */
const weekFor = (n: number) => daysForCount(n);
const toggleDay = (days: number[], dow: number) => toggleTrainingDay(days || [], dow);
const weekLabel = (days: number[] | null, count: number | null) => weekDaysLabel(days && days.length ? days : null, count);

/**
 * SessionLengthPanel, one run: the profile the plan would be built from now,
 * its block 1 minutes, the assumption line, and (when long) each fix's minutes.
 * `saved` is what earlier screens stored (loadWorkoutProfile at screen open),
 * `answers` the route params, `value` this screen's in-progress answer,
 * `delta` the screen's describeChange inputs.
 */
async function sessionPanel(about: any, saved: any, answers: any, value: any, fixes: any[] = [], delta: any = null) {
  await storageFor(about, saved);
  const base = await loadWorkoutProfile();
  const profile = buildEstimateProfile(base, answers, value);
  const repStyle = profile.questionnaire?.repStyle;
  const assumed = assumptionLine(sessionAssumptions({ ...(base?.questionnaire ?? {}), ...(answers ?? {}), ...value }, base?.goalsProfile?.trainingState));
  const est = estimate(profile);
  if (!est) return null;
  let deltaLine = null;
  if (delta && delta.prev && JSON.stringify(delta.prev) !== JSON.stringify(value)) {
    if (delta.kind === 'days') deltaLine = sessionDeltaLine(delta.prevAvg, est.average, daysLabel(delta.prev.totalTrainingDays));
    else if (delta.kind === 'volume') deltaLine = sessionDeltaLine(delta.prevAvg, est.average, VOLUME_LABEL[delta.prev.volumePreference] ?? 'before');
    else if (delta.kind === 'summary') deltaLine = sessionDeltaLine(delta.prevAvg, est.average, 'before');
    else if (delta.kind === 'refine') deltaLine = refinementsDeltaLine(delta.prev, value, delta.prevAvg, est.average, auxTitle);
  }
  let offered: any[] = [];
  if (fixes.length && sessionLengthTone(est.average) !== 'ok') {
    const ests: any = {};
    for (const f of fixes) {
      const fe = estimate(buildEstimateProfile(base, answers, { ...value, ...f.override }));
      if (fe) ests[f.key] = fe;
    }
    offered = usefulFixes(est.average, fixes, ests).map((f: any) => ({ key: f.key, label: f.label, note: f.note, headline: f.est.headline }));
  }
  return {
    est: { days: est.days, average: est.average, headline: est.headline, rampWeeks: est.rampWeeks },
    tone: sessionLengthTone(est.average),
    headSub: sessionHeadSub(repStyle),
    repStyle,
    longLine: longSessionLine(est.average, offered.length > 0),
    offered,
    ramp: rampLine(est.rampWeeks),
    assumed,
    delta: deltaLine,
  };
}

/**
 * useSessionEstimates, one variant: block 1 of the real build for the saved
 * answers + answersSoFar + this override (buildEstimateProfile), with the
 * week's minutes and hours label Volume shows (weeklyMinutes, hoursLabel).
 * The page runs the variants one at a time, in the screen's order.
 */
async function sessionEstimate(about: any, saved: any, answers: any, override: any) {
  await storageFor(about, saved);
  const base = await loadWorkoutProfile();
  const est = estimate(buildEstimateProfile(base, answers, override));
  if (!est) return null;
  const week = weeklyMinutes(est);
  return { days: est.days, average: est.average, headline: est.headline, rampWeeks: est.rampWeeks, week, hours: week == null ? null : hoursLabel(week) };
}

/**
 * Q6's sets line, now in the "What does N% mean?" sheet under How we set this
 * (Q6VolumePreferenceScreen setsLine): "most muscles get 10 to 14 sets a week."
 * One per step (`steps`: [{ key, value, customWeeklySets? }]), for this user.
 */
async function volumeLines(about: any, saved: any, answers: any, steps: any[]) {
  await storageFor(about, saved);
  const base = await loadWorkoutProfile();
  const out: any = {};
  for (const s of steps || []) {
    const profile = buildEstimateProfile(base, answers, volumeOverride(s.value, s.customWeeklySets));
    const [lo, hi] = volumeTypicalSets(profile, s.value);
    const pri = volumePrioritySets(profile, s.value);
    const most = lo === hi ? `most muscles get about ${lo} sets a week` : `most muscles get ${lo} to ${hi} sets a week`;
    if (!pri) { out[s.key] = `${most}.`; continue; }
    const who = pri.count === 1 ? 'your priority muscle' : `your ${pri.count} priority muscles`;
    out[s.key] = `${most}, ${who} ${pri.lo} to ${pri.hi}.`;
  }
  return { lines: out };
}

/**
 * The summary's ("Here's your week") ways to shorten long sessions
 * (QuestionnaireSummaryScreen summaryFixes): one step less volume, one more
 * day, fewer priority muscles. `act` says which question a tap opens.
 */
function summaryFixes(a: any) {
  const out: any[] = [];
  const down = lowerVolume(a.volumePreference, a.customWeeklySets);
  if (down) out.push({ key: 'volume-down', override: { volumePreference: down }, label: `${VOLUME_LABEL[down]} volume`, note: lowerVolumeNote(down), act: 'volume', v: down });
  for (const n of moreDaysOptions(a.totalTrainingDays, 1)) {
    out.push({ key: `days-${n}`, override: { totalTrainingDays: n }, label: `Train ${n} days`, note: moreDaysNote(a.totalTrainingDays ?? n), act: 'days', n });
  }
  const fewer = fewerPriorities(a.priorityMuscleGroups);
  if (fewer) out.push({ key: 'priorities-fewer', override: { priorityMuscleGroups: fewer }, label: 'Fewer priority muscles', note: `if you keep ${FEWER_PRIORITIES_KEEP}`, act: 'refine' });
  return out;
}

/**
 * The training week's writes in order: Days' saves (daysScreenPatch, `days`)
 * and TrainingWeekSheet's Save ({ days, time, exactMinute, asked }, `sheet`).
 * An object (the page's older single Days save) is one Days write.
 */
async function applyWeek(week: any) {
  const ops = Array.isArray(week) ? week : week ? [{ kind: 'days', input: week }] : [];
  for (const op of ops) {
    try {
      if (op.kind === 'days') await updateTrainingWeek(daysScreenPatch(op.input));
      else if (op.kind === 'sheet') await updateTrainingWeek(op.patch);
    } catch {}
  }
}

/** The summary's Training week row, from the stored week (QuestionnaireSummaryScreen weekValue / timeValue). */
async function weekRow(about: any, saved: any, week: any) {
  ready = '';
  await storageFor(about, saved);
  await applyWeek(week);
  const w = await loadTrainingWeek();
  const planDays = saved?.totalTrainingDays ?? null;
  const weekValue = w.days ? weekDaysLabel(w.days) : weekDaysLabel(null, planDays);
  const timeValue = w.exactMinute != null ? `Around ${clockLabel(w.exactMinute)}` : w.time === 'varies' ? 'Time varies' : ROUGH_LABEL[w.time];
  const detail = w.exactMinute == null && w.time === 'varies' ? 'Add a rough time, or say your days change' : w.days ? timeValue : `${timeValue} · days change week to week`;
  ready = '';
  return { weekValue, timeValue, detail, days: w.days, time: w.time, exactMinute: w.exactMinute, planDays };
}

/** A preset card tapped on Refinements: on when every muscle it picks is picked. */
function presetToggle(id: string, sexKey: string, state: any) {
  const preset = REFINEMENT_PRESETS.find((p: any) => p.id === id);
  if (!preset) return state;
  return isPresetActive(preset, sexKey as any, state) ? removePreset(preset, sexKey as any, state) : applyPreset(preset, sexKey as any, state);
}
function activePresets(sexKey: string, state: any) {
  return REFINEMENT_PRESETS.filter((p: any) => isPresetActive(p, sexKey as any, state)).map((p: any) => p.id);
}

/**
 * WorkoutBuildScreen: loadWorkoutProfile() -> generateProgramAsync(profile),
 * built_from stamped, then the importer's changes (useWorkoutImport
 * validateAndParseJSON: a JSON round trip and normalizeDeloadWeeks per block).
 * `saved` is every answer the questions stored; `week` the Days screen's week.
 */
async function buildProgramFrom(about: any, saved: any, week?: any) {
  ready = '';
  await storageFor(about, saved);
  await applyWeek(week);
  const profile = await loadWorkoutProfile();
  const q = profile.questionnaire ?? {};
  const { program, notes } = await generateProgramAsync(profile);
  program.built_from = builtFromStamp(q);
  const imported = JSON.parse(JSON.stringify(program));
  for (const block of imported.blocks) {
    if (!block.deload_weeks) continue;
    const [a, z] = String(block.weeks).split('-').map((s: string) => parseInt(s.trim(), 10));
    const d = normalizeDeloadWeeks(block.deload_weeks, a, Number.isFinite(z) ? z : a, block.block_name);
    if (!d.ok) throw new Error(d.error);
    block.deload_weeks = d.weeks;
  }
  const view = buildView(imported, notes, profile);
  const views = await programViews(imported, q);
  const weeks: any = { '4_weeks': '4 weeks', '8_weeks': '8 weeks', '12_weeks': '12 weeks', '6_months': '6 months', '1_year': '1 year' };
  const profileLine = [q.totalTrainingDays ? `${q.totalTrainingDays} days a week` : null, weeks[q.programDuration]].filter(Boolean).join(' · ');
  return { program: imported, notes, profile, profileLine, views, view: { steps: view.steps, days: view.days, weeks: view.weeks, deloads: view.deloads, movements: view.movements } };
}

const PACE = 'moderate'; // TimerContext's default rest pace

function proof(p: any) {
  return {
    id: p.decision.id, title: p.title, why: p.decision.why, found: p.decision.found, confidence: p.decision.confidence, forYou: p.forYou,
    sources: p.decision.sources.map((s: any) => ({ cite: s.cite, journal: s.journal, design: s.design, url: s.url, checked: s.checked })),
  };
}

/**
 * What the app shows for a program just built, on a fresh install, today:
 * the Workouts tab (HomeScreen: hero, This week, Your block, Your plans),
 * Blocks, the block's week (DaysScreen) and each session before Start
 * (WorkoutLog), from the app's own helpers. Week 1 of block 1, nothing logged.
 */
async function programViews(program: any, q: any, now = Date.now()) {
  const priority = q.priorityMuscleGroups || [];
  const week = await loadTrainingWeek();
  const todayDow = new Date(now).getDay();
  const blocks = program.blocks;
  const b0 = blocks[0];
  const W = 1;
  const workDays = b0.days.filter((d: any) => d?.day_name && !isRestDayName(d.day_name));
  const sum = workoutSummary(program);
  const totalWeeks = blocks.reduce((t: number, b: any) => t + blockWeekCount(b.weeks), 0);
  const today = trainingOn(week, now, []);
  const nextDow = nextTrainingDay(week.days, todayDow);
  const hero = heroTodayState({
    liveMinutes: null, doneToday: false, skipped: today.skipped,
    plannedMinute: today.planned ? today.minute : null,
    plannedTimeUnknown: today.source === 'set' && usualStartMinute(week, []).source === 'default',
    days: week.days, nextDow,
  });
  const labels = sessionCardLabels({ skipped: [], count: workDays.length, done: [], inProgress: null, days: week.days, todayDow, todayUsed: false, todayAdded: false });
  const mins = (d: any) => {
    const e = estimateDayMinutes(d, { week: W, block: b0 });
    return e ? e[PACE] : d.estimated_duration;
  };
  const card = buildBlockCard({ block: b0, blockIndex: 0, totalWeeks: blockWeekCount(b0.weeks), currentWeek: W, progress: [], priorityMuscles: priority });
  const sessions = workDays.map((d: any, i: number) => ({
    name: d.day_name, label: (labels.find((l: any) => l.index === i) || {}).label, kind: (labels.find((l: any) => l.index === i) || {}).kind,
    first: d.exercises[0]?.exercise, exercises: d.exercises.length, minutes: mins(d),
  }));
  // DaysScreen: the block's week 1, positions counted over all seven days.
  const daysList = b0.days.map((d: any, i: number) => ({
    name: d.day_name, rest: isRestDayName(d.day_name), pos: i + 1,
    exercises: d.exercises.length,
    minutes: isRestDayName(d.day_name) ? null : dayMinutes({ ...d, exercises: d.exercises }, PACE, { week: W }),
    muscles: [...new Set(d.exercises.flatMap((e: any) => e.primaryMuscles || []))].slice(0, 3),
    first: d.exercises.find((e: any) => e.exercise)?.exercise,
  }));
  const isDeload = (b0.deload_weeks || []).includes(W);
  const repStyle = blockRepStyle(b0);
  // WorkoutLog before Start, per session.
  const logs = workDays.map((d: any) => {
    const exs = d.exercises.map((e: any, i: number) => {
      const sets = e.sets_weekly?.[String(W)] || e.sets || 3;
      const reps = e.reps_weekly?.[String(W)] || e.reps || '8-12';
      const rir = e.rir_weekly?.[String(W)];
      const next = d.exercises[i + 1];
      const transition = !!(e.superset_group && next?.superset_group && e.superset_group === next.superset_group && e.superset_group.trim() !== '');
      const rest = resolveRest({ exerciseName: e.exercise, repsThisWeek: e.reps_weekly?.[String(W)] ?? e.reps, rirThisWeek: rir, isDeloadWeek: isDeload, repStyle, ...(transition ? { supersetRole: 'transition' } : {}) } as any);
      const cue = getExerciseCue(e.exercise);
      return {
        name: e.exercise, sets, reps, rir: rir ?? null, rirSets: rirForSets(rir, sets), rirSummary: rir ? summarizeRir(rir) : '',
        muscles: [...(e.primaryMuscles || []), ...(e.secondaryMuscles || [])], superset: e.superset_group || null,
        rest, alternatives: (e.alternatives || []).map((a: any) => (typeof a === 'string' ? a : a?.exercise)).filter(Boolean),
        repsWeekly: e.reps_weekly || {}, rirWeekly: e.rir_weekly || {},
        cue: cue ? { target: cue.target, quickCue: cue.quickCue, why: cue.why, setup: cue.setup, execution: cue.execution, feel: cue.feel, mistake: cue.mistake } : null,
      };
    });
    const paces = sessionMinutes(dayTimeExercises(d.exercises.map((e: any) => ({ ...e, sets: setsForWeek(e, W) || 3, sets_weekly: undefined })), W), { deload: isDeload, repStyle });
    return { name: d.day_name, exercises: exs, paces };
  });
  const sumB = rawBlockSummary(b0);
  const prepared = prepareDecisions('training', trainingEvidenceContext(sumB ? { ...sumB, pace: PACE } : null));
  // RepStylePlanRow: the stored answer, or what block 1 runs when that differs
  // ("Classic now · Heavier from block 2"). Block 1 is in progress, none done.
  const saved = normalizeRepStyle(q.repStyle);
  const rs = repStyleOption(saved);
  const runs = blockRepStyle(b0);
  const startsAt = blocks.map((_: any, i: number) => i).filter((i: number) => i >= 1).find((i: number) => blockRepStyle(blocks[i]) === saved);
  const drift = runs && saved !== 'mix' && runs !== saved ? `${repStyleOption(runs).label} now · ${rs.label} ${startsAt != null ? `from block ${startsAt + 1}` : 'on your next plan'}` : null;
  return {
    name: sum.name, landingMeta: sum.landingMeta, totalWeeks,
    dateLine: `${todayShort(new Date(now)).toUpperCase()} · WEEK ${W} OF ${totalWeeks}`,
    hero: { label: hero.label, pill: hero.pill, next: sessions[0] },
    weekDays: week.days ? week.days.length : null,
    weekLink: weekDaysLink(week.days, week.asked, workDays.length || Number(program.days_per_week) || null),
    sessions,
    blockCard: card,
    plansSub: `Week 1 of ${totalWeeks} · ${program.days_per_week} ${program.days_per_week === 1 ? 'day' : 'days'} a week`,
    lengthTag: totalWeeks,
    blocks: {
      overline: blockPlanOverline({ activeIndex: 0, totalBlocks: blocks.length, weekInBlock: W, blockWeeks: blockWeekCount(b0.weeks), blockComplete: false, totalWeeks }),
      meta: `0 of ${blocks.length} ${blocks.length === 1 ? 'block' : 'blocks'} done · week 1 of ${totalWeeks} overall`,
      fill: totalWeeks ? 1 / totalWeeks : 0,
      repStyleSub: drift ?? `${rs.label} · ${rs.tag.toLowerCase()}`,
      rows: blocks.map((b: any, i: number) => {
        const { label, title } = splitBlockName(b.block_name, i);
        return { overline: rowOverline(label, { current: i === 0 }), title, meta: blockRowMeta(b.weeks, trainingDayCount(b.days)), current: i === 0 };
      }),
      laterBlock: blocks.length > 1 ? 2 : null,
      proof: { featured: prepared.featured.map(proof), all: prepared.all.map(proof) },
    },
    week: {
      label: String(b0.block_name).toUpperCase(), week: W, of: blockWeekCount(b0.weeks),
      deload: isDeload, ramp: (b0.ramp_weeks || []).includes(W), rampWeeks: b0.ramp_weeks || [], deloads: b0.deload_weeks || [],
      days: daysList, workouts: workDays.length,
    },
    logs,
    pace: { explainers: PACE_EXPLAINERS, footer: PACE_FOOTER, switchNote: PACE_SWITCH_NOTE, refs: REST_REFERENCES.map((r: any) => ({ ...r, url: doiUrl(r.doi) })) },
  };
}

export default {
  programViews,
  _setRoute(fn: any) { routeFor = fn; },
  trainingStart, weekFor, toggleDay, weekLabel, sessionPanel, sessionEstimate, volumeLines, summaryFixes, weekRow, daysStart,
  presetToggle, activePresets, buildProgramFrom, normalizeRepStyle,
};
