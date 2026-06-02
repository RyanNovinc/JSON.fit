# spicy_chipotle_chicken_burrito — Spicy Chipotle Chicken Burrito
## Identity
- **slug:** spicy_chipotle_chicken_burrito
- **display_name:** Spicy Chipotle Chicken Burrito
- **cuisine:** mexican
- **primary_protein:** chicken
- **eligible_slots:** lunch, dinner
- **produces_servings:** 4
- **min_scale:** 0.5
- **max_scale:** 2.0
- **flex_ingredient_id:** chicken_breast
- **contains_allergens:** Gluten/Wheat, Dairy
- **image_filename:** spicy_chipotle_chicken_burrito.png
- **NOTE:** separate meal from any non-spicy `mexican_chicken_burrito` — do not merge.
---
## Methods
### `stovetop` — Stovetop + Griddle
- **Equipment:** stovetop
- **Active time:** 25 min
- **Total time:** 30 min
| Ingredient | Amount | Unit | Scaling |
|---|---|---|---|
| chicken_breast | 800 | g | flex |
| flour_tortilla_large | 4 | count | scales |
| jasmine_rice | 220 | g | scales |
| black_beans | 240 | g | scales |
| cheese | 100 | g | scales |
| greek_yoghurt | 200 | g | scales |
| olive_oil | 18 | ml | scales |
| lime | 2 | count | scales |
| coriander_fresh | 15 | g | scales |
| garlic_clove | 3 | count | scales |
| paprika (smoked) | 2 | tsp | scales |
| chilli_powder | 2 | tsp | scales |
| cayenne_pepper | 0.5 | tsp | scales |
| ground_cumin | 2 | tsp | scales |
| garlic_powder | 1 | tsp | scales |
| onion_powder | 1 | tsp | scales |
| salt | 1 | tsp | fixed |
| black_pepper_ground | 0.5 | tsp | fixed |
| chipotle_in_adobo | 0 | g | scales (optional upgrade) |
---
## Plates
### `standard` — Spicy Chipotle Chicken Burrito
- **Macros:** 890 kcal / 70g P / 93g C / 24g F / 9g fiber  *(COMPUTED from ingredient amounts; fat verified vs cheese+oil+yoghurt)*
- **Base servings consumed:** 1.0

### `extra_hot` — Extra Hot
- **Macros:** 890 / 70 / 93 / 24 / 9 (heat only, no macro change)
- **Extra step:** double cayenne + chilli powder, extra chipotle/hot sauce in the sauce, sliced jalapeños before rolling

### `burrito_bowl` — Burrito Bowl (unwrapped)
- **Macros:** 705 kcal / 65g P / 65g C / 19g F / 7g fiber *(no tortilla)*
- **Extra step:** skip tortilla + griddling; serve fillings over rice in a bowl
---
## Heat tiering
- **Default (accessible):** smoked paprika + chilli powder + a little cayenne.
- **Authentic upgrade:** chipotle in adobo (or chipotle paste / hot sauce) — chopped into marinade + sauce. Listed as a 0-default optional ingredient because it isn't reliably stocked in AU/UK supermarkets.
---
## Notes
- 200g chicken/serve drives protein to ~70g; computed 890 kcal is honest to the build (not forced to the 760 target). To hit ~760, drop chicken to ~150g/serve.
- Greek-yoghurt chipotle sauce keeps fat lower than sour cream/mayo.
- Components keep 3-4 days; assemble & griddle fresh, or wrap ahead and reheat.
- Optional toppings (jalapeños, avocado/guac, salsa, lettuce) added fresh, not in base macros.
- Cost-hook: make your ~$14 takeaway burrito for ~$3.
