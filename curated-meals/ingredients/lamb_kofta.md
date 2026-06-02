Add/repair the curated MAIN meal "Lamb Kofta" in JSON.fit. Lunch/dinner, batch (4), cuisine mediterranean. TWO plates: rice_bowl, wrap. First and only lamb dish.

==================================================================
IDEMPOTENCY — READ FIRST
==================================================================
Check whether 'lamb_kofta' already exists in src/data/curated_meals.ts (and MealSlug union, INGREDIENTS, MEAL_SUBSTEPS). If it matches, leave it; if it differs, reconcile; if absent, add. Pairs with chicken_shawarma (same lane, same garlic-yoghurt sauce). Make no other changes.

==================================================================
INGREDIENT IDs — USE THE REPO'S REAL IDS
==================================================================
Match the repo's id conventions. Best-guess ids below — search INGREDIENTS first and REUSE; only add if missing. Report reused vs added.

Likely already exist — REUSE the real id:
- greek_yoghurt_plain, garlic_clove, brown_onion, breadcrumbs, olive_oil, lemon, jasmine_rice, cucumber, tomato (or cherry_tomatoes), salt, black_pepper_ground, ground_cumin, ground_coriander (added by shawarma), paprika, flour_tortilla_large, parsley (or coriander_fresh)

Likely NEW — add only if missing (category from: meat_seafood, dairy_refrigerated, produce, frozen, pantry_grains, condiments_supplements, bakery, other; allergens from: Nuts, Shellfish, Dairy, Eggs, Gluten/Wheat, Soy, Fish, Sesame; dietary_flags from: vegan, vegetarian, gluten_free, dairy_free, nut_free):

  lamb_mince: { id:'lamb_mince', display_name:'Lamb mince (lean; or regular)', category:'meat_seafood', canonical_unit:'g', dietary_flags:['gluten_free','dairy_free','nut_free'], allergens:[], typical_pack_size:500, notes:'DEFAULT lean lamb mince (~85/15, ~200 kcal, 19.5g protein, 13.5g fat /100g raw). Regular (~80/20, ~282 kcal, 23g fat) is juicier but much fattier. Beef or lamb-beef mix = milder/cheaper swap.' }
  ground_cinnamon: { id:'ground_cinnamon', display_name:'Ground cinnamon', category:'condiments_supplements', canonical_unit:'tsp', dietary_flags:['vegan','vegetarian','gluten_free','dairy_free','nut_free'], allergens:[], typical_pack_size:50, notes:'KEY warm note in kofta — do not omit. REUSE if present (e.g. from baked oats).' }
  mint_fresh: { id:'mint_fresh', display_name:'Mint (fresh)', category:'produce', canonical_unit:'g', dietary_flags:['vegan','vegetarian','gluten_free','dairy_free','nut_free'], allergens:[], typical_pack_size:30, notes:'With parsley, chopped into the mince. Optional; dried fallback.' }

==================================================================
src/types/curated_meals.ts
==================================================================
Add 'lamb_kofta' to MealSlug. Reuse 'mediterranean' cuisine and lunch/dinner slots.

==================================================================
src/data/curated_meals.ts — CURATED_MEALS entry
==================================================================
produces_servings 4. Single cook method (mix/form/grill the koftas + sauce + salad). Two plates: 'rice_bowl' and 'wrap' — alternatives, both base_serving_multiplier 1.0. Per-plate image_filename = "<Plate display_name> (<plateid>).png"; meal-level fallback "Lamb Kofta.png". Macros COMPUTED (USDA, LEAN lamb default — FAT double-checked; regular lamb pushes fat to ~52-60g). No stunt plates.

  lamb_kofta: {
    slug: 'lamb_kofta',
    display_name: 'Lamb Kofta',
    cuisine: 'mediterranean',
    primary_protein: 'lamb',
    produces_servings: 4,
    eligible_slots: ['lunch', 'dinner'],
    min_scale: 0.5,
    max_scale: 2.0,
    contains_allergens: ['Dairy', 'Gluten/Wheat'],
    flex_ingredient_id: 'lamb_mince',
    image_filename: 'Lamb Kofta.png',   // meal-level fallback
    photo_url: undefined,
    plates: [
      {
        id: 'rice_bowl',
        display_name: 'Lamb Kofta Rice Bowl',
        description: 'Spiced lamb koftas (cumin, coriander, paprika, cinnamon) grilled and served over rice with salad and a garlic-yoghurt sauce.',
        is_stunt_plate: false,
        base_serving_multiplier: 1.0,
        equipment_required: [],
        additional_ingredients: [
          { ingredient_id: 'jasmine_rice', base_amount: 340, unit: 'g', scaling: 'scales', notes: '85g dry/serve; basmati fine.' },
        ],
        additional_instructions: [
          { summary: 'Build the bowl.', substeps: ['Serve the koftas over rice with the garlic-yoghurt sauce and salad.'] },
        ],
        assembly_time_minutes: 2,
        plate_macros: { kcal: 857, protein_g: 53, carbs_g: 88, fat_g: 32, fiber_g: 4 },
        image_filename: 'Lamb Kofta Rice Bowl (rice_bowl).png',
        photo_url: undefined,
      },
      {
        id: 'wrap',
        display_name: 'Lamb Kofta Wrap',
        description: 'The same spiced koftas, salad, and garlic-yoghurt sauce wrapped in warm flatbread. Pita authentic; large tortilla the accessible stand-in.',
        is_stunt_plate: false,
        base_serving_multiplier: 1.0,
        equipment_required: [],
        additional_ingredients: [
          { ingredient_id: 'flour_tortilla_large', base_amount: 6, unit: 'count', scaling: 'scales', notes: '~1.5 large (or 2 pita) per serve.' },
        ],
        additional_instructions: [
          { summary: 'Build the wrap.', substeps: ['Warm the flatbread.', 'Fill with koftas, garlic-yoghurt sauce, and salad; roll up.'] },
        ],
        assembly_time_minutes: 3,
        plate_macros: { kcal: 856, protein_g: 55, carbs_g: 70, fat_g: 39, fiber_g: 6 },
        image_filename: 'Lamb Kofta Wrap (wrap).png',
        photo_url: undefined,
      },
    ],
    methods: [
      {
        id: 'stovetop',
        display_name: 'Mix, Form & Grill',
        equipment_required: ['stovetop'],
        time_active_minutes: 20,
        time_total_minutes: 30,
        skill_min: 2,
        shortcut_level: 'scratch',
        ingredients: [
          { ingredient_id: 'lamb_mince', base_amount: 800, unit: 'g', scaling: 'flex', notes: 'Lean default; regular for juicier/fattier. Not too lean — a bit of fat keeps them juicy. 200g/serve.' },
          { ingredient_id: 'greek_yoghurt_plain', base_amount: 200, unit: 'g', scaling: 'scales', notes: 'Garlic-yoghurt sauce.' },
          { ingredient_id: 'garlic_clove', base_amount: 5, unit: 'count', scaling: 'scales', notes: 'Mince + sauce.' },
          { ingredient_id: 'brown_onion', base_amount: 1, unit: 'count', scaling: 'scales', notes: 'Grated into the mince for moisture (red onion for the salad).' },
          { ingredient_id: 'breadcrumbs', base_amount: 40, unit: 'g', scaling: 'scales', notes: 'Optional binder.' },
          { ingredient_id: 'lemon', base_amount: 1, unit: 'count', scaling: 'scales', notes: 'Into the sauce.' },
          { ingredient_id: 'ground_cumin', base_amount: 2, unit: 'tsp', scaling: 'scales' },
          { ingredient_id: 'ground_coriander', base_amount: 2, unit: 'tsp', scaling: 'scales' },
          { ingredient_id: 'paprika', base_amount: 2, unit: 'tsp', scaling: 'scales' },
          { ingredient_id: 'ground_cinnamon', base_amount: 0.5, unit: 'tsp', scaling: 'scales', notes: 'KEY warm note — do not omit.' },
          { ingredient_id: 'parsley', base_amount: 20, unit: 'g', scaling: 'scales', notes: 'Fresh parsley and/or mint, chopped into the mince.' },
          { ingredient_id: 'olive_oil', base_amount: 1, unit: 'tbsp', scaling: 'scales', notes: 'For searing.' },
          { ingredient_id: 'tomato', base_amount: 200, unit: 'g', scaling: 'scales', notes: 'Salad.' },
          { ingredient_id: 'cucumber', base_amount: 200, unit: 'g', scaling: 'scales', notes: 'Salad.' },
          { ingredient_id: 'salt', base_amount: 1, unit: 'tsp', scaling: 'fixed' },
          { ingredient_id: 'black_pepper_ground', base_amount: 0.5, unit: 'tsp', scaling: 'fixed' },
        ],
        instructions: [
          { summary: 'Mix the kofta: lamb, grated onion, garlic, herbs, spice blend (incl. cinnamon), salt, pepper (+ soaked breadcrumbs). Do not overmix.', substeps: ['Combine the lamb mince with grated onion, minced garlic, chopped parsley/mint, cumin, coriander, paprika, cinnamon, salt, and pepper.', 'Add soaked breadcrumbs if using; mix just until combined — do not overmix.'] },
          { summary: 'Form into ovals/patties and chill 10 min to hold shape.', substeps: ['Form into ovals or patties.', 'Chill 10 minutes to hold their shape.'] },
          { summary: 'Grill or pan-sear 3-4 min per side until browned and cooked through; rest.', substeps: ['Heat the oil over medium-high.', 'Sear 3-4 minutes per side until browned and cooked through; rest.'] },
          { summary: 'Make the garlic-yoghurt sauce and the salad.', substeps: ['Mix the yoghurt with garlic, lemon, and a pinch of salt.', 'Chop the tomato, cucumber, and red onion for the salad.'] },
          { summary: 'Assemble per plate (rice bowl or wrap).', substeps: ['See the plate-specific assembly steps.'] },
        ],
      },
    ],
  },

==================================================================
src/data/meal_substeps.ts
==================================================================
Method-keyed only (plate assembly lives in Plate.additional_instructions).

  lamb_kofta: {
    stovetop: {
      0: [
        'Mix 800g lamb mince with 1 grated onion, 3 minced garlic cloves, 20g chopped parsley/mint, 2 tsp cumin, 2 tsp coriander, 2 tsp paprika, 1/2 tsp cinnamon, 1 tsp salt, 1/2 tsp pepper',
        'Add 40g soaked breadcrumbs if using; mix just until combined — do not overmix',
      ],
      1: [ 'Form into ovals/patties', { text: 'Chill 10 minutes to hold shape', timer_seconds: 600, timer_label: 'Chill' } ],
      2: [ 'Heat 1 tbsp oil over medium-high', { text: 'Sear 3-4 minutes per side until browned and cooked through', timer_seconds: 420, timer_label: 'Grill kofta' }, 'Rest' ],
      3: [ 'Mix the sauce: 200g yoghurt, 2 minced garlic cloves, juice of 1 lemon, pinch of salt', 'Chop 200g tomato, 200g cucumber, red onion for the salad' ],
      4: [ 'Assemble: rice bowl or wrap (see plate steps)' ],
    },
  }

==================================================================
SOURCE & ADAPTATION
==================================================================
Middle Eastern lamb kofta — spiced lamb mince (cumin/coriander/paprika/cinnamon) with grated onion + herbs, grilled, garlic-yoghurt sauce, over rice or in flatbread. Anchored on RecipeTin Eats; consensus from Spoon Fork Bacon, The Mom 100, CookWell. URL: https://www.recipetineats.com/lamb-koftas-yoghurt-dressing-2/
Macros COMPUTED (USDA, LEAN lamb ~85/15): rice_bowl 857/53/88/32/4; wrap 856/55/70/39/6. Regular 80/20 lamb pushes fat to ~52-60g (noted). Lamb is the fattiest protein in the library. Two plates are alternatives (both 1.0).

==================================================================
FINALLY
==================================================================
Typecheck. Confirm no MealSlug/IngredientId/cuisine/slot/category/allergen enum errors and no duplicates. Report reused vs added ids (lamb_mince, greek_yoghurt, ground_cinnamon, ground_cumin, ground_coriander, paprika, parsley, mint_fresh, flour_tortilla_large, jasmine_rice). Confirm both plates' image_filename set + meal-level fallback. Confirm default lamb is LEAN (~85/15).
