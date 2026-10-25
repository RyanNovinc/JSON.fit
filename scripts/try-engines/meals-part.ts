// Meals for the /try/ page: the pick grid, the plan, the cook day and the
// shopping list, all from the app's own code. See entry.ts.
// @ts-nocheck

import { CURATED_MEALS } from 'APP_DIR/src/data/curated_meals';
import { offeredMeals } from 'APP_DIR/src/utils/offeredMeals';
import { mealsForSlots, emptyFilter } from 'APP_DIR/src/utils/curatedShelves';
import { slotsForTab } from 'APP_DIR/src/utils/basketCheck';
import { batchMainsOnly, recommendedMainPicks, recommendMainsLine, DIET_PATTERN_OPTIONS } from 'APP_DIR/src/utils/batchSetup';
import { allergenHit } from 'APP_DIR/src/utils/mealGenerator/generateMealPlan';
import { generateMealPlanFromStorage } from 'APP_DIR/src/utils/mealGenerator';
import { batchFoodViews } from 'APP_DIR/src/utils/mealGenerator/batchPlan';
import { saveCuratedFavoritesV2 } from 'APP_DIR/src/utils/curatedFavoritesStorage';
import { updateFoodPrefs } from 'APP_DIR/src/utils/foodPrefs';
import { buildFoodCatalogue, popularFoods, skipHitFor } from 'APP_DIR/src/utils/foodSkip';
import { heroPlateId } from 'APP_DIR/src/utils/mealVersions';
import { saveNutritionAnswers, loadNutritionAnswers } from 'APP_DIR/src/utils/nutritionQuestionnaireStorage';
import { batchWeekList } from 'APP_DIR/src/utils/batchWeekList';
import { prepSessionFromCook } from 'APP_DIR/src/utils/buildPrepSession';
import { bookedByPot } from 'APP_DIR/src/utils/cookSession';
import { withPlanSwaps } from 'APP_DIR/src/utils/lowSalt';
import { resolveGroceryInputs } from 'APP_DIR/src/utils/groceryState';
import { CATEGORY_ORDER, CATEGORY_NAMES } from 'APP_DIR/src/utils/groceryModel';
import { DEFAULT_BATCH_SETTINGS } from 'APP_DIR/src/utils/tubInventory';
import { INGREDIENTS } from 'APP_DIR/src/data/ingredients';

/** CuratedFavoritesScreen effortMinutes / ingredientCount (private there). */
function effortMinutes(m: any): number {
  const method: any = m.methods?.[0];
  return method?.time_active_minutes ?? method?.time_total_minutes ?? 0;
}
function ingredientCount(m: any): number {
  const ids = new Set<string>();
  const add = (arr: any[] | undefined) => (arr ?? []).forEach((i: any) => i?.ingredient_id && ids.add(i.ingredient_id));
  add(m.ingredients);
  const v = (m.variants ?? []).find((x: any) => x.default) ?? m.variants?.[0];
  add(v?.ingredients);
  add(m.methods?.[0]?.ingredients);
  add(m.plates?.[0]?.additions);
  return ids.size;
}

/**
 * The "pick meals you like" grid on the Dinner tab of a batch plan:
 * mealsForSlots -> batchMainsOnly -> easiest first, as CuratedFavoritesScreen
 * sorts it. Allergens hidden; skipped foods to the bottom (orderBySkips' rule).
 */
function mainsGrid(food: any) {
  const tab = { kind: 'core', shelf: 'dinner' };
  const slots = slotsForTab(tab as any);
  const all = offeredMeals(undefined, food.dietPattern || 'any', undefined, false);
  const allergies = (food.allergies || []).map((a: string) => a.toLowerCase());
  const skip: string[] = food.skip || [];
  const list = batchMainsOnly(mealsForSlots(slots, all, emptyFilter(), 'default'), slots as string[], true)
    .filter((m: any) => !allergenHit(m, allergies, []))
    .map((m: any, i: number) => ({ m, i, e: effortMinutes(m), n: ingredientCount(m) }))
    .sort((a: any, b: any) => a.e - b.e || a.n - b.n || a.i - b.i)
    .map((x: any) => x.m);
  const rows = list.map((m: any) => {
    let skipped = false;
    try { skipped = skip.length > 0 && skipHitFor(m, { plateId: heroPlateId(m) } as any, skip).length > 0; } catch { skipped = false; }
    return { slug: m.slug, name: m.display_name, minutes: effortMinutes(m), skipped };
  });
  const recommend = recommendedMainPicks(DEFAULT_BATCH_SETTINGS);
  return { meals: [...rows.filter((r: any) => !r.skipped), ...rows.filter((r: any) => r.skipped)], recommend, recommendLine: recommendMainsLine(recommend) };
}

/** The food-question options, straight from the app's lists. */
function foodOptions() {
  const cat = buildFoodCatalogue();
  return {
    dietPatterns: DIET_PATTERN_OPTIONS,
    popularFoods: popularFoods(cat).map((f: any) => ({ id: f.id, name: f.name })),
  };
}

/** Every meal a plan can hold (for the photo index). */
function allMeals() {
  const out: any[] = [];
  for (const m of Object.values(CURATED_MEALS) as any[]) out.push({ slug: m.slug, image_filename: m.image_filename, batch: m.batch ? { variant_of: m.batch.variant_of } : undefined });
  for (const m of batchFoodViews() as any[]) out.push({ slug: m.slug, image_filename: m.image_filename });
  return out;
}

/** The meal lookup useMealLookup builds on a phone with no own meals: curated + seeds and add-ons. */
function mealLookup() {
  const merged: any = { ...CURATED_MEALS };
  for (const v of batchFoodViews() as any[]) if (v?.slug) merged[v.slug] = v;
  return merged;
}

/**
 * The week of meals. Runs `buildRoute` first (it saves the profile, the
 * locked route and the body stats). The food answers are saved
 * the way the meal questions save them, then the plan is built by
 * generateMealPlanFromStorage, exactly as MealBuildScreen does.
 */
async function buildMeals(about: any, food: any, buildRoute: (a: any) => Promise<any>) {
  // Rebuild the route first so this works on a fresh worker too (it is ~1 ms).
  await buildRoute(about);
  const prior = await loadNutritionAnswers();
  await saveNutritionAnswers({
    ...prior,
    mealsPerDay: food.mealsPerDay ?? 3,
    snackFrequency: food.snackFrequency ?? 'ai_decide',
    dessertFrequency: food.dessertFrequency ?? '0',
    mealVariety: 'balanced',
    dietPattern: food.dietPattern || 'any',
    allergies: food.allergies?.length ? food.allergies : [],
    avoidFoods: [],
    eatingChallenges: [],
    planDuration: 7,
    startDate: 'today',
  } as any);
  await updateFoodPrefs({ skip: food.skip || [], allergenOk: {} });
  await saveCuratedFavoritesV2({
    picks: (food.picks || []).map((slug: string) => ({ slot: 'dinner', slug })),
    cuisines: [],
    avoid: [],
    likedDishes: [],
  });
  const t0 = Date.now();
  const { plan, report } = await generateMealPlanFromStorage();
  const ms = Date.now() - t0;
  const lookup = withPlanSwaps(mealLookup(), plan);

  // The cook days, each as the prep session screen builds it (prepSessionFromCook).
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
  const week = batchWeekList(plan);

  // The shopping list: the app's own resolver (batch plan -> buildBatchShop rows).
  const inputs = resolveGroceryInputs({ plan, choices: {} as any, mealLookup: lookup, batch: true, myFoods: [] });
  const rows = (inputs.view?.rows ?? []).map((r: any) => {
    const id = r.batch?.ingredientId ?? (String(r.key).startsWith('ing:') ? String(r.key).slice(4).split('|')[0] : null);
    // is_pantry_negligible: shown by name only (the app hides these from macro totals and the shop amounts).
    const negligible = !!(id && (INGREDIENTS as any)[id]?.is_pantry_negligible);
    return { key: r.key, name: r.name, amount: r.amount, category: r.category, note: r.note || null, section: r.section || null, negligible };
  });
  const sections = (inputs.batchShop?.sections ?? []).map((s: any) => ({ key: s.key, title: s.title }));

  return {
    ms,
    plan: { startDate: plan.startDate, endDate: plan.endDate, dailyMeals: plan.dailyMeals, targets: plan.targets, name: plan.name, cookDayCount: (plan.batch?.cookDays ?? []).length },
    report: { days: report.days, targets: report.targets, misses: report.misses, counts: report.counts, avg: report.avg, kept: report.kept, batch: report.batch ? { potsToCook: report.batch.potsToCook, tubsBanked: report.batch.tubsBanked, tubsFromStock: report.batch.tubsFromStock, status: report.batch.status, tubsPerDay: report.batch.tubsPerDay, ownTubsPerDay: report.batch.ownTubsPerDay } : null },
    cooks,
    week: week ? { headline: week.headline, foot: week.foot } : null,
    grocery: { rows, sections, freezerLine: inputs.batchShop?.freezerLine ?? null, categoryOrder: CATEGORY_ORDER, categoryNames: CATEGORY_NAMES },
  };
}

export default { mainsGrid, foodOptions, allMeals, buildMeals };
