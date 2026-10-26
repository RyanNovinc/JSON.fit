// Meals for the /try/ page: the app's meal questions, the meal picker, the
// build and its results, all from the app's own code. See entry.ts.
// @ts-nocheck
//
// ONE PATH, THE APP'S (26 Oct 2026). Every view and the build itself replay the
// answers through the same storage writes the app's screens make, in the
// app's order, then read back what each screen reads:
//
//   RouteScreen lock-in (saveGoalsProfile + replanRoute('lock'), the profile
//     as the route left it: no activity or training sessions yet)
//   the workout plan, when one was built first (the finish line's "Next: my
//     training"): the importer's addRoutine and WorkoutBuildScreen's
//     syncCaloriesToTrainingDays(days, program), sessions and minutes
//   continueNutritionFlow (routeNutritionSeed + the profile's sex, height,
//     weight, merged into the draft) and beginNutritionSteps (the plan's
//     sessions and minutes a week saved; N4bTraining left out when known)
//   N4Activity, N4bTraining (no plan only), N5DietType, N5aDietPattern, N5bAllergies,
//   N5dSkipFoods, N5eKeepLower, N5cSleep, N6MealsSnacking, N6gSnacks (My
//   foods), N6eAppetite, N6aDessert, N6bSlowCooker, N6cFreezer,
//   N6dShopCadence, N6fStockUp (each one's handleNext, with useTubsPerDay and
//   useSaveBatchSettings as the screens run them), N9PlanLength
//   (finalizeNutrition), CuratedFavorites (Save, or "Choose for me"; use-up
//   ticks are saved as they are tapped), NutritionSummary
//   ("Build my meal plan": finalizeNutrition again), then MealBuildScreen's
//   generateMealPlanFromStorage with the arguments a first build passes.
//
// Nothing is defaulted here that the app would ask: an unanswered question is
// unanswered in storage too. scripts/try-engines/parity.mjs checks this file
// against an independent transcription of the screens.

import { CURATED_MEALS } from 'APP_DIR/src/data/curated_meals';
import { offeredMeals, hidesBlenderMeals, splitQuickOrMadeAhead } from 'APP_DIR/src/utils/offeredMeals';
import { activeDietPattern } from 'APP_DIR/src/utils/dietPattern';
import { mealsForSlots, emptyFilter } from 'APP_DIR/src/utils/curatedShelves';
import { buildTabs, slotsForTab, tabId, tabLabel, tabSlot, scopeKey, unscopeKey } from 'APP_DIR/src/utils/basketCheck';
import {
  batchMainsOnly, recommendedMainPicks, recommendMainsLine, mainPicksWhy, DIET_PATTERN_OPTIONS, KEEP_LOWER_OPTIONS, KEEP_LOWER_HELP,
  asksAppetite, withLowAppetite, COOKER_OPTIONS, COOKER_COUNTS, COOKER_COUNT_NOTE, BLENDER_TITLE, BLENDER_OPTIONS, BLENDER_NOTE,
  FREEZER_OPTIONS, CADENCE_OPTIONS, cadenceBlockedReason, tubsPerDayForKcal, STOCK_UP_TITLE, STOCK_UP_INTRO, STOCK_UP_OPTIONS,
  STOCK_UP_FOOTNOTE, stockUpHint, showsStockUp, stockUpCard, toBatchSettings, withSlowCookerEquipment, planDaysFor,
  dietPatternLabel, keepLowerLabel, cookerLabel, blenderLabel, freezerLabel, cadenceLabel, stockUpLabel, hasLowAppetite,
} from 'APP_DIR/src/utils/batchSetup';
import { generateMealPlanFromStorage, checkFixes, gapToShow, fixTitle, saveMealFixes, slotNoteWord } from 'APP_DIR/src/utils/mealGenerator';
import { weekGrid, wallImages, batchBuildNote } from 'APP_DIR/src/utils/mealGenerator/display';
import { batchFoodViews, batchActive } from 'APP_DIR/src/utils/mealGenerator/batchPlan';
import { saveCuratedFavoritesV2, loadCuratedFavoritesV2 } from 'APP_DIR/src/utils/curatedFavoritesStorage';
import { updateFoodPrefs, loadFoodPrefs } from 'APP_DIR/src/utils/foodPrefs';
import { buildFoodCatalogue, popularFoods, browseFoods, searchFoods, skipVerdict, foodList, foodById } from 'APP_DIR/src/utils/foodSkip';
import { heroPlateId, cookingVariantId } from 'APP_DIR/src/utils/mealVersions';
import {
  saveNutritionAnswers, loadNutritionAnswers, updateNutritionField, mergeNutritionAnswers, resolveNutritionAnswers, saveMealTimesAnswer,
  trainingDaysFromProgram,
} from 'APP_DIR/src/utils/nutritionQuestionnaireStorage';
import { routeNutritionSeed } from 'APP_DIR/src/utils/routeNutritionSeed';
import { saveGoalsProfile, loadGoalsProfile, updateGoalsProfileField } from 'APP_DIR/src/utils/goalsProfileStorage';
import { replanRoute } from 'APP_DIR/src/utils/phaseJourney';
import { derivePhase } from 'APP_DIR/src/utils/goalsProfile';
import { dietSplitPreview, phasePhrase, finalizeNutrition, resolvePlanMacros } from 'APP_DIR/src/utils/nutritionMacros';
import { trainingTimeLabel, DEFAULT_TRAINING_MINUTES } from 'APP_DIR/src/utils/phasePrescription';
import { syncCaloriesToTrainingDays, loadPlanMinutesPerWeek, loadPlanSessionsPerWeek } from 'APP_DIR/src/utils/trainingDaysSync';
import { deriveDayMealTimes, mealWindow } from 'APP_DIR/src/utils/mealDayTimes';
import { planMainSlots } from 'APP_DIR/src/utils/mealPlanPromptV2';
import { WorkoutStorage } from 'APP_DIR/src/utils/storage';
import { SNACK_SEEDS, SNACK_GROUP_LABELS, DEFAULT_TICKED_SNACKS } from 'APP_DIR/src/data/snackChecklist';
import {
  myFoodAllergenHit, myFoodFromSnackSeed, recommendedSnackPicks, snackPicksWhy, snacksPerDayFromAnswer, pickCountLine,
  tickSeed, untick, newCustomFood, sanitizeMyFoods,
} from 'APP_DIR/src/utils/myFoods';
import { snackSeed } from 'APP_DIR/src/data/snackChecklist';
import { allergenCatch, checkableAllergies, versionClashes, allergenList } from 'APP_DIR/src/utils/allergenCatch';
import { unlabelledAllergies } from 'APP_DIR/src/utils/allergenMatch';
import { getVariantChoices, setVariantChoice } from 'APP_DIR/src/utils/variantChoices';
import { goalShelf, goalShelfCopy, goalShelfKind, withoutShelf } from 'APP_DIR/src/utils/mainsShelves';
import { lowSaltShelf, wantsLowSalt, withPlanSwaps } from 'APP_DIR/src/utils/lowSalt';
import { quickFoods, rankUseUp, usesLabel, fillFromUseUp, AISLES, aisleOf, saveUseUp, clearUseUp, recordPicks } from 'APP_DIR/src/utils/useUp';
import { orderBySkips } from 'APP_DIR/src/utils/foodSkip';
import { batchWeekList } from 'APP_DIR/src/utils/batchWeekList';
import { prepSessionFromCook } from 'APP_DIR/src/utils/buildPrepSession';
import { bookedByPot } from 'APP_DIR/src/utils/cookSession';
import { resolveGroceryInputs } from 'APP_DIR/src/utils/groceryState';
import { CATEGORY_ORDER, CATEGORY_NAMES } from 'APP_DIR/src/utils/groceryModel';
import { INGREDIENTS } from 'APP_DIR/src/data/ingredients';
import { BATCH_LIBRARY, BATCH_PLANNER } from 'APP_DIR/src/config/featureFlags';

// ---------------------------------------------------------------------------
// The route helpers live in entry.ts (RouteScreen's planProfileFor etc.).
// ---------------------------------------------------------------------------
let R: any = null;
function initMeals(route: any) {
  R = route;
}

/** The meal flow, in the app's order (nutritionSteps.NUTRITION_STEPS with the flags on), then the picker, the summary and the build. */
const ORDER = [
  'active', 'sessions', 'diettype', 'meat', 'allergies', 'skip', 'keeplower', 'sleep', 'eat', 'snacks', 'appetite',
  'dessert', 'cooker', 'freezer', 'cadence', 'stockup', 'planlength', 'picks', 'summary', 'build',
];
const before = (a: string, b: string) => ORDER.indexOf(a) < ORDER.indexOf(b);

/** CuratedFavoritesScreen effortMinutes / ingredientCount (private there). */
function effortMinutes(m: any): number {
  const method: any = m.methods?.[0];
  return method?.time_active_minutes ?? method?.time_total_minutes ?? 0;
}
function ingredientCount(m: any): number {
  if (m.custom) return m.custom_ingredients?.length ?? 0;
  const ids = new Set<string>();
  const add = (arr: any[] | undefined) => (arr ?? []).forEach((i: any) => i?.ingredient_id && ids.add(i.ingredient_id));
  add(m.base_ingredients);
  const variants: any[] = m.sauce_variants ?? [];
  const dv = variants.find((v) => v.is_default) ?? variants[0];
  if (dv) add(dv.ingredients);
  add(m.methods?.[0]?.ingredients);
  add(m.plates?.[0]?.additional_ingredients);
  return ids.size;
}
const HEAT = ['stovetop', 'oven', 'slow_cooker', 'microwave'];

/** N5cSleepScreen clockUpper: the stored "10:30 PM" shape from minutes on its axes. */
function clockUpper(m: number) {
  const d = ((m % 1440) + 1440) % 1440;
  const h = Math.floor(d / 60);
  return `${h % 12 || 12}:${String(d % 60).padStart(2, '0')} ${h < 12 ? 'AM' : 'PM'}`;
}

/** questionnaireRouting.profileNutritionFields (private there), verbatim. */
function profileNutritionFields(profile: any): Record<string, any> {
  const out: Record<string, any> = {};
  if (profile.sex) out.gender = profile.sex;
  if (profile.heightCm != null) out.height = profile.heightCm;
  if (profile.currentWeightKg) out.weight = profile.currentWeightKg;
  return out;
}

// ---------------------------------------------------------------------------
// The replay
// ---------------------------------------------------------------------------

/**
 * The profile RouteScreen has saved when the route locks: the route's answers
 * (entry.ts planProfileFor), and no activity or training sessions, which the
 * route never asks (N4Activity and N4bTraining write them next).
 */
function lockProfileFor(about: any) {
  const p: any = R.planProfileFor(R.goalsProfileFrom(about), about.route || 'lean', R.choiceOf(about));
  delete p.activityLevel;
  delete p.trainingSessionsPerWeek;
  delete p.trainingMinutesPerWeek;
  return p;
}

/** FreezerContext's settings: null until the first save, then what was read back (createSettingsQueue). */
let batchSettings: any = null;

/** useTubsPerDay, as a screen runs it on mount: the draft's calories, no pick. */
async function tubsPerDayNow(): Promise<number> {
  const draft = await loadNutritionAnswers();
  const profile = await loadGoalsProfile();
  const macros = resolvePlanMacros({ ...draft } as any, profile);
  const tpd = tubsPerDayForKcal(macros?.calories);
  return batchSettings?.tubsPerDayPick ?? tpd;
}

/** useSaveBatchSettings. */
async function saveBatch(answers: any, tubsPerDay: number | null) {
  const next = toBatchSettings(answers, batchSettings, tubsPerDay ?? undefined);
  if (answers.shopCadence != null && answers.shopCadence !== next.cadence) await updateNutritionField('shopCadence', next.cadence);
  if (answers.stockUp && !next.stockUp) await updateNutritionField('stockUp', false);
  const ok = await WorkoutStorage.saveBatchSettings(next);
  if (ok) batchSettings = await WorkoutStorage.loadBatchSettings();
  return next;
}

/** MyFoodsContext's list (commit = WorkoutStorage.saveMyFoods). */
let myFoods: any[] = [];
async function commitMyFoods(next: any[]) {
  myFoods = next;
  await WorkoutStorage.saveMyFoods(next);
}

/** The cooker / freezer / cadence screen state the stock up step reads. */
function setupOf(f: any, tpd: number | null) {
  return {
    freezerTubs: f.freezerTubs ?? 16,
    tubsPerDay: tpd ?? 2,
    cookerCount: f.slowCooker === 'none' ? 0 : f.slowCookerCount ?? 1,
  };
}

/** The picks the confirm sheet's Save keeps (handleConfirm's filter) as SlotPicks. */
function savedPicks(f: any, allMeals: any[]) {
  const p = f.picks || {};
  const allergies: string[] = Array.isArray(f.allergies) ? f.allergies : [];
  const ok = p.allergenOk || {};
  const vc = p.versionChoices || {};
  return (p.keys || [])
    .map((scoped: string) => {
      const { slot, key } = unscopeKey(scoped);
      const ci = key.indexOf(':');
      return ci === -1 ? { slot, slug: key } : { slot, slug: key.slice(0, ci), plate_id: key.slice(ci + 1) };
    })
    .filter((pk: any) => {
      const meal = allMeals.find((m) => m.slug === pk.slug);
      if (!meal) return true;
      if (ok[pk.slug]?.mode === 'anyway') return true;
      return plateClashesOf(meal, pk.plate_id ?? heroPlateId(meal), allergies, ok, vc).length === 0;
    });
}

/** CuratedFavoritesScreen plateClashes: the person's allergies in one plate, as cooked. */
function plateClashesOf(meal: any, plateId: string, allergies: string[], allergenOk: any, versionChoices: any): string[] {
  if (!allergenCatch(meal, allergies, { variantChoice: versionChoices[meal.slug] })) return [];
  const ok = allergenOk[meal.slug];
  return versionClashes(
    meal,
    { plateId, variantId: cookingVariantId(meal, versionChoices[meal.slug]) },
    allergies,
    ok?.mode === 'leave_out' ? ok.leaveOut ?? [] : [],
  );
}

/** The picker's meal list (allMeals), as CuratedFavoritesScreen builds it. */
async function pickerMeals(answers: any) {
  const dietPattern = activeDietPattern(answers);
  const fav = await loadCuratedFavoritesV2();
  const noBlender = hidesBlenderMeals(answers, fav, batchSettings);
  return offeredMeals(undefined, dietPattern, undefined, noBlender);
}

/**
 * Replays the answers up to (not including) `upto`, exactly as the screens
 * would have written them, starting from empty storage.
 */
async function replay(about: any, f: any, upto: string) {
  await R.wipe();
  batchSettings = null;
  myFoods = [];
  const reach = (s: string) => before(s, upto);

  // RouteScreen's lock-in: the profile as the route intake left it.
  const lockProfile: any = lockProfileFor(about);
  await saveGoalsProfile(lockProfile);
  await replanRoute('lock', { profile: lockProfile, route: 'balanced' });

  // The workout plan, built first from the finish line (f.plan: the page's
  // built program, as the importer parsed it). useWorkoutImport's
  // handleUnifiedMesocycleImport adds it as the routine; WorkoutBuildScreen's
  // hand-off saves its sessions and minutes a week for calories.
  const program = f.plan?.program;
  if (program) {
    await WorkoutStorage.addRoutine({ id: 'try-plan', name: program.routine_name, days: program.days_per_week || 5, blocks: program.blocks?.length || 0, data: program } as any);
    const builtDays = Number(program.days_per_week) || Number(f.plan.totalTrainingDays);
    if (builtDays > 0) await syncCaloriesToTrainingDays(builtDays, program);
  }

  // continueNutritionFlow: the route's goal and rate, and the profile's facts, over the draft.
  const profile = await loadGoalsProfile();
  const seed = profile ? { ...routeNutritionSeed(profile), ...profileNutritionFields(profile) } : {};
  if (Object.keys(seed).length) await mergeNutritionAnswers(seed as any);
  // beginNutritionSteps: the plan's sessions (else the days answered) and its
  // minutes a week; with sessions known, N4bTraining is left out of the steps.
  let sessions: number | null = profile?.trainingSessionsPerWeek ?? null;
  if (sessions == null) sessions = await trainingDaysFromProgram();
  if (sessions != null) {
    await updateGoalsProfileField('trainingSessionsPerWeek', sessions);
    await updateNutritionField('trainingSessionsPerWeek', sessions);
  }
  const minutes: number | null = await loadPlanMinutesPerWeek();
  if (minutes != null) {
    await updateGoalsProfileField('trainingMinutesPerWeek', minutes);
    await updateNutritionField('trainingMinutesPerWeek', minutes);
  }
  const goal = (await loadNutritionAnswers())?.goal;
  const gaining = asksAppetite(goal);
  const ctx: any = { gaining, goal, trainingKnown: sessions != null };
  if (!reach('active')) return ctx;

  // N4Activity
  await updateGoalsProfileField('activityLevel', about.activityLevel);
  await updateNutritionField('activityLevel', about.activityLevel);
  if (!reach('sessions')) return ctx;
  // N4bTraining: shown with no plan; with one, only when opened from the
  // summary's Training row. Unanswered is unanswered in storage too.
  if (about.trainingChoice === 'yes' || about.trainingChoice === 'no') {
    const planMin = await loadPlanMinutesPerWeek();
    const plan = planMin != null ? { minutes: planMin, sessions: await loadPlanSessionsPerWeek() } : null;
    const no = about.trainingChoice === 'no';
    const mins = no ? 0 : plan?.minutes ?? DEFAULT_TRAINING_MINUTES;
    const sess = no ? 0 : plan?.sessions ?? Math.round(DEFAULT_TRAINING_MINUTES / 60);
    await updateGoalsProfileField('trainingMinutesPerWeek', mins);
    await updateGoalsProfileField('trainingSessionsPerWeek', sess);
    await updateNutritionField('trainingMinutesPerWeek', mins);
    await updateNutritionField('trainingSessionsPerWeek', sess);
  }
  if (!reach('diettype')) return ctx;
  // N5DietType
  await updateNutritionField('dietType', f.dietType);
  if (f.dietType === 'custom') await updateNutritionField('customMacros', f.customMacros);
  if (!reach('meat')) return ctx;
  // N5aDietPattern
  await updateNutritionField('dietPattern', f.dietPattern);
  if (!reach('allergies')) return ctx;
  // N5bAllergies
  await updateNutritionField('allergies', f.allergies || []);
  if (!reach('skip')) return ctx;
  // N5dSkipFoods
  await updateFoodPrefs({ skip: f.skip || [] });
  if (!reach('keeplower')) return ctx;
  // N5eKeepLower: skip means Nothing.
  await updateNutritionField('keepLower', f.keepLower ?? []);
  if (!reach('sleep')) return ctx;
  // N5cSleep: Continue saves; Skip writes nothing.
  const sl = f.sleep;
  if (sl && !sl.skipped) {
    await WorkoutStorage.saveSleepOptimizationResults({
      formData: { bedtime: clockUpper(sl.bed), wakeTime: clockUpper(sl.wake), optimizationLevel: sl.strictness },
      completedAt: new Date().toISOString(),
    } as any);
    if (Object.keys(sl.overrides || {}).length > 0) await saveMealTimesAnswer(sl.overrides);
  }
  if (!reach('eat')) return ctx;
  // N6MealsSnacking
  const SNACK_STYLE: any = { '0': "I don't snack", '1': 'Occasional snacker', '2': 'Occasional snacker', '3+': 'Frequent snacker', ai_decide: 'Let the plan decide' };
  await updateNutritionField('mealsPerDay', f.mealsPerDay);
  await updateNutritionField('snackFrequency', f.snackFrequency);
  await updateNutritionField('snackingStyle', SNACK_STYLE[f.snackFrequency]);
  await updateNutritionField('mealVariety', f.mealVariety || 'balanced');
  if (!reach('snacks')) return ctx;
  // N6gSnacks (stepped over with no snacks a day): own foods as they were added, then the ticks on Continue.
  if (snacksPerDayFromAnswer(f.snackFrequency) !== 0) {
    for (const own of f.snacks?.own || []) {
      const food = newCustomFood(own);
      if (food) await commitMyFoods([...myFoods, food]);
    }
    // SnackChecklist.done: the ticked seeds in checklist order.
    const ticked = new Set<string>(f.snacks?.ticked || []);
    const want = new Set<string>(SNACK_SEEDS.map((s: any) => s.id).filter((id: string) => ticked.has(id)));
    let next = myFoods;
    for (const x of next) if (x.source !== 'custom' && x.kind !== 'breakfast' && snackSeed(x.seedId) && x.active && !want.has(x.id)) next = untick(next, x.id);
    for (const id of want) {
      const s = snackSeed(id);
      if (s) next = tickSeed(next, myFoodFromSnackSeed(s));
    }
    await commitMyFoods(next);
    await updateNutritionField('snackChecklistDone', true);
  }
  if (!reach('appetite')) return ctx;
  // N6eAppetite (gaining only)
  if (gaining) {
    const draft = await loadNutritionAnswers();
    await updateNutritionField('eatingChallenges', withLowAppetite(draft.eatingChallenges ?? [], !!f.lowAppetite));
  }
  if (!reach('dessert')) return ctx;
  // N6aDessert
  await updateNutritionField('dessertFrequency', f.dessertFrequency);
  await updateNutritionField('dessertDays', f.dessertFrequency && f.dessertFrequency !== 'ai_decide' && f.dessertFrequency !== '0' ? f.dessertDays || [] : []);
  if (!reach('cooker')) return ctx;
  // N6bSlowCooker
  {
    const tpd = await tubsPerDayNow();
    const size = f.slowCooker;
    const n = size === 'none' ? 1 : f.slowCookerCount ?? 1;
    await updateNutritionField('slowCooker', size);
    await updateNutritionField('slowCookerCount', n);
    const hasBlender = f.blender == null ? undefined : f.blender === 'yes';
    if (hasBlender != null) await updateNutritionField('blender', hasBlender);
    const draft = await loadNutritionAnswers();
    await updateNutritionField('cookingEquipment', withSlowCookerEquipment(draft.cookingEquipment, size));
    await saveBatch({ ...draft, slowCooker: size, slowCookerCount: n, ...(hasBlender != null ? { blender: hasBlender } : {}) }, tpd);
  }
  if (!reach('freezer')) return ctx;
  // N6cFreezer
  {
    const tpd = await tubsPerDayNow();
    await updateNutritionField('freezerTubs', f.freezerTubs);
    const draft = await loadNutritionAnswers();
    await saveBatch({ ...draft, freezerTubs: f.freezerTubs }, tpd);
  }
  if (!reach('cadence')) return ctx;
  // N6dShopCadence
  {
    const tpd = await tubsPerDayNow();
    const setup = setupOf(f, tpd);
    const picked = f.shopCadence && !cadenceBlockedReason(f.shopCadence, setup) ? f.shopCadence : null;
    await updateNutritionField('shopCadence', picked);
    if (!showsStockUp(setup.freezerTubs, setup.tubsPerDay)) await updateNutritionField('stockUp', false);
    const draft = await loadNutritionAnswers();
    await saveBatch({ ...draft, shopCadence: picked }, tpd);
    ctx.stockUpShown = showsStockUp(setup.freezerTubs, setup.tubsPerDay);
  }
  if (!reach('stockup')) return ctx;
  // N6fStockUp (only when the freezer holds a week)
  if (ctx.stockUpShown) {
    const tpd = await tubsPerDayNow();
    const card = stockUpCard(f.freezerTubs ?? 16, tpd ?? 2);
    const value = card ? !!f.stockUp : false;
    await updateNutritionField('stockUp', value);
    const draft = await loadNutritionAnswers();
    await saveBatch({ ...draft, stockUp: value }, tpd);
  }
  if (!reach('planlength')) return ctx;
  // N9PlanLength: then finalize, and the picker opens with these answers.
  await updateNutritionField('planDuration', 7);
  await updateNutritionField('startDate', f.startDate || 'tomorrow');
  const finalAnswers = await loadNutritionAnswers();
  const macros = await finalizeNutrition(finalAnswers);
  if (!macros) throw new Error('Some required answers are missing.');
  ctx.pickerAnswers = finalAnswers;
  if (!reach('picks')) return ctx;
  // CuratedFavorites: use-up ticks save as they're tapped; Save writes the picks; "Choose for me" writes nothing else.
  if ((f.picks?.useUp || []).length) await saveUseUp(f.picks.useUp);
  if (f.picks?.saved) {
    const allMeals = await pickerMeals(finalAnswers);
    const picks = savedPicks(f, allMeals);
    await saveCuratedFavoritesV2({ picks, cuisines: [], avoid: [], likedDishes: [] });
    await recordPicks(picks).catch(() => undefined);
    const pickedSlugs = new Set(picks.map((p: any) => p.slug));
    const keptOk: any = {};
    for (const [slug, ok] of Object.entries(f.picks.allergenOk || {})) if (pickedSlugs.has(slug)) keptOk[slug] = ok;
    await updateFoodPrefs({ allergenOk: keptOk });
    const stored = await getVariantChoices();
    for (const [slug, variantId] of Object.entries(f.picks.versionChoices || {})) {
      if (pickedSlugs.has(slug) && stored[slug] !== variantId) await setVariantChoice(slug, variantId as string);
    }
  }
  if (!reach('summary')) return ctx;
  // NutritionSummary "Build my meal plan": finalize the resolved answers again.
  const answers = await resolveNutritionAnswers();
  const m2 = await finalizeNutrition(answers);
  if (!m2) throw new Error('Some required answers are missing.');
  return ctx;
}

// ---------------------------------------------------------------------------
// Screen views
// ---------------------------------------------------------------------------

/** The question copy the screens import from batchSetup, so the page never retypes it. */
function mealCopy() {
  return {
    dietPatterns: DIET_PATTERN_OPTIONS, keepLower: KEEP_LOWER_OPTIONS, keepLowerHelp: KEEP_LOWER_HELP,
    cookers: COOKER_OPTIONS, cookerCounts: COOKER_COUNTS, cookerCountNote: COOKER_COUNT_NOTE,
    blender: { title: BLENDER_TITLE, options: BLENDER_OPTIONS, note: BLENDER_NOTE },
    freezers: FREEZER_OPTIONS, cadences: CADENCE_OPTIONS,
    stockUp: { title: STOCK_UP_TITLE, intro: STOCK_UP_INTRO, options: STOCK_UP_OPTIONS, foot: STOCK_UP_FOOTNOTE },
  };
}

/** N5dSkipFoods' lists: the common ones, whole groups, and every food A to Z. */
let catalogueCache: any = null;
function foodCatalogueView() {
  if (catalogueCache) return catalogueCache;
  const cat = buildFoodCatalogue();
  const popular = popularFoods(cat);
  const shown = new Set(popular.map((x: any) => x.id));
  const browse = browseFoods(cat);
  const quick = quickFoods(cat);
  const items = browse.sections.flatMap((s: any) => s.items);
  catalogueCache = {
    popular: popular.map((x: any) => ({ id: x.id, name: x.name })),
    groups: browse.groups.filter((g: any) => !shown.has(g.food.id)).map((g: any) => ({ id: g.food.id, name: g.food.name, meals: g.meals })),
    sections: browse.sections.map((s: any) => ({ letter: s.letter, items: s.items.map((r: any) => ({ id: r.food.id, name: r.food.name, meals: r.meals })) })),
    count: browse.count,
    names: Object.fromEntries(cat.map((x: any) => [x.id, x.name])),
    // The picker's "Got food to use up?" chips and the All foods sheet (by aisle, most-used first).
    quickUseUp: quick.map((q: any) => ({ label: q.label, id: q.food.id, name: q.food.name })),
    aisles: AISLES.map((a: any) => ({
      label: a.label,
      items: items
        .filter((r: any) => aisleOf(r.food) === a.label)
        .sort((x: any, y: any) => y.meals - x.meals || x.food.name.localeCompare(y.food.name))
        .map((r: any) => ({ id: r.food.id, name: r.food.name, meals: r.meals, syn: r.food.synonyms })),
    })).filter((g: any) => g.items.length),
  };
  return catalogueCache;
}

/** N5dSkipFoods' search box. */
function foodSearch(q: string) {
  return searchFoods(q, 6).map((r: any) => ({ id: r.food.id, name: r.food.name, meals: r.meals, alias: r.alias || null }));
}

/** N5dSkipFoods' footer: what the skips do to the picker, over the whole library. */
function skipImpact(skip: string[]) {
  if (!skip?.length) return null;
  const cat = buildFoodCatalogue();
  let lower = 0, kept = 0;
  for (const m of offeredMeals()) {
    const v = skipVerdict(m, skip, { catalogue: cat });
    if (v.kind === 'has') lower++;
    else if (v.kind !== 'clear') kept++;
  }
  return { lower, kept };
}

/** N5cSleepScreen's "Your day" list: deriveDayMealTimes for these times and this day's shape. */
function dayTimes(sleep: any, shape: any, overrides: any) {
  const day = deriveDayMealTimes(sleep, { ...shape, overrides });
  const win = mealWindow(sleep);
  return { rows: day.rows, dessertDinner: day.dessertDinner, wake: win.wake, bed: win.bed };
}

/** Per-screen data, read the way each screen reads it after the replay. */
async function mealView(about: any, f: any, screen: string) {
  const ctx = await replay(about, f, screen);
  const out: any = { gaining: ctx.gaining, trainingKnown: ctx.trainingKnown };
  if (screen === 'sessions') {
    // N4bTrainingScreen's focus read: the plan's minutes and sessions, and an earlier answer.
    const [minutes, sessions, p] = [await loadPlanMinutesPerWeek(), await loadPlanSessionsPerWeek(), await loadGoalsProfile()];
    const answers: any = (await loadNutritionAnswers()) ?? {};
    out.training = {
      plan: minutes != null ? { minutes, sessions, label: trainingTimeLabel(minutes) } : null,
      knownMinutes: p?.trainingMinutesPerWeek ?? answers.trainingMinutesPerWeek ?? null,
      knownSessions: p?.trainingSessionsPerWeek ?? answers.trainingSessionsPerWeek ?? null,
    };
  }
  if (screen === 'diettype') {
    const answers = { ...((await resolveNutritionAnswers()) ?? {}) };
    const profile = await loadGoalsProfile();
    const pv: any = {};
    for (const v of ['balanced', 'high_protein', 'low_carb', 'keto']) pv[v] = dietSplitPreview(answers, profile, v);
    const c = f.customMacros;
    pv.custom = c && [c.protein, c.carbs, c.fat].every(Number.isFinite) && c.protein + c.carbs + c.fat === 100 ? dietSplitPreview(answers, profile, 'custom', c) : null;
    const any = pv.balanced ?? pv.high_protein ?? null;
    out.previews = pv;
    out.floor = any ? { phrase: phasePhrase(any.phase), g: any.floorG } : null;
  }
  if (screen === 'sleep' || screen === 'eat') {
    const resolved = (await resolveNutritionAnswers()) ?? {};
    out.shape = { mainSlots: planMainSlots(resolved), snack: resolved.snackFrequency !== '0', dessert: !!resolved.dessertFrequency && resolved.dessertFrequency !== '0' };
    out.savedSleep = (await WorkoutStorage.loadSleepOptimizationResults())?.formData ?? null;
  }
  if (screen === 'snacks') {
    const allergies: string[] = f.allergies || [];
    const per = snacksPerDayFromAnswer(f.snackFrequency);
    const rec = recommendedSnackPicks(per);
    out.snacks = {
      per, recommended: rec, why: snackPicksWhy(per),
      groups: Object.keys(SNACK_GROUP_LABELS).map((g) => ({
        id: g, label: SNACK_GROUP_LABELS[g],
        items: SNACK_SEEDS.filter((s: any) => s.group === g).map((s: any) => ({
          id: s.id, name: s.name, serve: s.serve, kcal: s.kcal, protein: s.protein, canDouble: s.canDouble, needsPrep: s.needsPrep,
          allergens: s.allergens, clash: myFoodAllergenHit(myFoodFromSnackSeed(s), allergies),
        })),
      })),
      initial: DEFAULT_TICKED_SNACKS.filter((id: string) => {
        const s = SNACK_SEEDS.find((x: any) => x.id === id);
        return s && !myFoodAllergenHit(myFoodFromSnackSeed(s), allergies);
      }).slice(0, rec),
    };
  }
  if (['cooker', 'freezer', 'cadence', 'stockup'].includes(screen)) {
    const tpd = await tubsPerDayNow();
    const setup = setupOf(f, tpd);
    out.tubsPerDay = tpd;
    out.blocked = Object.fromEntries(CADENCE_OPTIONS.map((o: any) => [o.value, cadenceBlockedReason(o.value, setup)]));
    out.stockUpShows = showsStockUp(setup.freezerTubs, setup.tubsPerDay);
    out.stockUpCard = stockUpCard(f.freezerTubs ?? 16, tpd ?? 2);
    out.stockUpHint = stockUpHint(f.slowCooker, f.slowCookerCount);
  }
  if (screen === 'planlength') {
    out.planDays = planDaysFor(f, BATCH_PLANNER && BATCH_LIBRARY);
  }
  if (screen === 'picks') out.picker = await pickerView(f, ctx.pickerAnswers);
  if (screen === 'summary') out.summary = await summaryView();
  return out;
}

/** CuratedFavoritesScreen's data for every tab: meals in grid order with all they need, shelves per filter, mains count. */
async function pickerView(f: any, answers: any) {
  const allMeals = await pickerMeals(answers);
  const allergies: string[] = Array.isArray(answers.allergies) ? answers.allergies : [];
  const skip: string[] = (await loadFoodPrefs()).skip;
  const batchPlanOn = batchActive(answers, { batch: {} });
  const tabs = buildTabs(answers.mealsPerDay, answers.snackFrequency, answers.dessertFrequency, allMeals);
  const vc = f.picks?.versionChoices || {};
  const ok = f.picks?.allergenOk || {};
  const stored = await getVariantChoices();
  const cat = buildFoodCatalogue();
  const have = (f.picks?.useUp || []).map((id: string) => cat.find((x: any) => x.id === id)).filter(Boolean);
  const meals: any = {};
  const card = (m: any) => {
    if (meals[m.slug]) return;
    const c = allergenCatch(m, allergies, { variantChoice: vc[m.slug] });
    const v = skip.length ? skipVerdict(m, skip, { variantChoice: stored[m.slug] }) : { kind: 'clear' };
    meals[m.slug] = {
      slug: m.slug, name: m.display_name, image: m.image_filename ?? m.plates?.[0]?.image_filename ?? null, effort: effortMinutes(m), ings: ingredientCount(m),
      noCook: !((m.methods?.[0]?.equipment_required ?? []) as string[]).some((e) => HEAT.includes(e)),
      bigBatch: (m.produces_servings ?? 1) > 1,
      quick: splitQuickOrMadeAhead([m]).quick.length > 0,
      full: m?.batch?.size === 'full',
      hero: heroPlateId(m),
      plates: (m.plates ?? []).map((p: any) => ({
        id: p.id, name: p.display_name, image: p.image_filename ?? null, stunt: !!p.is_stunt_plate, kcal: p.plate_macros?.kcal ?? 0, protein: p.plate_macros?.protein_g ?? 0,
        clash: c ? versionClashes(m, { plateId: p.id, variantId: cookingVariantId(m, vc[m.slug]) }, allergies, ok[m.slug]?.mode === 'leave_out' ? ok[m.slug].leaveOut ?? [] : []) : [],
        skipHas: skip.length ? (() => { const sv = skipVerdict(m, skip, { plateId: p.id, variantChoice: vc[m.slug] }); return sv.kind === 'has' ? foodList(sv.foods) : null; })() : null,
      })),
      catch: c ? { clashes: c.clashes, words: allergenList(c.clashes), heroClashes: c.heroClashes, heroWords: allergenList(c.heroClashes), culprits: c.culprits.map((x: any) => x.name), offer: c.offer, heroVariant: c.hero.variantId } : null,
      skip: v.kind === 'clear' ? null : {
        kind: v.kind, foods: foodList(v.foods), variantId: v.variantId || null, variantName: v.variantName || null,
        // onCardPress: the skip-free version is used only when it is allergen-safe too.
        safe: v.kind === 'version' ? !c || versionClashes(m, { plateId: heroPlateId(m), variantId: v.variantId }, allergies).length === 0 : true,
      },
    };
  };
  const shelfKind = BATCH_LIBRARY ? goalShelfKind(answers) : null;
  const keepSaltLower = BATCH_LIBRARY && wantsLowSalt(answers.keepLower);
  const FILTERS: any = {
    all: (x: any[]) => x,
    quick: (x: any[]) => x.filter((m) => { const e = effortMinutes(m); return e > 0 && e <= 10; }),
    no_cook: (x: any[]) => x.filter((m) => !((m.methods?.[0]?.equipment_required ?? []) as string[]).some((e) => HEAT.includes(e))),
    batch: (x: any[]) => x.filter((m) => (m.produces_servings ?? 1) > 1),
  };
  const tabsOut = tabs.map((tab: any) => {
    const slots = slotsForTab(tab);
    const base = batchMainsOnly(mealsForSlots(slots, allMeals, emptyFilter(), 'default'), slots as string[], batchPlanOn);
    const mainsTab = (slots as string[]).some((x) => x === 'lunch' || x === 'dinner');
    const byFilter: any = {};
    for (const k of Object.keys(FILTERS)) {
      const sorted = FILTERS[k](base)
        .map((m: any, i: number) => ({ m, i, e: effortMinutes(m), n: ingredientCount(m) }))
        .sort((a: any, b: any) => a.e - b.e || a.n - b.n || a.i - b.i)
        .map((x: any) => x.m);
      const { top, bottom } = orderBySkips(sorted, (m: any) => (skip.length ? skipVerdict(m, skip, { variantChoice: stored[m.slug] }) : { kind: 'clear' }));
      const goal = shelfKind && mainsTab ? goalShelf(shelfKind, top) : [];
      const salt = keepSaltLower && mainsTab ? lowSaltShelf(withoutShelf(top, goal)) : [];
      [...top, ...bottom].forEach(card);
      byFilter[k] = {
        top: top.map((m: any) => m.slug), low: bottom.map((m: any) => m.slug),
        goal: goal.map((x: any) => ({ slug: x.meal.slug, reason: x.reason })),
        salt: salt.map((x: any) => ({ slug: x.meal.slug, mg: x.sodiumMg })),
      };
    }
    const tabAll = mealsForSlots(slots, allMeals, emptyFilter(), 'default');
    const useUp = have.length ? rankUseUp(tabAll, have).slice(0, 10).map(({ meal, hits }: any) => { card(meal); return { slug: meal.slug, sub: usesLabel(hits) }; }) : [];
    // unitsForTab's eligibility (which picks count in this tab), in shelf order.
    const eligible = base.map((m: any) => { card(m); return m.slug; });
    return { id: tabId(tab), kind: tab.kind, shelf: tab.shelf || null, slot: tab.slot || null, label: tabLabel(tab), planSlot: tabSlot(tab), lists: byFilter, useUp, eligible };
  });
  const mainsSettings = BATCH_LIBRARY && BATCH_PLANNER ? batchSettings ?? toBatchSettings(answers, null) : null;
  const rec = mainsSettings ? recommendedMainPicks(mainsSettings) : null;
  return {
    tabs: tabsOut, meals, batchPlanOn,
    mainsRec: rec, mainsLine: rec != null ? recommendMainsLine(rec) : null, mainsWhy: mainsSettings ? mainPicksWhy(mainsSettings) : null,
    shelf: shelfKind ? goalShelfCopy(shelfKind) : null,
    avoid: Array.from(checkableAllergies(allergies)).length ? allergenList(allergies.filter((a) => checkableAllergies([a]).size)) : '',
    unlabelled: unlabelledAllergies(allergies),
    mealVariety: answers.mealVariety, dessertFrequency: answers.dessertFrequency,
  };
}

/** "Fill my week": the best use-up meals for every tab that has no picks yet (CuratedFavoritesScreen.fillWeek). */
async function fillWeek(about: any, f: any) {
  const ctx = await replay(about, f, 'picks');
  const answers = ctx.pickerAnswers;
  const allMeals = await pickerMeals(answers);
  const allergies: string[] = Array.isArray(answers.allergies) ? answers.allergies : [];
  const skip: string[] = (await loadFoodPrefs()).skip;
  const stored = await getVariantChoices();
  const vc = f.picks?.versionChoices || {};
  const okMap = f.picks?.allergenOk || {};
  const cat = buildFoodCatalogue();
  const have = (f.picks?.useUp || []).map((id: string) => cat.find((x: any) => x.id === id)).filter(Boolean);
  const tabs = buildTabs(answers.mealsPerDay, answers.snackFrequency, answers.dessertFrequency, allMeals);
  const next = new Set<string>(f.picks?.keys || []);
  let n = 0;
  for (const tab of tabs) {
    const slot = tabSlot(tab);
    if ([...next].some((k) => k.startsWith(slot + '|'))) continue;
    const meals = mealsForSlots(slotsForTab(tab), allMeals, emptyFilter(), 'default');
    const ok = (m: any) =>
      !(allergenCatch(m, allergies, { variantChoice: vc[m.slug] }) && plateClashesOf(m, heroPlateId(m), allergies, okMap, vc).length > 0) &&
      (skip.length ? skipVerdict(m, skip, { variantChoice: stored[m.slug] }).kind : 'clear') !== 'has';
    for (const p of fillFromUseUp([{ slot, meals }], have, ok)) {
      const meal = meals.find((m: any) => m.slug === p.slug);
      if (!meal) continue;
      next.add((meal.plates?.length ?? 0) > 1 ? scopeKey(slot, `${meal.slug}:${meal.plates[0].id}`) : scopeKey(slot, meal.slug));
      n++;
    }
  }
  return { keys: [...next], added: n, names: have.map((x: any) => x.name.toLowerCase()).slice(0, 3).join(', ') };
}

/** NutritionSummaryScreen's data: the resolved answers, the plan's macros, the phase note, the side rows. */
async function summaryView() {
  const a: any = await resolveNutritionAnswers();
  const profile: any = await loadGoalsProfile();
  const favs = await loadCuratedFavoritesV2();
  const macros = resolvePlanMacros(a, profile);
  const sleep = (await WorkoutStorage.loadSleepOptimizationResults())?.formData;
  const prefs = await loadFoodPrefs();
  const skipNames = prefs.skip.map((id: string) => foodById(id)?.name).filter(Boolean);
  const phase = profile && profile.goalWeightKg != null ? derivePhase(profile) : null;
  const seed = profile ? routeNutritionSeed(profile) : null;
  return {
    answers: a,
    macros,
    favCount: (favs.picks ?? []).length || (favs.slugs ?? []).length,
    sleep: sleep?.bedtime && sleep?.wakeTime ? { bedtime: sleep.bedtime, wakeTime: sleep.wakeTime, level: sleep.optimizationLevel } : null,
    skip: skipNames.length ? skipNames.join(', ') : null,
    note: phase ? { phase, bf: profile.currentBodyFatPct, trainingState: profile.trainingState, seedPct: seed?.targetRatePercentage, weightKg: profile.currentWeightKg } : null,
    labels: {
      training: trainingTimeLabel(a.trainingMinutesPerWeek, a.trainingSessionsPerWeek), meat: dietPatternLabel(a.dietPattern), keepLower: keepLowerLabel(a.keepLower),
      appetite: BATCH_PLANNER && asksAppetite(a.goal) ? (Array.isArray(a.eatingChallenges) ? (hasLowAppetite(a.eatingChallenges) ? 'Yes' : 'No') : 'Not set') : null,
      cooker: cookerLabel(a.slowCooker, a.slowCookerCount), blender: blenderLabel(a.blender), freezer: freezerLabel(a.freezerTubs), cadence: cadenceLabel(a.shopCadence),
      stockUp: BATCH_PLANNER && (a.stockUp === true || showsStockUp(a.freezerTubs, 1)) ? stockUpLabel(a.stockUp) : null,
      planDays: planDaysFor(a, BATCH_PLANNER && BATCH_LIBRARY).days === 14 ? 14 : a.planDuration,
    },
  };
}

// ---------------------------------------------------------------------------
// The build
// ---------------------------------------------------------------------------

/** Every meal a plan can hold (for the photo index), with plate photos. */
function allMeals() {
  const out: any[] = [];
  for (const m of Object.values(CURATED_MEALS) as any[]) out.push({ slug: m.slug, image_filename: m.image_filename, batch: m.batch ? { variant_of: m.batch.variant_of } : undefined, plates: (m.plates ?? []).map((p: any) => ({ id: p.id, image_filename: p.image_filename })) });
  for (const m of batchFoodViews() as any[]) out.push({ slug: m.slug, image_filename: m.image_filename });
  return out;
}

/** The meal lookup useMealLookup builds on a phone with no own meals: curated + seeds and add-ons. */
function mealLookup() {
  const merged: any = { ...CURATED_MEALS };
  for (const v of batchFoodViews() as any[]) if (v?.slug) merged[v.slug] = v;
  return merged;
}

/** The last build, so the gap panel can check fixes against it (MealBuildScreen's `result`). */
let lastResult: any = null;
let lastFixes: any[] = [];

/**
 * MealBuildScreen: the answers replayed through every screen, then
 * generateMealPlanFromStorage(undefined, [], recent, plans, checkIn, accepted)
 * as a first build calls it (no saved plans, no freezer check-in), and
 * `accepted` when "Add X" on the batch note asked for a rebuild.
 */
async function buildMeals(about: any, food: any, opts: any = {}) {
  await replay(about, food, 'build');
  const t0 = Date.now();
  const r = await generateMealPlanFromStorage(undefined, [], [], [], undefined, opts.accepted ?? null);
  const ms = Date.now() - t0;
  lastResult = r;
  lastFixes = [];
  return { ms, ...(await resultView(r)) };
}

/** What the page draws from a built plan: act 2, the batch note, the week list, the gap, the days, the cooks, the shopping list. */
async function resultView(r: any) {
  const { plan, report } = r;
  const favs = await loadCuratedFavoritesV2();
  const lookup = withPlanSwaps(mealLookup(), plan);
  const cooks = (plan.batch?.cookDays ?? [])
    .filter((c: any) => (c?.pots ?? []).length)
    .sort((a: any, b: any) => (a.date < b.date ? -1 : 1))
    .map((cd: any) => {
      const session = prepSessionFromCook(cd, lookup, bookedByPot(plan.batch));
      return {
        date: cd.date,
        pots: cd.pots.map((p: any) => ({ name: p.name, recipe: p.recipe, fullRecipe: p.fullRecipe, tubs: p.tubs, toFridge: p.toFridge, toFreezer: p.toFreezer, method: p.method })),
        handsOnMinutes: session.totals.activeMinutes,
        tubs: cd.pots.reduce((n: number, p: any) => n + (Number(p.tubs) || 0), 0),
      };
    });
  const inputs = resolveGroceryInputs({ plan, choices: {} as any, mealLookup: lookup, batch: true, myFoods: sanitizeMyFoods(await WorkoutStorage.loadMyFoods()) });
  const rows = (inputs.view?.rows ?? []).map((row: any) => {
    const id = row.batch?.ingredientId ?? (String(row.key).startsWith('ing:') ? String(row.key).slice(4).split('|')[0] : null);
    const negligible = !!(id && (INGREDIENTS as any)[id]?.is_pantry_negligible);
    return { key: row.key, name: row.name, amount: row.amount, category: row.category, note: row.note || null, section: row.section || null, negligible };
  });
  const grid = weekGrid(plan, report.frozen);
  const gap = gapToShow(report);
  return {
    plan: { startDate: plan.startDate, endDate: plan.endDate, dailyMeals: plan.dailyMeals, targets: plan.targets, name: plan.name, cookDayCount: (plan.batch?.cookDays ?? []).length },
    report: {
      days: report.days, targets: report.targets, misses: report.misses, counts: report.counts, avg: report.avg, kept: report.kept,
      dropped: (report.dropped ?? []).map((slot: string) => ({ slot, word: slotNoteWord(slot) })),
      proteinCeiling: report.proteinCeiling ?? null, kcalGap: report.kcalGap ?? null,
      batch: report.batch ? { potsToCook: report.batch.potsToCook, tubsBanked: report.batch.tubsBanked, tubsFromStock: report.batch.tubsFromStock, status: report.batch.status, tubsPerDay: report.batch.tubsPerDay, ownTubsPerDay: report.batch.ownTubsPerDay } : null,
    },
    favourites: favs.picks?.length ?? report.counts.favourites,
    grid: { days: grid.days, cells: grid.rows.flat().map((c: any) => ({ key: c.key, slug: c.slug ?? null, image: c.image ?? null, batch: !!c.batch, frozen: !!c.frozen })) },
    wall: wallImages(favs, plan),
    note: batchBuildNote((report as any).batch),
    week: batchWeekList(plan),
    gap,
    cooks,
    grocery: { rows, sections: (inputs.batchShop?.sections ?? []).map((s: any) => ({ key: s.key, title: s.title })), freezerLine: inputs.batchShop?.freezerLine ?? null, categoryOrder: CATEGORY_ORDER, categoryNames: CATEGORY_NAMES },
  };
}

/** GapPanel's checked options: each fix's week really rebuilt (checkFixes), as the app shows them. */
async function gapOptions() {
  if (!lastResult) throw new Error('no plan');
  const target = gapToShow(lastResult.report) ?? 'protein';
  lastFixes = await checkFixes(lastResult, target);
  return lastFixes.map((o: any, i: number) => ({
    i, inRange: !!o.inRange, otherMiss: o.otherMiss || null, value: o.value,
    fixes: o.fixes.map((fx: any) => ({ kind: fx.kind, slot: fx.slot, slug: fx.slug ?? null, name: fx.name ?? null, image: fx.image ?? null, answers: fx.answers ?? null, title: fixTitle(fx, lastResult.profile) })),
  }));
}

/** "Use this plan" on a gap option: the fixes saved (saveMealFixes), and that exact week is the plan. */
async function useGapOption(i: number) {
  const o = lastFixes[i];
  if (!o) throw new Error('no option');
  await saveMealFixes(o.fixes, lastResult.profile);
  return resultView({ plan: o.plan, report: o.report, profile: o.profile });
}

/** The hand-off: the plan is saved and "Got food to use up?" is cleared for the next one. */
async function handoff() {
  await clearUseUp().catch(() => undefined);
  return true;
}

export default { lockProfileFor, dayTimes, mealCopy, foodCatalogueView, foodSearch, skipImpact, mealView, fillWeek, allMeals, buildMeals, gapOptions, useGapOption, handoff, initMeals, replay };
