// The /try/ page's engines: the app's own route, meal plan, shopping list and
// workout code, imported straight from an app checkout (APP_DIR is substituted
// by build.sh). Runs in a Web Worker (try/index.html posts {id, cmd, args}) and
// in node for the tests (globalThis.JsonFitEngines).
//
// The answers are written to the app's own storage functions (an in-memory
// AsyncStorage here, see scripts/app-meals/stubs) and read back by the app's
// own loaders, so each plan is built the way the phone builds it from the same
// answers. Nothing here sends anything anywhere.
// @ts-nocheck

import { derivePhase } from 'APP_DIR/src/utils/goalsProfile';
import {
  deriveRoadmap, weightAtBodyFat, leanAtNormalisedFfmi, ffmiLimitsFor, FFMI_UNTRAINED,
  operatingRangeFor, BODY_FAT_TIERS, bodyFatFromTier, tierRange,
} from 'APP_DIR/src/utils/roadmap';
import { defaultGoalBodyFatFor } from 'APP_DIR/src/utils/attractivenessTargets';
import { leanStopFor } from 'APP_DIR/src/utils/operatingBands';
import { planCurve } from 'APP_DIR/src/utils/planCurve';
import { phaseIntentFor } from 'APP_DIR/src/utils/phaseIntent';
import { TRAINING_BANDS } from 'APP_DIR/src/utils/phasePrescription';
import { saveGoalsProfile, loadGoalsProfile } from 'APP_DIR/src/utils/goalsProfileStorage';
import { replanRoute, expandPhases, journeyRoadmap, loadSavedRoutePlan } from 'APP_DIR/src/utils/phaseJourney';
import { computeMacrosPhaseAware } from 'APP_DIR/src/utils/nutritionMacros';
import { saveNutritionAnswers, resolveNutritionAnswers } from 'APP_DIR/src/utils/nutritionQuestionnaireStorage';
import { WorkoutStorage } from 'APP_DIR/src/utils/storage';
import { generateProgram } from 'APP_DIR/src/utils/workoutGenerator/generateProgram';
import { rawBlockSummary, resolveProfile, targetsFor } from 'APP_DIR/src/utils/workoutGenerator/check';
import { resolveRest } from 'APP_DIR/src/utils/restResolver';
import { availableEquipment } from 'APP_DIR/src/utils/equipmentAvailability';
import { REP_STYLE_OPTIONS } from 'APP_DIR/src/data/repStyles';
import MEALS_PART from "./meals-part";

declare const __APP_VERSION__: string;
declare const __APP_REV__: string;

const AsyncStorage = require('@react-native-async-storage/async-storage');

/** Fresh storage for each build, so one visitor's earlier answers never leak into the next plan. */
async function wipe() {
  await AsyncStorage.clear();
}

const NO_CEILING_BF = 99; // RouteScreen.tsx NO_CEILING_BF
const MIN_BULK_HEADROOM_PCT = 1; // RouteScreen.tsx

/** RouteScreen's default goal weight (provisionalGoalW). */
function defaultGoalWeight(p: { sex?: string; heightCm?: number; currentWeightKg: number }, goalBf: number) {
  if (p.heightCm == null) return p.currentWeightKg;
  const sexKey = p.sex === 'female' ? 'female' : 'male';
  const baseW = weightAtBodyFat(leanAtNormalisedFfmi(FFMI_UNTRAINED[sexKey], p.heightCm), goalBf);
  const okW = weightAtBodyFat(leanAtNormalisedFfmi(ffmiLimitsFor(p.sex).ok, p.heightCm), goalBf);
  return Math.round(((baseW + okW) / 2) * 2) / 2;
}

/** Defaults the About you step opens on, from the app's own seeds and functions. */
function defaults(sex: 'male' | 'female', heightCm?: number, weightKg?: number, bodyFatPct?: number) {
  const h = heightCm ?? (sex === 'female' ? 163 : 176); // heightSeed
  const w = weightKg ?? 77; // SEED_WEIGHT_KG
  const goalBf = defaultGoalBodyFatFor(sex);
  return {
    heightCm: h,
    weightKg: w,
    ageYears: 28, // AGE_SEED
    bodyFatPct: bodyFatPct ?? (sex === 'female' ? 28 : 20), // placeholderBodyFat
    goalBodyFatPct: goalBf,
    goalWeightKg: defaultGoalWeight({ sex, heightCm: h, currentWeightKg: w }, goalBf),
    leanStop: leanStopFor(sex),
    tiers: BODY_FAT_TIERS.map((t: any) => ({ range: tierRange(t, sex), description: t.description, pct: bodyFatFromTier(t, sex) })),
    trainingBands: TRAINING_BANDS,
  };
}

/**
 * RouteScreen.planProfileFor for one of the three beat 9 answers ('lean' |
 * 'bulk' | 'capped'), with the range and the way in left on their defaults
 * (bottom and top untouched, way in = cut), preference 'balanced'.
 */
function planProfileFor(profile: any, r: 'lean' | 'bulk' | 'capped') {
  const preference = 'balanced';
  const base: any = {
    ...profile,
    routePhase: undefined,
    phaseOrder: r === 'lean' ? 'cut_first' : 'build_first',
    preBuildBf: undefined,
    ceilingBf: undefined,
  };
  const suggested = operatingRangeFor(base, preference)?.suggestedTop ?? null;
  let bulkToBf: number | undefined;
  if (r === 'capped') {
    // RouteScreen driftTopBf + defaultBulkTo.
    const bulkProfile = { ...base, phaseOrder: 'build_first', ceilingBf: NO_CEILING_BF };
    const rm = deriveRoadmap(bulkProfile, preference);
    const now = profile.currentBodyFatPct ?? 20;
    const driftTop = rm ? Math.round(Math.max(now, ...rm.phases.map((ph: any) => ph.exitBodyFatPct)) * 10) / 10 : null;
    const cap = driftTop != null ? driftTop - 0.5 : now + 4;
    bulkToBf = Math.max(now + 2, Math.min(now + 4, Math.round(cap * 2) / 2));
    bulkToBf = Math.max(bulkToBf, now + MIN_BULK_HEADROOM_PCT);
  }
  return {
    ...base,
    ceilingBf: r === 'bulk' ? NO_CEILING_BF : (suggested ?? undefined),
    bulkToBf,
    wayIn: r === 'lean' ? 'cut' : undefined,
    routePreference: preference,
  };
}

function goalsProfileFrom(a: any) {
  return {
    sex: a.sex,
    ageYears: a.ageYears,
    heightCm: a.heightCm,
    currentWeightKg: a.weightKg,
    currentBodyFatPct: a.bodyFatPct,
    bodyFatSource: a.bodyFatSource === 'visual' ? 'visual' : 'reported',
    goalWeightKg: a.goalWeightKg,
    goalBodyFatPct: a.goalBodyFatPct,
    goalBelowFloorConfirmed: a.goalBodyFatPct < leanStopFor(a.sex) ? true : undefined,
    trainingState: a.trainingState || 'consistent',
    trainingStateChosen: true,
    activityLevel: a.activityLevel || 'moderate',
    trainingSessionsPerWeek: a.trainingSessionsPerWeek ?? 3.5,
  };
}

/** Each route answer's cut count, for the three options (RouteScreen CUT_WORDS). */
function routeOptions(about: any) {
  const p = goalsProfileFrom(about);
  const out: any = {};
  for (const r of ['lean', 'bulk', 'capped'] as const) {
    const rm = deriveRoadmap(planProfileFor(p, r), 'balanced');
    out[r] = rm ? { cuts: expandPhases(rm).filter((x: any) => x.kind === 'trim' || x.kind === 'reveal').length, opensWithCut: rm.phases[0]?.kind === 'trim', years: rm.estYears } : null;
  }
  return out;
}

/**
 * The route: saves the profile, locks the route the way RouteScreen's lock-in
 * does (replanRoute('lock')), then reads back what the meal planner will read.
 */
async function buildRoute(about: any, nutrition?: any) {
  await wipe();
  const planProfile = planProfileFor(goalsProfileFrom(about), about.route || 'lean');
  await saveGoalsProfile(planProfile);
  const plan = await replanRoute('lock', { profile: planProfile, route: 'balanced' });
  const profile = await loadGoalsProfile();
  if (!profile) throw new Error('route: profile not saved');
  const roadmap = journeyRoadmap(profile, plan, 0);
  if (!roadmap) throw new Error('route: no roadmap for these numbers');
  const phases = expandPhases(roadmap);
  const curve = planCurve(profile, roadmap);
  await saveNutritionAnswers({
    gender: about.sex,
    age: about.ageYears,
    height: about.heightCm,
    weight: about.weightKg,
    activityLevel: profile.activityLevel,
    trainingSessionsPerWeek: profile.trainingSessionsPerWeek,
    dietType: 'balanced',
    ...(nutrition || {}),
  } as any);
  const answers = await resolveNutritionAnswers();
  const macros = computeMacrosPhaseAware(answers as any, profile);
  return {
    profile,
    phase: derivePhase(profile),
    roadmap: { band: roadmap.band, estYears: roadmap.estYears, plausibility: roadmap.plausibility, route: roadmap.route },
    phases: phases.map((ph: any) => ({ ...ph, title: phaseIntentFor(ph.kind).title })),
    curve: curve ? { points: curve.points, nodes: curve.nodes, totalMonths: curve.totalMonths } : null,
    macros,
    savedPlan: !!(await loadSavedRoutePlan()),
  };
}

/** The workout program, built the way generateProgramFromStorage does (loadWorkoutProfile). */
async function buildProgram(about: any, training: any) {
  const goalsProfile = planProfileFor(goalsProfileFrom(about), about.route || 'lean');
  const questionnaire: any = {
    totalTrainingDays: training.days,
    programDuration: training.programDuration || '8_weeks',
    volumePreference: training.volumePreference || 'not_sure',
    repStyle: training.repStyle || 'classic',
    gender: about.sex,
    priorityMuscleGroups: [],
    auxiliaryMuscles: [],
    movementLimitations: [],
    selectedEquipment: [training.equipment || 'commercial_gym'],
  };
  const appEquipment = availableEquipment(questionnaire.selectedEquipment);
  const profile = { id: 'web', kind: 'workout', label: 'web', questionnaire, goalsProfile };
  const { program, notes } = generateProgram(profile as any);
  const resolved = resolveProfile(profile as any, { blocks: [] });
  const targets = targetsFor(resolved);
  const summary = rawBlockSummary(program.blocks[0]);
  // Rest for week 1 of block 1, per exercise, at the program's default pace.
  const pace = program.default_pace || 'moderate';
  for (const b of program.blocks) {
    for (const d of b.days) {
      for (const e of d.exercises) {
        try {
          const t = resolveRest({ exerciseName: e.exercise, repsThisWeek: e.reps_weekly?.['1'], rirThisWeek: e.rir_weekly?.['1'], isDeloadWeek: false } as any);
          e._restSec = t?.[pace] ?? t?.moderate ?? null;
        } catch {
          e._restSec = null;
        }
      }
    }
  }
  return { program, notes, targets, volume: summary?.volume ?? null, appBuildsGym: appEquipment[0] !== questionnaire.selectedEquipment[0] };
}

const API: any = {
  version: () => ({ app: __APP_VERSION__, rev: __APP_REV__ }),
  defaults,
  goalWeightAt: (sex: string, heightCm: number, weightKg: number, goalBf: number) => defaultGoalWeight({ sex, heightCm, currentWeightKg: weightKg }, goalBf),
  routeOptions,
  buildRoute,
  buildProgram,
  repStyles: () => REP_STYLE_OPTIONS,
  ...MEALS_PART,
  buildMeals: (about: any, food: any) => MEALS_PART.buildMeals(about, food, buildRoute),
};

(globalThis as any).JsonFitEngines = API;

// Web Worker: {id, cmd, args} in, {id, ok, result | error} out.
if (typeof (globalThis as any).WorkerGlobalScope !== 'undefined' && typeof (globalThis as any).postMessage === 'function') {
  (globalThis as any).onmessage = async (ev: any) => {
    const { id, cmd, args } = ev.data || {};
    try {
      if (!API[cmd]) throw new Error('unknown command ' + cmd);
      const result = await API[cmd](...(args || []));
      (globalThis as any).postMessage({ id, ok: true, result });
    } catch (e: any) {
      (globalThis as any).postMessage({ id, ok: false, error: String(e?.message || e) });
    }
  };
}
