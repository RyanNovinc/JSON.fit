# egg_muffins — Egg Muffins
## Identity
- **slug:** egg_muffins
- **display_name:** Egg Muffins
- **primary_protein:** eggs
- **eligible_slots:** breakfast, brunch, lunch
- **produces_servings:** 4 _(batch makes 12 muffins; one serving is 3 muffins)_
- **min_scale:** 0.7
- **max_scale:** 1.5
- **flex_ingredient_id:** cottage_cheese
- **contains_allergens:** Dairy, Eggs, Gluten/Wheat
---
## Methods
### `oven` — Oven (Batch)
- **Equipment:** oven, blender
- **Active time:** 15 min
- **Total time:** 35 min
| Ingredient | Amount | Unit | Scaling |
|---|---|---|---|
| egg_whole | 8 | count | scales |
| cottage_cheese | 250 | g | flex |
| breakfast_sausage | 200 | g | scales |
| cheese_tasty_grated | 80 | g | scales |
| spinach | 60 | g | scales |
| onion | 60 | g | scales |
| olive_oil | 5 | ml | fixed |
| salt | 0.5 | tsp | fixed |
| black_pepper_ground | 0.5 | tsp | fixed |
---
## Plates
### `standard` — Egg Muffins
- **Macros (per serving = 3 muffins + avo toast):** 790 kcal / 44g P / 63g C / 41g F / 8g fiber
- **Plate equipment:** none beyond base
- **Base servings consumed:** 1.0 _(3 of 12 muffins)_
- **Additional ingredients:** sourdough_crusty 100g, avocado 80g
