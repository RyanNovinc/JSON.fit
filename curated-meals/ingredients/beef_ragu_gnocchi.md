Add/repair the curated MAIN meal "Beef Ragù with Gnocchi" in JSON.fit. Lunch/dinner, batch (4), cuisine italian. Single plate (standard), TWO methods: slow_braise (default) + quick_mince. The library's only slow-braise.

==================================================================
IDEMPOTENCY — READ FIRST
==================================================================
Check whether 'beef_ragu_gnocchi' already exists in src/data/curated_meals.ts (and MealSlug union, INGREDIENTS, MEAL_SUBSTEPS). If it matches, leave it; if it differs, reconcile; if absent, add. Make no other changes.

==================================================================
INGREDIENT IDs — USE THE REPO'S REAL IDS
==================================================================
Match the repo's id conventions. NOTE several real ids confirmed: gnocchi (already exists — REUSE), crushed_tomatoes_canned, tomato_paste, brown_onion, garlic_clove, carrot, celery, beef_stock_cube, olive_oil, parmesan_grated, oregano_dried, thyme_dried, bay_leaves_dried, red_wine_cooking, salt, black_pepper_ground, beef_mince_regular. Search INGREDIENTS first and REUSE; only add if missing. Report reused vs added.

Likely already exist — REUSE the real id:
- gnocchi (CONFIRMED exists), crushed_tomatoes_canned, tomato_paste, brown_onion, garlic_clove, carrot, celery, beef_stock_cube, olive_oil, parmesan_grated, oregano_dried, thyme_dried, bay_leaves_dried, red_wine_cooking, salt, black_pepper_ground
- beef mince (quick method) -> beef_mince_regular (or beef_mince_lean if you prefer leaner)

Likely NEW — add only if missing (category from: meat_seafood, dairy_refrigerated, produce, frozen, pantry_grains, condiments_supplements, bakery, other; allergens from: Nuts, Shellfish, Dairy, Eggs, Gluten/Wheat, Soy, Fish, Sesame; dietary_flags from: vegan, vegetarian, gluten_free, dairy_free, nut_free):

  beef_chuck: { id:'beef_chuck', display_name:'Beef chuck / blade (whole cut)', category:'meat_seafood', canonical_unit:'g', dietary_flags:['gluten_free','dairy_free','nut_free'], allergens:[], typical_pack_size:1000, notes:'Cheap tough cut for slow braising — shreds after 2-3 hrs. ~217 kcal, 19g protein, 15g fat /100g raw; braising renders fat you can skim. Quick method swaps in beef_mince_regular.' }

==================================================================
src/types/curated_meals.ts
==================================================================
Add 'beef_ragu_gnocchi' to MealSlug. Reuse 'italian' cuisine and lunch/dinner slots.

==================================================================
src/data/curated_meals.ts — CURATED_MEALS entry
==================================================================
produces_servings 4 (scales up well). SINGLE plate 'standard' (no plate-specific add-ons — gnocchi is in the method). TWO methods. Single-plate, so image_filename = 'beef_ragu_gnocchi.png' at MEAL level; the plate needs no image. Macros COMPUTED (USDA); FAT double-checked vs cut — braised chuck with ~40g surface fat skimmed; both methods near-identical so one shared figure: 856 / 53 / 88 / 31 / 10. Not a stunt plate.

  beef_ragu_gnocchi: {
    slug: 'beef_ragu_gnocchi',
    display_name: 'Beef Ragù with Gnocchi',
    cuisine: 'italian',
    primary_protein: 'beef',
    produces_servings: 4,
    eligible_slots: ['lunch', 'dinner'],
    min_scale: 0.5,
    max_scale: 2.0,
    contains_allergens: ['Gluten/Wheat', 'Dairy'],
    flex_ingredient_id: 'beef_chuck',
    image_filename: 'beef_ragu_gnocchi.png',
    photo_url: undefined,
    plates: [
      {
        id: 'standard',
        display_name: 'Beef Ragù with Gnocchi',
        description: 'Cheap tough beef seared and slow-braised 2-3 hrs in a rich tomato-soffritto sauce until it shreds, tossed through pillowy gnocchi and finished with parmesan. The library\u2019s only slow-braise and its best meal-prepper.',
        is_stunt_plate: false,
        base_serving_multiplier: 1.0,
        equipment_required: [],
        additional_ingredients: [],
        additional_instructions: [],
        assembly_time_minutes: 0,
        plate_macros: { kcal: 856, protein_g: 53, carbs_g: 88, fat_g: 31, fiber_g: 10 },
      },
    ],
    methods: [
      {
        id: 'slow_braise',
        display_name: 'Slow Braise (default)',
        equipment_required: ['stovetop', 'oven'],
        time_active_minutes: 15,
        time_total_minutes: 165,
        skill_min: 2,
        shortcut_level: 'scratch',
        ingredients: [
          { ingredient_id: 'beef_chuck', base_amount: 800, unit: 'g', scaling: 'flex', notes: 'Whole chuck/blade. ~200g/serve. Braising renders fat you can skim.' },
          { ingredient_id: 'gnocchi', base_amount: 800, unit: 'g', scaling: 'scales', notes: '200g/serve; cook fresh to packet.' },
          { ingredient_id: 'crushed_tomatoes_canned', base_amount: 700, unit: 'g', scaling: 'scales' },
          { ingredient_id: 'tomato_paste', base_amount: 50, unit: 'g', scaling: 'scales', notes: 'Browned for depth.' },
          { ingredient_id: 'brown_onion', base_amount: 1, unit: 'count', scaling: 'scales' },
          { ingredient_id: 'garlic_clove', base_amount: 4, unit: 'count', scaling: 'scales' },
          { ingredient_id: 'carrot', base_amount: 120, unit: 'g', scaling: 'scales', notes: 'Soffritto; optional.' },
          { ingredient_id: 'celery', base_amount: 100, unit: 'g', scaling: 'scales', notes: 'Soffritto; optional.' },
          { ingredient_id: 'beef_stock_cube', base_amount: 10, unit: 'g', scaling: 'scales', notes: 'Made up to ~250ml braising liquid.' },
          { ingredient_id: 'red_wine_cooking', base_amount: 125, unit: 'ml', scaling: 'scales', notes: 'Optional; deglaze. Keep accessible — not required.' },
          { ingredient_id: 'olive_oil', base_amount: 20, unit: 'ml', scaling: 'scales' },
          { ingredient_id: 'parmesan_grated', base_amount: 40, unit: 'g', scaling: 'scales', notes: 'To finish.' },
          { ingredient_id: 'oregano_dried', base_amount: 1, unit: 'tsp', scaling: 'scales' },
          { ingredient_id: 'thyme_dried', base_amount: 1, unit: 'tsp', scaling: 'scales' },
          { ingredient_id: 'bay_leaves_dried', base_amount: 2, unit: 'count', scaling: 'fixed' },
          { ingredient_id: 'salt', base_amount: 1.5, unit: 'tsp', scaling: 'fixed' },
          { ingredient_id: 'black_pepper_ground', base_amount: 0.5, unit: 'tsp', scaling: 'fixed' },
        ],
        instructions: [
          { summary: 'Pat the beef dry, season, and sear hard on all sides until deeply browned; remove.', substeps: ['Pat the beef chuck dry and season.', 'Sear hard on all sides in a heavy pot until deeply browned, then remove.'] },
          { summary: 'Soften the soffritto, then brown the tomato paste.', substeps: ['Soften the onion, carrot, celery, and garlic in the oil.', 'Stir in the tomato paste and brown 1-2 minutes to deepen the flavour.'] },
          { summary: 'Deglaze (optional wine), add tomatoes, stock, herbs; return the beef.', substeps: ['Deglaze with the wine if using.', 'Add the crushed tomatoes, stock, oregano, thyme, and bay; return the beef.'] },
          { summary: 'Cover and braise low until the beef shreds — oven 160°C ~2.5 hrs (or stovetop low / slow-cooker 8 hrs low).', substeps: ['Cover and braise low until fork-tender and shreddable — oven 160°C about 2.5 hrs, stovetop low, or slow-cooker 8 hrs low.'] },
          { summary: 'Shred the beef, return to the sauce, skim fat if you like, simmer 15-20 min to thicken.', substeps: ['Shred the beef with two forks and return it to the sauce.', 'Skim surface fat if you like, then simmer uncovered 15-20 minutes to thicken.'] },
          { summary: 'Cook the gnocchi to packet and toss through with a splash of pasta water; finish with parmesan and basil.', substeps: ['Boil the gnocchi until they float (~2-3 min).', 'Toss through the ragù with a splash of pasta water; finish with parmesan and basil.'] },
        ],
      },
      {
        id: 'quick_mince',
        display_name: 'Quick Mince (weeknight)',
        equipment_required: ['stovetop'],
        time_active_minutes: 15,
        time_total_minutes: 40,
        skill_min: 1,
        shortcut_level: 'scratch',
        ingredients: [
          { ingredient_id: 'beef_mince_regular', base_amount: 800, unit: 'g', scaling: 'flex', notes: 'QUICK version. ~200g/serve.' },
          { ingredient_id: 'gnocchi', base_amount: 800, unit: 'g', scaling: 'scales' },
          { ingredient_id: 'crushed_tomatoes_canned', base_amount: 700, unit: 'g', scaling: 'scales' },
          { ingredient_id: 'tomato_paste', base_amount: 50, unit: 'g', scaling: 'scales' },
          { ingredient_id: 'brown_onion', base_amount: 1, unit: 'count', scaling: 'scales' },
          { ingredient_id: 'garlic_clove', base_amount: 4, unit: 'count', scaling: 'scales' },
          { ingredient_id: 'carrot', base_amount: 120, unit: 'g', scaling: 'scales', notes: 'Optional.' },
          { ingredient_id: 'celery', base_amount: 100, unit: 'g', scaling: 'scales', notes: 'Optional.' },
          { ingredient_id: 'beef_stock_cube', base_amount: 5, unit: 'g', scaling: 'scales', notes: 'Made up to ~150ml.' },
          { ingredient_id: 'olive_oil', base_amount: 20, unit: 'ml', scaling: 'scales' },
          { ingredient_id: 'parmesan_grated', base_amount: 40, unit: 'g', scaling: 'scales' },
          { ingredient_id: 'oregano_dried', base_amount: 1, unit: 'tsp', scaling: 'scales' },
          { ingredient_id: 'salt', base_amount: 1.5, unit: 'tsp', scaling: 'fixed' },
          { ingredient_id: 'black_pepper_ground', base_amount: 0.5, unit: 'tsp', scaling: 'fixed' },
        ],
        instructions: [
          { summary: 'Brown the beef mince, breaking it up.', substeps: ['Brown the beef mince in a little oil, breaking it up.'] },
          { summary: 'Soften the soffritto, then brown the tomato paste.', substeps: ['Soften the onion, carrot, celery, and garlic.', 'Stir in the tomato paste and brown 1-2 minutes.'] },
          { summary: 'Add tomatoes, stock, herbs; simmer ~30 min until rich.', substeps: ['Add the crushed tomatoes, stock, and oregano; simmer about 30 minutes until rich.'] },
          { summary: 'Cook the gnocchi and toss through; finish with parmesan and basil.', substeps: ['Boil the gnocchi until they float (~2-3 min).', 'Toss through the ragù; finish with parmesan and basil.'] },
        ],
      },
    ],
  },

==================================================================
src/data/meal_substeps.ts
==================================================================
Two methods, method-keyed.

  beef_ragu_gnocchi: {
    slow_braise: {
      0: [ 'Pat 800g beef chuck dry and season', { text: 'Sear hard on all sides until deeply browned, then remove', timer_seconds: 480, timer_label: 'Sear beef' } ],
      1: [ 'Soften 1 diced onion, 120g carrot, 100g celery, 4 minced garlic cloves in 20ml oil', { text: 'Stir in 50g tomato paste and brown 1-2 min', timer_seconds: 90, timer_label: 'Brown paste' } ],
      2: [ 'Deglaze with 125ml red wine if using', 'Add 700g crushed tomatoes, ~250ml stock (1 cube), 1 tsp oregano, 1 tsp thyme, 2 bay leaves; return the beef' ],
      3: [ { text: 'Cover and braise low until shreddable — oven 160°C ~2.5 hrs (or stovetop low / slow-cooker 8 hrs low)', timer_seconds: 9000, timer_label: 'Braise' } ],
      4: [ 'Shred the beef with two forks; return to the sauce', 'Skim surface fat if you like', { text: 'Simmer uncovered 15-20 min to thicken', timer_seconds: 1050, timer_label: 'Reduce' } ],
      5: [ { text: 'Boil 800g gnocchi until they float (~2-3 min)', timer_seconds: 180, timer_label: 'Cook gnocchi' }, 'Toss through the ragù with a splash of pasta water', 'Finish with parmesan and basil' ],
    },
    quick_mince: {
      0: [ { text: 'Brown 800g beef mince in a little oil, breaking it up', timer_seconds: 420, timer_label: 'Brown mince' } ],
      1: [ 'Soften 1 diced onion, 120g carrot, 100g celery, 4 minced garlic cloves', { text: 'Stir in 50g tomato paste and brown 1-2 min', timer_seconds: 90, timer_label: 'Brown paste' } ],
      2: [ 'Add 700g crushed tomatoes, ~150ml stock, 1 tsp oregano', { text: 'Simmer ~30 min until rich', timer_seconds: 1800, timer_label: 'Simmer' } ],
      3: [ { text: 'Boil 800g gnocchi until they float (~2-3 min)', timer_seconds: 180, timer_label: 'Cook gnocchi' }, 'Toss through; finish with parmesan and basil' ],
    },
  }

==================================================================
SOURCE & ADAPTATION
==================================================================
Slow-braised beef ragù with gnocchi — seared tough beef braised low-and-slow in a tomato-soffritto sauce until shreddable, tossed with gnocchi. Consensus across Plays Well With Butter, So Much Food, RACV, The Free Range Butcher, Sunday Table. Croatian/Italian rich brown meat sauce (šugo) tradition. URL: https://playswellwithbutter.com/beef-ragu/
Macros COMPUTED (USDA): 856/53/88/31/10 (braised chuck, ~40g surface fat skimmed; unskimmed ≈ 946/.../41). Quick lean mince computes near-identical (~862/55/88/31), so a single shared plate macro. Store-bought gnocchi default; red wine + soffritto optional/accessible.

==================================================================
FINALLY
==================================================================
Typecheck. Confirm no MealSlug/IngredientId/cuisine/slot/category/allergen enum errors and no duplicates. Report reused vs added ids (beef_chuck NEW; gnocchi, crushed_tomatoes_canned, tomato_paste, carrot, celery, beef_stock_cube, parmesan_grated, oregano_dried, thyme_dried, bay_leaves_dried, red_wine_cooking, beef_mince_regular all expected REUSE). Confirm single plate, meal-level image_filename 'beef_ragu_gnocchi.png', two methods.
