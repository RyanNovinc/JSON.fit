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
  operatingRangeFor, BODY_FAT_TIERS, bodyFatFromTier, tierRange, MIN_RANGE_WIDTH_PCT,
} from 'APP_DIR/src/utils/roadmap';
import { VERIFIED_PAPER_COUNT } from 'APP_DIR/src/data/evidence';
import { defaultGoalBodyFatFor } from 'APP_DIR/src/utils/attractivenessTargets';
import { leanStopFor } from 'APP_DIR/src/utils/operatingBands';
import { planCurve } from 'APP_DIR/src/utils/planCurve';
import { phaseIntentFor } from 'APP_DIR/src/utils/phaseIntent';
import { TRAINING_BANDS } from 'APP_DIR/src/utils/phasePrescription';
import { saveGoalsProfile, loadGoalsProfile } from 'APP_DIR/src/utils/goalsProfileStorage';
import { replanRoute, expandPhases, journeyRoadmap, loadSavedRoutePlan } from 'APP_DIR/src/utils/phaseJourney';
import { computeMacrosPhaseAware } from 'APP_DIR/src/utils/nutritionMacros';
import { saveNutritionAnswers, resolveNutritionAnswers } from 'APP_DIR/src/utils/nutritionQuestionnaireStorage';
import { REP_STYLE_OPTIONS } from 'APP_DIR/src/data/repStyles';
import MEALS_PART from "./meals-part";
import TRAINING_PART from "./training-part";

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
    papers: VERIFIED_PAPER_COUNT,
    trainingBands: TRAINING_BANDS,
  };
}

/**
 * RouteScreen.planProfileFor, exactly: the beat 9 answer ('lean' | 'bulk' |
 * 'capped') plus the screen's own state (`bottom`, `top`, `bulkTo` and
 * `wayIn`, null when untouched), preference 'balanced'.
 */
function planProfileFor(profile: any, r: 'lean' | 'bulk' | 'capped', c: any = {}) {
  const preference = 'balanced';
  const base: any = {
    ...profile,
    routePhase: undefined,
    phaseOrder: r === 'lean' ? 'cut_first' : 'build_first',
    preBuildBf: c.bottom ?? undefined,
    ceilingBf: undefined,
  };
  const chosen = c.top != null && c.top < NO_CEILING_BF ? c.top : null;
  const suggested = chosen == null ? (operatingRangeFor(base, preference)?.suggestedTop ?? null) : null;
  return {
    ...base,
    ceilingBf: r === 'bulk' ? NO_CEILING_BF : (chosen ?? suggested ?? undefined),
    bulkToBf: r === 'capped' ? (c.bulkTo ?? undefined) : undefined,
    wayIn: r === 'lean' ? (c.wayIn || 'cut') : undefined,
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
    // RouteScreen's ConfirmSheet: below the health floor only with a yes.
    goalBelowFloorConfirmed: a.belowFloorOk && a.goalBodyFatPct < leanStopFor(a.sex) ? true : undefined,
    trainingState: a.trainingState || 'consistent',
    trainingStateChosen: true,
    activityLevel: a.activityLevel || 'moderate',
    trainingSessionsPerWeek: a.trainingSessionsPerWeek ?? 3.5,
  };
}

/** The screen's state for beat 9, as RouteScreen holds it. */
function choiceOf(a: any) {
  return { bottom: a.bottom ?? null, top: a.top ?? null, bulkTo: a.bulkTo ?? null, wayIn: a.wayIn || 'cut' };
}

const WAY_IN_IDS = ['hold', 'ease', 'cut'];
const isCut = (k: string) => k === 'trim' || k === 'reveal';
/** What the page draws from a roadmap: JourneyChart, PhaseLine and the summary read these. */
function roadmapOut(pp: any, rm: any) {
  if (!rm) return null;
  const curve = planCurve(pp, rm);
  return {
    phases: rm.phases.map((ph: any) => ({ kind: ph.kind, exitBodyFatPct: ph.exitBodyFatPct, exitWeightKg: ph.exitWeightKg, estMonths: ph.estMonths, repeats: ph.repeats })),
    expanded: expandPhases(rm).map((ph: any) => ({ kind: ph.kind, exitBodyFatPct: ph.exitBodyFatPct, exitWeightKg: ph.exitWeightKg, estMonths: ph.estMonths })),
    band: rm.band,
    estYears: rm.estYears,
    gapKg: rm.gapKg,
    leanNowKg: rm.leanNowKg,
    plausibility: rm.plausibility,
    holdsAtGoalBodyFat: !!rm.holdsAtGoalBodyFat,
    cuts: rm.phases.filter((ph: any) => isCut(ph.kind)).length,
    curve: curve ? { points: curve.points.map((p: any) => ({ month: p.month, bodyFatPct: p.bodyFatPct })), nodes: curve.nodes.map((n: any) => ({ month: n.month, bodyFatPct: n.bodyFatPct, weightKg: n.weightKg, when: n.when })), totalMonths: curve.totalMonths } : null,
  };
}

/**
 * Everything RouteScreen's beat 9 and beat 10 compute, for one state of the
 * screen: the three option previews, the range, the capped peak, the way in,
 * and the plan for the chosen answer.
 */
function routeView(about: any) {
  const preference = 'balanced';
  const p: any = goalsProfileFrom(about);
  const c = choiceOf(about);
  const routeId = about.route || 'lean';
  const effProfile = planProfileFor(p, 'lean', c);
  const range = operatingRangeFor(effProfile, preference);
  const bf = p.currentBodyFatPct;
  const wayInApplies = routeId === 'lean' && bf != null && range != null && bf > range.bottom + 0.2;
  // driftTopBf + defaultBulkTo + bulkFloor.
  const bulkRm = deriveRoadmap(planProfileFor(p, 'bulk', c), preference);
  const driftTop = bulkRm ? Math.round(Math.max(bf ?? 0, ...bulkRm.phases.map((ph: any) => ph.exitBodyFatPct)) * 10) / 10 : null;
  const now = bf ?? 20;
  const cap = driftTop != null ? driftTop - 0.5 : now + 4;
  const defaultBulkTo = Math.max(now + 2, Math.min(now + 4, Math.round(cap * 2) / 2));
  const bulkFloor = (bf ?? 0) + MIN_BULK_HEADROOM_PCT;
  const previews: any = {};
  for (const r of ['lean', 'bulk', 'capped'] as const) {
    // The limit option previews at the limit it will plan with (the default until
    // one is picked). Without it the preview had no limit and drew the same line
    // as 'Grow now, cut at the end'. The app's beat 9 has the same gap.
    const pp = planProfileFor(p, r, r === 'capped' ? { ...c, bulkTo: c.bulkTo ?? defaultBulkTo } : c);
    previews[r] = roadmapOut(pp, deriveRoadmap(pp, preference));
  }
  const planProfile = planProfileFor(p, routeId, c);
  const roadmap = roadmapOut(planProfile, deriveRoadmap(planProfile, preference));
  let wayIn: any = null;
  if (wayInApplies) {
    const out: any[] = [];
    for (const id of WAY_IN_IDS) {
      const rm = deriveRoadmap({ ...effProfile, wayIn: id }, preference);
      const first = rm?.phases[0];
      if (!first || first.exitWeightKg == null) continue;
      if (id === 'hold' && first.kind !== 'recomp') continue;
      out.push({ id, exitWeightKg: first.exitWeightKg, months: first.estMonths, exitBodyFatPct: first.exitBodyFatPct });
    }
    wayIn = out.length > 1 ? out : null;
  }
  return {
    range, rangeMatters: range != null, wayInApplies, wayIn,
    openingCut: range != null && bf != null && bf > range.bottom + 0.2,
    defaultBulkTo, bulkFloor, previews, roadmap,
    leanStop: leanStopFor(p.sex), minWidth: MIN_RANGE_WIDTH_PCT,
  };
}

/**
 * The route: saves the profile, locks the route the way RouteScreen's lock-in
 * does (replanRoute('lock')), then reads back what the meal planner will read.
 */
async function buildRoute(about: any, nutrition?: any) {
  await wipe();
  const planProfile = planProfileFor(goalsProfileFrom(about), about.route || 'lean', choiceOf(about));
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

const API: any = {
  version: () => ({ app: __APP_VERSION__, rev: __APP_REV__ }),
  defaults,
  goalWeightAt: (sex: string, heightCm: number, weightKg: number, goalBf: number) => defaultGoalWeight({ sex, heightCm, currentWeightKg: weightKg }, goalBf),
  routeView,
  paperCount: () => VERIFIED_PAPER_COUNT,
  buildRoute,
  repStyles: () => REP_STYLE_OPTIONS,
  ...MEALS_PART,
  buildMeals: (about: any, food: any) => MEALS_PART.buildMeals(about, food, buildRoute),
  ...TRAINING_PART,
};
TRAINING_PART._setRoute((about: any) => buildRoute(about));

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
