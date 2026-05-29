# bolognese — Slow-Simmered Bolognese

This file is the planning AI's source of truth for the bolognese meal. The AI fetches it during meal planning, reads the ingredients, and produces a localised shopping list using the user's store and location (from earlier in the prompt). The app's recipe screen reads the same meal from `CURATED_MEALS` in code with the full cooking instructions and human-facing notes — those are deliberately not duplicated here, because the AI is not cooking.

---

## Identity

- **slug:** bolognese
- **display_name:** Slow-Simmered Bolognese
- **primary_protein:** beef
- **eligible_slots:** lunch, dinner, second_lunch, early_dinner
- **produces_servings:** 8
- **min_scale:** 0.7
- **max_scale:** 1.5
- **flex_ingredient_id:** beef_mince_regular
- **contains_allergens:** Dairy, Eggs, Fish, Gluten/Wheat

---

## Methods

Two ways to make the base sauce. The user picks one. Ingredients differ slightly because stovetop reduces during cooking and uses less liquid.

### `slow_cooker` — Slow Cooker

- **Equipment:** slow_cooker, stovetop
- **Active time:** 20 min
- **Total time:** 380 min

Ingredients (full 8-serving base cook):

| Ingredient | Amount | Unit | Scaling |
|---|---|---|---|
| olive_oil | 30 | g | scales |
| beef_mince_regular | 1000 | g | scales |
| pancetta_diced | 100 | g | scales |
| brown_onion | 300 | g | scales |
| garlic_clove | 4 | cloves | scales |
| carrot | 120 | g | scales |
| celery | 100 | g | scales |
| red_wine_cooking | 250 | ml | scales |
| crushed_tomatoes_canned | 1600 | g | scales |
| tomato_paste | 60 | g | scales |
| beef_stock_cube | 30 | g | scales |
| worcestershire_sauce | 20 | ml | scales |
| sugar_white | 8 | g | fixed |
| oregano_dried | 2 | tsp | fixed |
| thyme_dried | 2 | tsp | fixed |
| bay_leaves_dried | 3 | count | fixed |
| salt | 1 | tsp | fixed |
| black_pepper_ground | 0.5 | tsp | fixed |

### `stovetop` — Stovetop

- **Equipment:** stovetop
- **Active time:** 20 min
- **Total time:** 140 min

Ingredients (full 8-serving base cook):

| Ingredient | Amount | Unit | Scaling |
|---|---|---|---|
| olive_oil | 30 | g | scales |
| beef_mince_regular | 1000 | g | scales |
| pancetta_diced | 100 | g | scales |
| brown_onion | 300 | g | scales |
| garlic_clove | 4 | cloves | scales |
| carrot | 120 | g | scales |
| celery | 100 | g | scales |
| red_wine_cooking | 250 | ml | scales |
| crushed_tomatoes_canned | 1200 | g | scales |
| tomato_paste | 60 | g | scales |
| beef_stock_cube | 30 | g | scales |
| worcestershire_sauce | 20 | ml | scales |
| sugar_white | 8 | g | fixed |
| oregano_dried | 2 | tsp | fixed |
| thyme_dried | 2 | tsp | fixed |
| bay_leaves_dried | 3 | count | fixed |
| salt | 1 | tsp | fixed |
| black_pepper_ground | 0.5 | tsp | fixed |

---

## Plates

Each plate is what one base serving becomes on the user's plate. Plate ingredients are *per serving* and are added on top of the base ingredients.

### `bolognese` — Bolognese (plain base)

- **Macros:** 510 kcal / 32g P / 18g C / 32g F / 4g fiber
- **Plate equipment:** none beyond base
- **Base servings consumed:** 1.0
- **Additional ingredients:** none

### `spaghetti` — Spaghetti Bolognese

- **Macros:** 996 kcal / 48g P / 97g C / 46g F / 8g fiber
- **Plate equipment:** stovetop
- **Base servings consumed:** 1.0

| Ingredient | Amount | Unit | Scaling |
|---|---|---|---|
| spaghetti_dry | 100 | g | fixed |
| parmesan_grated | 20 | g | fixed |
| olive_oil | 5 | g | fixed |
| salt | 1 | tsp | fixed |

### `baked_potato` — Loaded Bolognese Baked Potato

- **Macros:** 1007 kcal / 44g P / 84g C / 55g F / 12g fiber
- **Plate equipment:** oven
- **Base servings consumed:** 1.0

| Ingredient | Amount | Unit | Scaling |
|---|---|---|---|
| baking_potato | 350 | g | fixed |
| cheese_tasty_grated | 30 | g | fixed |
| sour_cream | 30 | g | fixed |
| olive_oil | 5 | g | fixed |
| salt | 0.25 | tsp | fixed |

### `garlic_bread` — Bolognese with Garlic Bread

- **Macros:** 968 kcal / 42g P / 65g C / 59g F / 7g fiber
- **Plate equipment:** oven
- **Base servings consumed:** 1.0

| Ingredient | Amount | Unit | Scaling |
|---|---|---|---|
| garlic_bread_frozen | 120 | g | fixed |
| parmesan_grated | 15 | g | fixed |

### `lasagne` — Bolognese Lasagne ⚡ STUNT

- **Macros:** 1130 kcal / 62g P / 76g C / 63g F / 7g fiber
- **Plate equipment:** oven, stovetop
- **Base servings consumed:** 6.0 (one bake consumes 6 base servings of sauce and yields 6 plate portions)

Per-portion quantities (multiply by 6 for full bake):

| Ingredient | Amount | Unit | Scaling |
|---|---|---|---|
| lasagne_sheets_dry | 60 | g | fixed |
| ricotta_full_fat | 80 | g | fixed |
| egg_whole | 0.17 | count | fixed |
| mozzarella_shredded | 50 | g | fixed |
| parmesan_grated | 10 | g | fixed |
| butter_salted | 5 | g | fixed |
| flour_plain | 5 | g | fixed |
| full_cream_milk | 67 | ml | fixed |
| nutmeg_ground | 0.05 | tsp | fixed |

---

## How to use this file (instructions for the planning AI)

1. **Base ingredients:** Start with the ingredients under the method the user picked (slow_cooker or stovetop).
2. **Scale `scales` ingredients** by `scale_factor` × (servings being eaten / 8). Round sensibly — don't ask the user to buy 187g of mince when a 500g pack is the only option.
3. **Keep `fixed` ingredients fixed** — herbs and seasonings stay the same regardless of portion count.
4. **`flex` ingredients** are absorbed into `scale_factor` at the plan level; treat as `scales`.
5. **Add plate ingredients** for each plate the user eats. If they eat the spaghetti plate 3 times, add 3× the spaghetti plate ingredients on top of the base.
6. **Lasagne is one bake at a time.** If `lasagne` is scheduled, the schedule must group the 6 portions together — one bake commits 6 base servings and produces 6 plate portions. The user can't eat a fractional lasagne.
7. **Localise.** Take the generic ingredient names (e.g. `beef_mince_regular`, `crushed_tomatoes_canned`) and produce specific brand/product names available at the user's grocery store and location (e.g. for a Canberra user shopping at Coles: "Coles 3-Star Beef Mince 500g" and "Ardmona Crushed Tomatoes 800g"). Keep the quantities; only the names and pack-size guidance change.
