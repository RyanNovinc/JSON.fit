// Training for the /try/ page: the workout questions' live numbers and the
// program build, all from the app's own code. See entry.ts.
//
// The path is the app's (release 1.0.44, WORKOUT_GENERATOR on), from the
// onboarding finish line: Days (Q3DaysPerWeek) -> How long (Q4ProgramDuration)
// -> Volume (Q6Volume) -> Refinements -> WorkoutBuild. Each screen saves its
// answer with updateQuestionnaireField, Q4 also saves the default equipment
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
import { daysScreenStart, daysScreenPatch, updateTrainingWeek, ROUGH_LABEL, daysLabel as weekDaysLabel } from 'APP_DIR/src/utils/trainingWeek';
import { daysForCount, sortMonFirst, toggleTrainingDay } from 'APP_DIR/src/utils/weekStrip';
import {
  buildEstimateProfile, estimateSessionLength, sessionHeadSub, rampLine, sessionAssumptions, assumptionLine,
  longSessionLine, sessionLengthTone, usefulFixes, sessionDeltaLine, daysLabel, VOLUME_LABEL, volumeTypicalSets,
  volumePrioritySets, lowerVolume, lowerVolumeNote, moreDaysOptions, moreDaysNote, refinementsDeltaLine,
} from 'APP_DIR/src/utils/sessionLengthEstimate';
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

/** RefinementsScreen's chip lists (private there). */
const AUX_TITLES: Record<string, string> = {
  neck: 'Neck', forearms: 'Forearms', obliques: 'Obliques', serratus: 'Serratus',
  lower_back: 'Lower back', hip_abductors: 'Hip abductors', hip_adductors: 'Hip adductors', shins: 'Shins',
};
const auxTitle = (v: string) => AUX_TITLES[v] ?? v;

/** The order the screens save their answers in (each one an updateQuestionnaireField). */
const SAVE_ORDER = [
  'totalTrainingDays', 'programDuration', 'selectedEquipment', 'volumePreference',
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

/** What the days question opens on, and the other screens' fixed lists. */
async function trainingStart(about: any) {
  await storageFor(about, null);
  const profile = await loadGoalsProfile();
  const stored = await WorkoutStorage.loadTrainingWeek().catch(() => null);
  const start = daysScreenStart(undefined, stored as any, profile?.trainingSessionsPerWeek);
  const prepared = prepareDecisions('training', repStyleEvidenceContext());
  const keep = (p: any) => REP_STYLE_EVIDENCE.includes(p.decision.id);
  const repEvidence = (prepared.featured.filter(keep).length ? prepared.featured.filter(keep) : prepared.all.filter(keep)).map((p: any) => ({
    id: p.decision.id, title: p.title, why: p.decision.why, found: p.decision.found, confidence: p.decision.confidence, forYou: p.forYou,
    sources: p.decision.sources.map((s: any) => ({ cite: s.cite, journal: s.journal, design: s.design, url: s.url, checked: s.checked })),
  }));
  return {
    start: { selected: start.selected, days: start.days ? sortMonFirst(start.days) : null, varies: start.varies, time: start.time },
    sex: profile?.sex ?? null,
    sexKey: presetSexKey(profile?.sex),
    recommendedVolume: profile?.trainingState === 'new' ? '8-12' : '12-16',
    steps: ['Q3DaysPerWeek', 'Q4ProgramDuration', 'Q6Volume'].map((r) => workoutStep(r as any).label),
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

/** The fixes each screen offers (Q3: more days; Q6: one step less volume, one more day). */
function daysFixes(selected: number) {
  return moreDaysOptions(selected).map((n: number) => ({ key: `days-${n}`, override: { totalTrainingDays: n }, label: `Train ${n} days`, note: moreDaysNote(selected ?? n), days: n }));
}
function volumeFixes(selected: string, trainingDays: number | null) {
  const down = selected ? lowerVolume(selected) : null;
  return [
    ...(down ? [{ key: 'volume-down', override: { volumePreference: down }, label: `${VOLUME_LABEL[down]} volume`, note: lowerVolumeNote(down), volume: down }] : []),
    ...moreDaysOptions(trainingDays, 1).map((n: number) => ({ key: `days-${n}`, override: { totalTrainingDays: n }, label: `Train ${n} days`, note: moreDaysNote(trainingDays ?? n), days: n })),
  ];
}

/** Q6's per-option line ("Most muscles get 10 to 14 sets a week.") for this user. */
async function volumeLines(about: any, saved: any, answers: any) {
  await storageFor(about, saved);
  const base = await loadWorkoutProfile();
  const profile = buildEstimateProfile(base, answers, {});
  const out: any = {};
  for (const v of ['8-12', '12-16', '16-20']) {
    const [lo, hi] = volumeTypicalSets(profile, v);
    const pri = volumePrioritySets(profile, v);
    const most = lo === hi ? `Most muscles get about ${lo} sets a week` : `Most muscles get ${lo} to ${hi} sets a week`;
    if (!pri) { out[v] = `${most}.`; continue; }
    const who = pri.count === 1 ? 'your priority muscle' : `your ${pri.count} priority muscles`;
    out[v] = `${most}, ${who} ${pri.lo} to ${pri.hi}.`;
  }
  return { lines: out, recommended: base?.goalsProfile?.trainingState === 'new' ? '8-12' : '12-16' };
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
  if (week) {
    try { await updateTrainingWeek(daysScreenPatch(week)); } catch {}
  }
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
  const rs = repStyleOption(q.repStyle); // RepStylePlanRow: the stored answer
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
      repStyleSub: `${rs.label} · ${rs.tag.toLowerCase()}`,
      rows: blocks.map((b: any, i: number) => {
        const { label, title } = splitBlockName(b.block_name, i);
        return { overline: rowOverline(label, { current: i === 0 }), title, meta: blockRowMeta(b.weeks, b.days.length), current: i === 0 };
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
  trainingStart, weekFor, toggleDay, weekLabel, sessionPanel, daysFixes, volumeFixes, volumeLines,
  presetToggle, activePresets, buildProgramFrom, normalizeRepStyle,
};
