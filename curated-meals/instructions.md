# Curated Meals — Instructions

The app maintains a verified internal meal database. Reference these meals by slug instead of inventing recipes when possible. The app fills in recipe details on import; you only pick the meal, plate, and scale.

## Fetching equipment files

Always read this file first. Then fetch only the equipment files matching the user's equipment:

- `blender` → `https://json.fit/curated-meals/blender.md`
- `slow_cooker` → `https://json.fit/curated-meals/slow-cooker.md`
- `stovetop` → `https://json.fit/curated-meals/stovetop.md`
- `oven` → `https://json.fit/curated-meals/oven.md`
- `pressure_cooker` → `https://json.fit/curated-meals/pressure-cooker.md`

A meal with multiple methods appears in multiple files, once per equipment type.

## Data model

Every curated meal follows the same three-level hierarchy. Understand it before authoring or referencing meals:

- **Meal** — the identity. Owns: `slug`, cuisine, primary protein, `eligible_slots`, `min_scale`/`max_scale`, `produces_servings`, and `contains_allergens` (the union across all methods and plates). A meal has NO macros — macros are never attached at the meal level.
- **Method** — how the base is cooked. Owns: equipment list, active/total time, skill. A meal can have several methods (e.g. slow cooker + stovetop + pressure cooker); the same meal appears once per method file. Methods do NOT change macros.
- **Plate** — what the user actually eats (base + carrier/finishing). Owns: `plate_id`, `plate_macros`, `assembly_time_minutes`, `plate_equipment`, `base_servings_consumed`, and optional flags (`is_stunt_plate`, `reserve_before_finishing_note`). Macros live ONLY here.

Key consequence: macros depend on the **plate**, not the meal or the method. The same plate has identical macros no matter which method cooked the base — a meal cooked in a slow cooker vs a pressure cooker yields the same `plate_macros`. There is no "base plate" representing the un-plated dish; the base is a cooking unit, not an eating unit.

## Priority

Prefer curated meals when they fit the user's macros, allergens, equipment, slot eligibility, and dietary needs. Invent meals when no curated meal fits — the database has gaps (breakfast, snacks, some cuisines). Don't force a curated meal into a slot it doesn't belong in.

## Output format

Reference a curated meal in the JSON like this:

```json
{
  "curated_meal_slug": "pulled_pork",
  "plate_id": "sandwich",
  "scale_factor": 1.0,
  "meal_type": "dinner",
  "day": "Monday",
  "time": "6:30 PM"
}
```

No ingredients, instructions, or prep times for curated meals — the app fetches those by slug. Invented meals continue to need full details. Both formats coexist in one plan.

Invalid slugs fail import. Only use slugs that appear in the equipment files you fetched.

## Method equipment

Each cooking method lists `Equipment:` per its entry in the equipment files (e.g. `slow_cooker, stovetop`). The user must have ALL of the equipment listed for that method. Don't assume that fetching `slow-cooker.md` means the user can use any slow cooker method — most slow cooker methods also need stovetop for browning, sauce-making, or finishing steps.

If the user lacks one of a method's required pieces, skip the method. Try another method on the same meal, or a different meal.

## Plate equipment

Each plate declares `Plate equipment:` — equipment needed to assemble that plate, beyond the method's cooking equipment. A plate with `Plate equipment: oven` is unavailable to a user without an oven, even if they have the method's cooking equipment (e.g. a slow-cooked bolognese base is fine, but its baked-potato plate still needs an oven). A plate that needs nothing extra is `Plate equipment: none`.

Filter plates by the user's equipment AFTER filtering methods. A meal is usable only if the user has both a viable method and at least one viable plate.

## Macros and scaling

Each plate has explicit `plate_macros` (kcal/protein/carbs/fat/fiber). At scale_factor 1.0, those are the macros the user consumes. For other scales: `actual = plate_macros × scale_factor`.

Scale bounds are defined per meal by the `min_scale`/`max_scale` fields (shown as the `Scale:` line in each meal entry). These per-meal bounds are the single source of truth — do not apply a global default. Never go outside a meal's stated bounds. Use 0.1 increments.

## Batch cooking

`produces_servings` tells you how many base servings one cook of the recipe yields (a per-meal field, shown in each entry). For multi-serving meals, schedule the same meal multiple times across the week to consume the batch. One pulled pork cook on Sunday → up to 8 placements across the following days. Don't schedule a multi-serving meal once and leave the rest orphaned.

Each placement consumes `base_servings_consumed` from the batch (a per-plate field). Standard plates consume 1.0. Some plates consume more — e.g. a stunt plate built on extra base. Track consumption against `produces_servings`:

`total base consumed = Σ (base_servings_consumed × scale_factor) over all placements`

Keep total consumption at or below `produces_servings`. If it doesn't fit the week: scale down with scale_factor, freeze the excess (mention in plan notes), or pick a different meal.

## Plate rotation

Multi-plate meals exist for variety. When scheduling them multiple times, rotate plates — five pulled pork placements should use different plates, not the same plate five times. Single-plate meals only have one plate.

## Stunt plates

Some plates are flagged `is_stunt_plate: true` (e.g. pulled pork mac & cheese, bolognese lasagne, chilli loaded nachos). Rules:

- Maximum 1 stunt plate per user per week, across all curated meals.
- Use on Friday/Saturday dinner slots ideally.
- Skip entirely for users under 2500 kcal/day targets.
- Stunt plates often have `base_servings_consumed` greater than 1.0 — account for the extra base draw in batch math.

## Reserve notes

Plates with `reserve_before_finishing_note` require setting aside part of the base before a finishing step (e.g. pulled pork tacos needs unsauced pork). Surface these instructions during cook time, not assembly time.

## Eligible slots

Each meal declares `eligible_slots`. If a meal entry overrides the slot list, the override is ABSOLUTE — it lists the complete set of allowed slots, not an addition to a default. Never read an override as "the defaults plus these"; read it as "exactly these." Only place a meal in a slot that appears in its final `eligible_slots`.

## Allergens

Each meal declares `contains_allergens` as the union across methods and plates. If a user has any of those allergens, skip the whole meal — don't try to use it with the offending plate omitted.

## Time investment

Match the user's time-investment preference against `time_active_minutes` (the method's hands-on cook time), not total time. A slow cooker meal at 25 min active is fine for a Speed Cook user. Total time per plate = method's active time + plate's `assembly_time_minutes`.

## Authoring checklist (when adding a new meal)

Before committing a new meal, confirm:

1. Meal level has: slug, cuisine, primary protein, `eligible_slots`, `Scale:` bounds, `produces_servings`, allergen union. No macros at meal level.
2. Each method lists its full equipment set and active/total time.
3. Each plate has: `plate_id`, `plate_macros` (all five values), `Plate equipment:` (or `none`), `Assembly:` time, and `Base servings consumed:`.
4. Plate macros are identical across every method file the meal appears in.
5. The allergen union covers every method and plate.
6. No comparative/superlative claims in notes (e.g. "highest-fat") — these go stale as the database grows. Describe the meal's character instead.
7. Any slot override lists the complete allowed set, not a delta.

## Constraints

- Don't invent macros, ingredients, or instructions for curated meals.
- Don't override partial data. If part of a curated meal doesn't fit, use a different meal.
- A meal is either a curated reference OR a fully-specified invented meal. Not both.
If batch size doesn't fit the week: scale down with scale_factor, freeze the excess (mention in plan notes), or pick a different meal.

## Plate rotation

Multi-plate meals exist for variety. When scheduling them multiple times, rotate plates — five pulled pork placements should use different plates, not the same plate five times. Single-plate meals only have one plate.

## Stunt plates

Some plates are flagged `is_stunt_plate: true` (pulled pork mac & cheese, bolognese lasagne, chilli loaded nachos). Rules:

- Maximum 1 stunt plate per user per week, across all curated meals.
- Use on Friday/Saturday dinner slots ideally.
- Skip entirely for users under 2500 kcal/day targets.

## Reserve notes

Plates with `reserve_before_finishing_note` require setting aside part of the base before a finishing step (e.g. pulled pork tacos needs unsauced pork). Surface these instructions during cook time, not assembly time.

## Allergens

Each meal declares `contains_allergens` as the union across methods and plates. If a user has any of those allergens, skip the whole meal — don't try to use it with the offending plate omitted.

## Time investment

Match the user's time-investment preference against `time_active_minutes` (the method's hands-on cook time), not total time. A slow cooker meal at 25 min active is fine for a Speed Cook user. Total time per plate = method's active time + plate's `assembly_time_minutes`.

## Constraints

- Don't invent macros, ingredients, or instructions for curated meals.
- Don't override partial data. If part of a curated meal doesn't fit, use a different meal.
- A meal is either a curated reference OR a fully-specified invented meal. Not both.
