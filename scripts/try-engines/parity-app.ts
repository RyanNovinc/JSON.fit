// The app's meal path, transcribed screen by screen for scripts/try-engines/parity.mjs.
// @ts-nocheck
//
// Written from the screens' own handlers (src/screens/RouteScreen.tsx lock-in,
// RouteReveal's finish line sending training first (questionnaireRouting
// finishLineFor: "Next: my training"), WorkoutBuildScreen's hand-off
// (syncCaloriesToTrainingDays) and the importer's addRoutine,
// utils/questionnaireRouting.continueNutritionFlow + beginNutritionSteps, each
// N screen's handleNext with its answersSoFar params as React Navigation passes
// them, components/questionnaire/BatchQuestion's useTubsPerDay and
// useSaveBatchSettings, components/nutrition/SnackChecklist + MyFoodsContext,
// CuratedFavoritesScreen.handleConfirm, NutritionSummaryScreen.proceedToPrompt,
// MealBuildScreen's first build), NOT from the web's meals-part.ts. parity.mjs
// runs the same taps through both and diffs the week they build.
//
// The taps are the page's food state (try.js S.food). Built by parity.mjs with
// the same esbuild stubs and flags as the page's engines.

import AsyncStorage from '@react-native-async-storage/async-storage';
import { saveGoalsProfile, loadGoalsProfile, updateGoalsProfileField } from 'APP_DIR/src/utils/goalsProfileStorage';
import { replanRoute } from 'APP_DIR/src/utils/phaseJourney';
import { routeNutritionSeed } from 'APP_DIR/src/utils/routeNutritionSeed';
import {
  loadNutritionAnswers, mergeNutritionAnswers, updateNutritionField, resolveNutritionAnswers, saveMealTimesAnswer, trainingDaysFromProgram,
} from 'APP_DIR/src/utils/nutritionQuestionnaireStorage';
import { nutritionStepsFor, withoutStep } from 'APP_DIR/src/utils/nutritionSteps';
import { asksAppetite, withLowAppetite, toBatchSettings, tubsPerDayForKcal, withSlowCookerEquipment, cadenceBlockedReason, showsStockUp, stockUpCard } from 'APP_DIR/src/utils/batchSetup';
import { DEFAULT_BATCH_SETTINGS } from 'APP_DIR/src/utils/tubInventory';
import { resolvePlanMacros, finalizeNutrition, DEFAULT_TRAINING_MINUTES } from 'APP_DIR/src/utils/nutritionMacros';
import { syncCaloriesToTrainingDays, loadPlanMinutesPerWeek, loadPlanSessionsPerWeek } from 'APP_DIR/src/utils/trainingDaysSync';
import { updateFoodPrefs } from 'APP_DIR/src/utils/foodPrefs';
import { WorkoutStorage } from 'APP_DIR/src/utils/storage';
import { snacksPerDayFromAnswer, newCustomFood, untick, tickSeed, myFoodFromSnackSeed } from 'APP_DIR/src/utils/myFoods';
import { snackSeed, SNACK_SEEDS } from 'APP_DIR/src/data/snackChecklist';
import { saveCuratedFavoritesV2, loadCuratedFavoritesV2 } from 'APP_DIR/src/utils/curatedFavoritesStorage';
import { recordPicks, saveUseUp } from 'APP_DIR/src/utils/useUp';
import { getVariantChoices, setVariantChoice } from 'APP_DIR/src/utils/variantChoices';
import { offeredMeals, hidesBlenderMeals } from 'APP_DIR/src/utils/offeredMeals';
import { activeDietPattern } from 'APP_DIR/src/utils/dietPattern';
import { allergenCatch, versionClashes } from 'APP_DIR/src/utils/allergenCatch';
import { cookingVariantId, heroPlateId } from 'APP_DIR/src/utils/mealVersions';
import { unscopeKey } from 'APP_DIR/src/utils/basketCheck';
import { generateMealPlanFromStorage } from 'APP_DIR/src/utils/mealGenerator';
import { resolveGroceryInputs } from 'APP_DIR/src/utils/groceryState';
import { withPlanSwaps } from 'APP_DIR/src/utils/lowSalt';
import { CURATED_MEALS } from 'APP_DIR/src/data/curated_meals';
import { batchFoodViews } from 'APP_DIR/src/utils/mealGenerator/batchPlan';
import { sanitizeMyFoods } from 'APP_DIR/src/utils/myFoods';

/** FreezerContext: settings as loaded at app start (none for a new user), then each saved value read back. */
const freezer = { settings: null as any };
/** MyFoodsContext listRef. */
let myFoodsList: any[] = [];

async function useTubsPerDay(answersSoFar: any) {
  const draft = await loadNutritionAnswers();
  const profile = await loadGoalsProfile();
  const macros = resolvePlanMacros({ ...answersSoFar, ...draft } as any, profile);
  return freezer.settings?.tubsPerDayPick ?? tubsPerDayForKcal(macros?.calories);
}
async function saveBatch(answers: any, tubsPerDay: any) {
  const next = toBatchSettings(answers, freezer.settings, tubsPerDay ?? undefined);
  if (answers.shopCadence != null && answers.shopCadence !== next.cadence) await updateNutritionField('shopCadence', next.cadence);
  if (answers.stockUp && !next.stockUp) await updateNutritionField('stockUp', false);
  const ok = await WorkoutStorage.saveBatchSettings(next);
  if (ok) freezer.settings = await WorkoutStorage.loadBatchSettings();
  return next;
}
const commit = async (next: any[]) => {
  myFoodsList = next;
  await WorkoutStorage.saveMyFoods(next as any);
};

/**
 * `lockProfile` is the route's saved profile at lock-in (the page's route
 * section owns how it gets there); everything after the lock is the app.
 */
export async function appMealPath(lockProfile: any, about: any, taps: any) {
  await AsyncStorage.clear();
  freezer.settings = null;
  myFoodsList = [];
  // RouteScreen lock-in.
  await saveGoalsProfile(lockProfile);
  await replanRoute('lock', { profile: lockProfile, route: 'balanced' });

  // RouteReveal "Next: my training" -> ... -> WorkoutBuildScreen. `taps.plan`
  // is the program it built (parity-training.mjs checks that one against the
  // app's). handoff(): syncCaloriesToTrainingDays(builtDays, result.program),
  // then confirmImport -> handleUnifiedMesocycleImport -> addRoutine.
  if (taps.plan?.program) {
    const program = taps.plan.program;
    const builtDays = Number(program.days_per_week) || Number(taps.plan.totalTrainingDays);
    if (builtDays > 0) await syncCaloriesToTrainingDays(builtDays, program);
    await WorkoutStorage.addRoutine({ id: 'app-plan', name: program.routine_name, days: program.days_per_week || 5, blocks: program.blocks?.length || 0, data: program } as any);
  }

  // RouteReveal "Next: my meals" -> startNutritionFlow(justOnboarded) -> continueNutritionFlow.
  const profile = await loadGoalsProfile();
  const seed: any = {};
  if (profile) {
    Object.assign(seed, routeNutritionSeed(profile));
    if (profile.sex) seed.gender = profile.sex;
    if (profile.heightCm != null) seed.height = profile.heightCm;
    if (profile.currentWeightKg) seed.weight = profile.currentWeightKg;
  }
  const merged = Object.keys(seed).length ? await mergeNutritionAnswers(seed) : await loadNutritionAnswers();
  // beginNutritionSteps
  let sessions = profile?.trainingSessionsPerWeek ?? null;
  if (sessions == null) sessions = await trainingDaysFromProgram();
  if (sessions != null) {
    await updateGoalsProfileField('trainingSessionsPerWeek', sessions);
    await updateNutritionField('trainingSessionsPerWeek', sessions);
  }
  let minutes: number | null = await loadPlanMinutesPerWeek();
  if (minutes != null) {
    await updateGoalsProfileField('trainingMinutesPerWeek', minutes);
    await updateNutritionField('trainingMinutesPerWeek', minutes);
  } else {
    minutes = profile?.trainingMinutesPerWeek ?? null;
  }
  let steps: string[] = nutritionStepsFor({ age: profile?.ageYears != null, training: sessions != null, gaining: asksAppetite(merged?.goal) });
  let p: any = { ...merged, ...(sessions != null ? { trainingSessionsPerWeek: sessions } : {}), ...(minutes != null ? { trainingMinutesPerWeek: minutes } : {}) };
  const route = (name: string) => ({ name, params: { steps } });

  for (const step of [...steps]) {
    if (!steps.includes(step)) continue;
    switch (step) {
      case 'N4Activity':
        await updateGoalsProfileField('activityLevel', about.activityLevel);
        await updateNutritionField('activityLevel', about.activityLevel);
        p = { ...p, activityLevel: about.activityLevel };
        break;
      case 'N4bTraining': {
        // "Are you training right now?": Yes, most weeks / Not right now.
        const choice = about.trainingChoice;
        if (choice !== 'yes' && choice !== 'no') throw new Error('training not answered');
        const planMinutes = await loadPlanMinutesPerWeek();
        const plan = planMinutes != null ? { minutes: planMinutes, sessions: await loadPlanSessionsPerWeek() } : null;
        const mins = choice === 'no' ? 0 : plan?.minutes ?? DEFAULT_TRAINING_MINUTES;
        const sess = choice === 'no' ? 0 : plan?.sessions ?? Math.round(DEFAULT_TRAINING_MINUTES / 60);
        await updateGoalsProfileField('trainingMinutesPerWeek', mins);
        await updateGoalsProfileField('trainingSessionsPerWeek', sess);
        await updateNutritionField('trainingMinutesPerWeek', mins);
        await updateNutritionField('trainingSessionsPerWeek', sess);
        p = { ...p, trainingSessionsPerWeek: sess, trainingMinutesPerWeek: mins };
        break;
      }
      case 'N5DietType': {
        const customMacros = taps.dietType === 'custom' ? taps.customMacros : undefined;
        await updateNutritionField('dietType', taps.dietType);
        if (customMacros) await updateNutritionField('customMacros', customMacros);
        p = { ...p, dietType: taps.dietType, ...(customMacros ? { customMacros } : {}) };
        break;
      }
      case 'N5aDietPattern':
        await updateNutritionField('dietPattern', taps.dietPattern);
        p = { ...p, dietPattern: taps.dietPattern };
        break;
      case 'N5bAllergies':
        await updateNutritionField('allergies', taps.allergies);
        p = { ...p, allergies: taps.allergies };
        break;
      case 'N5dSkipFoods':
        await updateFoodPrefs({ skip: taps.skip });
        break;
      case 'N5eKeepLower': {
        const value = taps.keepLower ?? [];
        await updateNutritionField('keepLower', value);
        p = { ...p, keepLower: value };
        break;
      }
      case 'N5cSleep': {
        const s = taps.sleep;
        if (s && !s.skipped) {
          const clock = (m: number) => { const d = ((m % 1440) + 1440) % 1440; const h = Math.floor(d / 60); return `${h % 12 || 12}:${String(d % 60).padStart(2, '0')} ${h < 12 ? 'AM' : 'PM'}`; };
          await WorkoutStorage.saveSleepOptimizationResults({ formData: { bedtime: clock(s.bed), wakeTime: clock(s.wake), optimizationLevel: s.strictness }, completedAt: new Date().toISOString() } as any);
          const overrides = s.overrides ?? {};
          if (Object.keys(overrides).length > 0) await saveMealTimesAnswer(overrides);
          p = { ...p, mealTimes: overrides };
        }
        break;
      }
      case 'N6MealsSnacking': {
        const styles: any = { '0': "I don't snack", '1': 'Occasional snacker', '2': 'Occasional snacker', '3+': 'Frequent snacker', ai_decide: 'Let the plan decide' };
        await updateNutritionField('mealsPerDay', taps.mealsPerDay);
        await updateNutritionField('snackFrequency', taps.snackFrequency);
        await updateNutritionField('snackingStyle', styles[taps.snackFrequency]);
        await updateNutritionField('mealVariety', taps.mealVariety ?? 'balanced');
        p = { ...p, mealsPerDay: taps.mealsPerDay, snackFrequency: taps.snackFrequency, snackingStyle: styles[taps.snackFrequency], mealVariety: taps.mealVariety ?? 'balanced' };
        break;
      }
      case 'N6gSnacks': {
        if (snacksPerDayFromAnswer(p.snackFrequency) === 0) {
          steps = withoutStep(route('N6gSnacks'), 'N6gSnacks').steps!;
          break;
        }
        // AddMyFoodSheet -> addOwn, as each one is added.
        for (const own of taps.snacks?.own ?? []) {
          const food = newCustomFood(own);
          if (food) await commit([...myFoodsList, food]);
        }
        // "Continue · N of M" -> setTickedSnackSeeds(ids in SNACK_SEEDS order).
        const ticked = new Set(taps.snacks?.ticked ?? []);
        const ids = SNACK_SEEDS.map((s: any) => s.id).filter((id: string) => ticked.has(id));
        const want = new Set(ids);
        let next = myFoodsList;
        for (const f of next) if (f.source !== 'custom' && f.kind !== 'breakfast' && snackSeed(f.seedId) && f.active && !want.has(f.id)) next = untick(next, f.id);
        for (const id of want) { const seed2 = snackSeed(id); if (seed2) next = tickSeed(next, myFoodFromSnackSeed(seed2)); }
        await commit(next);
        await updateNutritionField('snackChecklistDone', true);
        p = { ...p, snackChecklistDone: true };
        break;
      }
      case 'N6eAppetite': {
        const draft = await loadNutritionAnswers();
        const current = draft.eatingChallenges ?? p.eatingChallenges ?? [];
        const challenges = withLowAppetite(current, !!taps.lowAppetite);
        await updateNutritionField('eatingChallenges', challenges);
        p = { ...p, eatingChallenges: challenges };
        break;
      }
      case 'N6aDessert': {
        const sel = taps.dessertFrequency;
        const nights = sel && sel !== 'ai_decide' && sel !== '0' ? taps.dessertDays ?? [] : [];
        await updateNutritionField('dessertFrequency', sel);
        await updateNutritionField('dessertDays', nights);
        p = { ...p, dessertFrequency: sel, dessertDays: nights };
        break;
      }
      case 'N6bSlowCooker': {
        const tubsPerDay = await useTubsPerDay(p);
        const size = taps.slowCooker;
        const n = size === 'none' ? 1 : taps.slowCookerCount ?? 1;
        await updateNutritionField('slowCooker', size);
        await updateNutritionField('slowCookerCount', n);
        const hasBlender = taps.blender == null ? undefined : taps.blender === 'yes';
        if (hasBlender != null) await updateNutritionField('blender', hasBlender);
        const draft = await loadNutritionAnswers();
        await updateNutritionField('cookingEquipment', withSlowCookerEquipment(draft.cookingEquipment ?? p.cookingEquipment, size));
        await saveBatch({ ...p, ...draft, slowCooker: size, slowCookerCount: n, ...(hasBlender != null ? { blender: hasBlender } : {}) }, tubsPerDay);
        p = { ...p, slowCooker: size, slowCookerCount: n, ...(hasBlender != null ? { blender: hasBlender } : {}) };
        break;
      }
      case 'N6cFreezer': {
        const tubsPerDay = await useTubsPerDay(p);
        await updateNutritionField('freezerTubs', taps.freezerTubs);
        const draft = await loadNutritionAnswers();
        const settings = await saveBatch({ ...p, ...draft, freezerTubs: taps.freezerTubs }, tubsPerDay);
        p = { ...p, freezerTubs: taps.freezerTubs, ...(p.shopCadence != null ? { shopCadence: settings.cadence } : {}) };
        break;
      }
      case 'N6dShopCadence': {
        const tubsPerDay = await useTubsPerDay(p);
        const setup = {
          freezerTubs: p.freezerTubs ?? DEFAULT_BATCH_SETTINGS.freezerTubs,
          tubsPerDay: tubsPerDay ?? DEFAULT_BATCH_SETTINGS.tubsPerDay,
          cookerCount: p.slowCooker === 'none' ? 0 : p.slowCookerCount ?? 1,
        };
        const cadence = taps.shopCadence ?? null;
        const picked = cadence && !cadenceBlockedReason(cadence, setup) ? cadence : null;
        await updateNutritionField('shopCadence', picked);
        if (!showsStockUp(setup.freezerTubs, setup.tubsPerDay)) await updateNutritionField('stockUp', false);
        const draft = await loadNutritionAnswers();
        await saveBatch({ ...p, ...draft, shopCadence: picked }, tubsPerDay);
        p = { ...p, shopCadence: picked };
        if (!showsStockUp(setup.freezerTubs, setup.tubsPerDay)) {
          steps = withoutStep(route('N6dShopCadence'), 'N6fStockUp').steps!;
          p = { ...p, stockUp: false };
        }
        break;
      }
      case 'N6fStockUp': {
        const tubsPerDay = await useTubsPerDay(p);
        const freezerTubs = p.freezerTubs ?? DEFAULT_BATCH_SETTINGS.freezerTubs;
        const card = stockUpCard(freezerTubs, tubsPerDay ?? DEFAULT_BATCH_SETTINGS.tubsPerDay);
        const value = card ? taps.stockUp ?? null : false;
        if (value == null) throw new Error('stock up not answered');
        await updateNutritionField('stockUp', value);
        const draft = await loadNutritionAnswers();
        await saveBatch({ ...p, ...draft, stockUp: value }, tubsPerDay);
        p = { ...p, stockUp: value };
        break;
      }
      case 'N9PlanLength': {
        await updateNutritionField('planDuration', 7);
        await updateNutritionField('startDate', taps.startDate ?? 'tomorrow');
        const finalAnswers = await loadNutritionAnswers();
        const macros = await finalizeNutrition(finalAnswers);
        if (!macros) throw new Error('finalize failed');
        p = finalAnswers;
        break;
      }
      default:
        throw new Error('step not transcribed: ' + step);
    }
  }

  // CuratedFavorites (fromQuestionnaire): use-up taps save as they happen.
  const pk = taps.picks ?? {};
  if ((pk.useUp ?? []).length) await saveUseUp(pk.useUp);
  if (pk.saved) {
    const fav0 = await loadCuratedFavoritesV2();
    const allMeals = offeredMeals(undefined, activeDietPattern(p), undefined, hidesBlenderMeals(p, fav0, freezer.settings));
    const myAllergies: string[] = Array.isArray(p.allergies) ? p.allergies : [];
    const versionChoices = pk.versionChoices ?? {};
    const allergenOk = pk.allergenOk ?? {};
    const plateClashes = (meal: any, plateId: string) => {
      if (!allergenCatch(meal, myAllergies, { variantChoice: versionChoices[meal.slug] })) return [];
      const ok = allergenOk[meal.slug];
      return versionClashes(meal, { plateId, variantId: cookingVariantId(meal, versionChoices[meal.slug]) }, myAllergies, ok?.mode === 'leave_out' ? ok.leaveOut ?? [] : []);
    };
    const picks = (pk.keys ?? []).map((scoped: string) => {
      const { slot, key } = unscopeKey(scoped);
      const ci = key.indexOf(':');
      return ci === -1 ? { slot, slug: key } : { slot, slug: key.slice(0, ci), plate_id: key.slice(ci + 1) };
    }).filter((x: any) => {
      const meal = allMeals.find((m: any) => m.slug === x.slug);
      if (!meal) return true;
      if (allergenOk[x.slug]?.mode === 'anyway') return true;
      return plateClashes(meal, x.plate_id ?? heroPlateId(meal)).length === 0;
    });
    await saveCuratedFavoritesV2({ picks, cuisines: fav0.cuisines, avoid: fav0.avoid, likedDishes: fav0.likedDishes });
    await recordPicks(picks).catch(() => undefined);
    const pickedSlugs = new Set(picks.map((x: any) => x.slug));
    const keptOk: any = {};
    for (const [slug, ok] of Object.entries(allergenOk)) if (pickedSlugs.has(slug)) keptOk[slug] = ok;
    await updateFoodPrefs({ allergenOk: keptOk });
    const stored = await getVariantChoices();
    for (const [slug, variantId] of Object.entries(versionChoices)) if (pickedSlugs.has(slug) && stored[slug] !== variantId) await setVariantChoice(slug, variantId as string);
  }

  // NutritionSummary "Build my meal plan".
  const answers = await resolveNutritionAnswers();
  if (!(await finalizeNutrition(answers))) throw new Error('summary finalize failed');

  // MealBuildScreen, first build: no saved plans, no freezer tubs (so no check-in).
  const r = await generateMealPlanFromStorage(undefined, [], [], [], undefined, null);
  const lookup: any = { ...CURATED_MEALS };
  for (const v of batchFoodViews() as any[]) if (v?.slug) lookup[v.slug] = v;
  const inputs = resolveGroceryInputs({ plan: r.plan, choices: {} as any, mealLookup: withPlanSwaps(lookup, r.plan), batch: true, myFoods: sanitizeMyFoods(await WorkoutStorage.loadMyFoods()) });
  const prof = await loadGoalsProfile();
  return { training: { minutes: prof?.trainingMinutesPerWeek ?? null, sessions: prof?.trainingSessionsPerWeek ?? null }, plan: r.plan, report: r.report, grocery: (inputs.view?.rows ?? []).map((x: any) => ({ key: x.key, name: x.name, amount: x.amount, category: x.category })), steps };
}

(globalThis as any).AppMealPath = appMealPath;
