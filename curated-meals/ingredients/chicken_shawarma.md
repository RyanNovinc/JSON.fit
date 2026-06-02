Add/repair the curated MAIN meal "Chicken Shawarma" in JSON.fit. Lunch/dinner, batch (4), cuisine mediterranean. TWO plates: wrap, rice_bowl.

==================================================================
IDEMPOTENCY — READ FIRST
==================================================================
Check whether 'chicken_shawarma' already exists in src/data/curated_meals.ts (and MealSlug union, INGREDIENTS, MEAL_SUBSTEPS). If it matches this spec, leave it; if it differs, reconcile; if absent, add. Pairs with lamb_kofta (same lane, same garlic-yoghurt sauce). Make no other changes.

==================================================================
INGREDIENT IDs — USE THE REPO'S REAL IDS
==================================================================
Match the repo's id conventions (e.g. chicken_thigh_skinless, greek_yoghurt_plain, garlic_clove, jasmine_rice, black_pepper_ground). Best-guess ids below — search INGREDIENTS first and REUSE; only add if missing. Report reused vs added.

Likely already exist — REUSE the real id:
- chicken thigh -> chicken_thigh_skinless (default; breast swap leaner)
- greek_yoghurt_plain, garlic_clove, olive_oil, lemon, jasmine_rice, cucumber, tomato (or cherry_tomatoes), brown_onion (red onion), salt, black_pepper_ground, ground_cumin, paprika (or paprika_smoked), flour_tortilla_large, coriander_fresh (or parsley)

Likely NEW — add only if missing (category from: meat_seafood, dairy_refrigerated, produce, frozen, pantry_grains, condiments_supplements, bakery, other; allergens from: Nuts, Shellfish, Dairy, Eggs, Gluten/Wheat, Soy, Fish, Sesame; dietary_flags from: vegan, vegetarian, gluten_free, dairy_free, nut_free):

  ground_coriander: { id:'ground_coriander', display_name:'Ground coriander', category:'condiments_supplements', canonical_unit:'tsp', dietary_flags:['vegan','vegetarian','gluten_free','dairy_free','nut_free'], allergens:[], typical_pack_size:50 }
  ground_turmeric: { id:'ground_turmeric', display_name:'Ground turmeric', category:'condiments_supplements', canonical_unit:'tsp', dietary_flags:['vegan','vegetarian','gluten_free','dairy_free','nut_free'], allergens:[], typical_pack_size:50, notes:'Part of the shawarma spice blend; REUSE if present.' }

==================================================================
src/types/curated_meals.ts
==================================================================
Add 'chicken_shawarma' to MealSlug. Reuse 'mediterranean' cuisine and lunch/dinner slots.

==================================================================
src/data/curated_meals.ts — CURATED_MEALS entry
==================================================================
produces_servings 4. Single cook method (marinate + cook the spiced chicken; make the garlic-yoghurt sauce + salad). Two plates: 'wrap' and 'rice_bowl' — alternatives, both base_serving_multiplier 1.0 (the massaman pattern, not base+addons). Per-plate image_filename = "<Plate display_name> (<plateid>).png"; meal-level fallback "Chicken Shawarma.png". Macros COMPUTED (USDA, thigh default; breast swap leaner). No stunt plates.

  chicken_shawarma: {
    slug: 'chicken_shawarma',
    display_name: 'Chicken Shawarma',
    cuisine: 'mediterranean',
    primary_protein: 'chicken',
    produces_servings: 4,
    eligible_slots: ['lunch', 'dinner'],
    min_scale: 0.5,
    max_scale: 2.0,
    contains_allergens: ['Dairy', 'Gluten/Wheat'],
    flex_ingredient_id: 'chicken_thigh_skinless',
    image_filename: 'Chicken Shawarma.png',   // meal-level fallback
    photo_url: undefined,
    plates: [
      {
        id: 'wrap',
        display_name: 'Chicken Shawarma Wrap',
        description: 'Spiced shawarma chicken with garlic-yoghurt sauce and salad wrapped in warm flatbread. Pita is authentic; a large tortilla is the accessible stand-in.',
        is_stunt_plate: false,
        base_serving_multiplier: 1.0,
        equipment_required: [],
        additional_ingredients: [
          { ingredient_id: 'flour_tortilla_large', base_amount: 6, unit: 'count', scaling: 'scales', notes: '~1.5 large (or 2 pita) per serve.' },
        ],
        additional_instructions: [
          { summary: 'Build the wrap.', substeps: ['Warm the flatbread.', 'Fill with shawarma chicken, garlic-yoghurt sauce, and salad; roll up.'] },
        ],
        assembly_time_minutes: 3,
        plate_macros: { kcal: 738, protein_g: 51, carbs_g: 62, fat_g: 31, fiber_g: 5 },
        image_filename: 'Chicken Shawarma Wrap (wrap).png',
        photo_url: undefined,
      },
      {
        id: 'rice_bowl',
        display_name: 'Chicken Shawarma Rice Bowl',
        description: 'The same shawarma chicken, garlic-yoghurt sauce, and salad over rice instead of wrapped. Higher-carb, meal-preps cleanly.',
        is_stunt_plate: false,
        base_serving_multiplier: 1.0,
        equipment_required: [],
        additional_ingredients: [
          { ingredient_id: 'jasmine_rice', base_amount: 400, unit: 'g', scaling: 'scales', notes: '100g dry/serve.' },
        ],
        additional_instructions: [
          { summary: 'Build the bowl.', substeps: ['Serve the shawarma chicken over rice with the garlic-yoghurt sauce and salad.'] },
        ],
        assembly_time_minutes: 2,
        plate_macros: { kcal: 793, protein_g: 50, carbs_g: 92, fat_g: 24, fiber_g: 4 },
        image_filename: 'Chicken Shawarma Rice Bowl (rice_bowl).png',
        photo_url: undefined,
      },
    ],
    methods: [
      {
        id: 'stovetop',
        display_name: 'Marinate & Cook',
        equipment_required: ['stovetop'],
        time_active_minutes: 20,
        time_total_minutes: 35,
        skill_min: 2,
        shortcut_level: 'scratch',
        ingredients: [
          { ingredient_id: 'chicken_thigh_skinless', base_amount: 800, unit: 'g', scaling: 'flex', notes: '200g/serve; breast swaps in leaner.' },
          { ingredient_id: 'greek_yoghurt_plain', base_amount: 200, unit: 'g', scaling: 'scales', notes: 'Garlic-yoghurt sauce (a little also goes in the marinade).' },
          { ingredient_id: 'garlic_clove', base_amount: 5, unit: 'count', scaling: 'scales', notes: 'Marinade + sauce.' },
          { ingredient_id: 'olive_oil', base_amount: 30, unit: 'ml', scaling: 'scales', notes: 'Marinade + cooking.' },
          { ingredient_id: 'lemon', base_amount: 1, unit: 'count', scaling: 'scales' },
          { ingredient_id: 'ground_cumin', base_amount: 2, unit: 'tsp', scaling: 'scales' },
          { ingredient_id: 'ground_coriander', base_amount: 2, unit: 'tsp', scaling: 'scales' },
          { ingredient_id: 'paprika', base_amount: 2, unit: 'tsp', scaling: 'scales', notes: 'Smoked preferred.' },
          { ingredient_id: 'ground_turmeric', base_amount: 1, unit: 'tsp', scaling: 'scales' },
          { ingredient_id: 'tomato', base_amount: 200, unit: 'g', scaling: 'scales', notes: 'Salad.' },
          { ingredient_id: 'cucumber', base_amount: 200, unit: 'g', scaling: 'scales', notes: 'Salad.' },
          { ingredient_id: 'brown_onion', base_amount: 1, unit: 'count', scaling: 'scales', notes: 'Red onion for the salad.' },
          { ingredient_id: 'salt', base_amount: 1, unit: 'tsp', scaling: 'fixed' },
          { ingredient_id: 'black_pepper_ground', base_amount: 0.5, unit: 'tsp', scaling: 'fixed' },
        ],
        instructions: [
          { summary: 'Marinate the chicken in yoghurt, garlic, lemon, oil, and the spice blend.', substeps: ['Mix a little yoghurt, minced garlic, lemon, oil, cumin, coriander, paprika, turmeric, salt, and pepper.', 'Coat the chicken thigh and marinate 30 min+ if you have time.'] },
          { summary: 'Cook the chicken hot until charred and cooked through, then rest and slice.', substeps: ['Cook over high heat (pan or grill) until charred at the edges and cooked through.', 'Rest a few minutes, then slice.'] },
          { summary: 'Make the garlic-yoghurt sauce and the salad.', substeps: ['Mix the remaining yoghurt with garlic, lemon, and a pinch of salt.', 'Chop the tomato, cucumber, and red onion for the salad.'] },
          { summary: 'Assemble per plate (wrap or rice bowl).', substeps: ['See the plate-specific assembly steps.'] },
        ],
      },
    ],
  },

==================================================================
src/data/meal_substeps.ts
==================================================================
Method-keyed only (plate assembly lives in Plate.additional_instructions).

  chicken_shawarma: {
    stovetop: {
      0: [
        'Mix a marinade: a spoon of yoghurt, 3 minced garlic cloves, juice of 1/2 lemon, 1 tbsp oil, 2 tsp cumin, 2 tsp coriander, 2 tsp paprika, 1 tsp turmeric, salt, pepper',
        'Coat 800g chicken thigh',
        { text: 'Marinate 30 min+ if you have time', timer_seconds: 1800, timer_label: 'Marinate' },
      ],
      1: [
        { text: 'Cook over high heat until charred and cooked through', timer_seconds: 600, timer_label: 'Cook chicken' },
        'Rest, then slice',
      ],
      2: [
        'Mix the sauce: remaining ~180g yoghurt, 2 minced garlic cloves, squeeze of lemon, pinch of salt',
        'Chop 200g tomato, 200g cucumber, red onion for the salad',
      ],
      3: [ 'Assemble: wrap or rice bowl (see plate steps)' ],
    },
  }

==================================================================
SOURCE & ADAPTATION
==================================================================
Chicken shawarma — yoghurt/lemon/garlic + cumin/coriander/paprika/turmeric marinated chicken, charred and sliced, with garlic-yoghurt sauce and salad, in flatbread or over rice. Consensus across RecipeTin Eats, The Mediterranean Dish, Downshiftology. URL: https://www.recipetineats.com/chicken-shawarma-middle-eastern/
Macros COMPUTED (USDA, thigh default): wrap 738/51/62/31/5; rice_bowl 793/50/92/24/4. Breast swap drops fat. Two plates are alternatives (both 1.0 multiplier).

==================================================================
FINALLY
==================================================================
Typecheck. Confirm no MealSlug/IngredientId/cuisine/slot/category/allergen enum errors and no duplicates. Report reused vs added ids (chicken_thigh, greek_yoghurt, garlic_clove, jasmine_rice, flour_tortilla_large, ground_cumin, ground_coriander, paprika, ground_turmeric). Confirm both plates' image_filename set + meal-level fallback.
