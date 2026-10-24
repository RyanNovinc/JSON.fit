// Bundled by dump.sh against the app repo (APP_DIR is substituted at build time).
// Prints the meals the app OFFERS with BATCH_LIBRARY and BATCH_PLANNER on, plus the
// ingredient names, as JSON on stdout.
import { offeredMeals, isBreakfastMeal, isDessertMeal, isQuickOrMadeAhead, needsBlender } from 'APP_DIR/src/utils/offeredMeals';
import { INGREDIENTS } from 'APP_DIR/src/data/ingredients';

const meals: any[] = (offeredMeals as any)(true, null, true, false);
const out = meals.map((m: any) => ({
  ...m,
  _flags: { breakfast: isBreakfastMeal(m), dessert: isDessertMeal(m), quick: isQuickOrMadeAhead(m), blender: needsBlender(m) },
}));
const ingredients: Record<string, any> = {};
for (const [id, v] of Object.entries(INGREDIENTS as any)) {
  ingredients[id] = { display_name: (v as any).display_name, is_pantry_negligible: !!(v as any).is_pantry_negligible };
}
console.log(JSON.stringify({ meals: out, ingredients }));
