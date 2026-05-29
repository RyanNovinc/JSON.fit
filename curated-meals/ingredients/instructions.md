# Curated meal ingredients — global instructions

This file explains how to read and use any per-meal ingredient file under `https://json.fit/curated-meals/ingredients/{meal_slug}.md`. Each per-meal file is pure structured data (identity, methods, plates) with no preamble and no inline rules. The rules below apply to every meal.

---

## Purpose

The per-meal files exist so the planning AI can:
1. Read the structured ingredient data for the meals a user has selected.
2. Schedule those meals against the user's macro targets.
3. Produce a localised shopping list using the user's grocery store and location (provided earlier in the prompt).

The AI does not cook. Cooking instructions and human-facing notes are not in these files — they live in the app and are rendered for the user from a separate data source.

---

## File structure (every per-meal file)

Each file has three sections, in this order:

### 1. Identity
A bulleted list of meal-level fields:
- `slug` — unique identifier
- `display_name` — human-readable name
- `primary_protein` — beef / chicken / pork / lamb / dairy / etc.
- `eligible_slots` — comma-separated list of which meal slots this meal can fill (breakfast, lunch, dinner, morning_snack, pre_workout, etc.)
- `produces_servings` — how many servings the base recipe yields (1 for smoothies and single-serve meals; 4-8 for batch-cook meals)
- `min_scale` and `max_scale` — the allowed range for `scale_factor`
- `flex_ingredient_id` — the ingredient that absorbs scale adjustments
- `contains_allergens` — comma-separated allergen list

### 2. Methods
One subsection per cooking method. Each method has:
- Method ID and display name as the subheading
- Bulleted metadata: equipment required, active time, total time
- A markdown table of base ingredients with columns: `Ingredient | Amount | Unit | Scaling`

Multiple methods may exist for the same meal (e.g. slow cooker vs stovetop). The user picks one method per meal; the AI uses only the ingredients from the chosen method.

### 3. Plates
One subsection per plate. A "plate" is what the base recipe becomes on the user's plate (e.g. bolognese can become spaghetti, baked potato, garlic bread, or lasagne). Each plate has:
- Plate ID and display name as the subheading (stunt plates marked with ⚡ STUNT)
- Bulleted metadata: macros (kcal / P / C / F / fiber), plate equipment, base servings consumed
- A markdown table of additional ingredients (or "Additional ingredients: none" if there are none)

Some plates have a "Reserve-before-finishing note" if part of the base recipe needs to be set aside before saucing (e.g. plain shredded pork for tacos before tossing the rest in BBQ sauce).

---

## How to use these files

### Scaling rules

1. **Start with the base ingredients** under the method the user picked.

2. **Multiply each `scales` ingredient** by:
   - `scale_factor` (from the user's plan), AND
   - the proportion of base servings being eaten — `(servings being eaten / produces_servings)`.

   Examples:
   - User eats 4 servings of bolognese (which `produces_servings: 8`) at `scale_factor: 1.0` → multiply scales-ingredients by 1.0 × (4/8) = 0.5.
   - User eats 1 serving of butter chicken (which `produces_servings: 1`) at `scale_factor: 1.2` → multiply by 1.2 × (1/1) = 1.2.
   - User eats all 8 servings of bolognese at `scale_factor: 0.85` → multiply by 0.85 × (8/8) = 0.85.

3. **Keep `fixed` ingredients fixed.** Herbs, spices, and seasonings stay the same regardless of portion count. They flavour the dish; they don't scale with how much you're eating.

4. **`flex` ingredients** are the bulker dial — they absorb plan-level macro adjustments. The plan's `scale_factor` already accounts for them. Treat them like `scales` unless the prompt tells you otherwise.

5. **Round sensibly.** Don't ask the user to buy 187g of mince when 500g is the smallest pack. Round up to a realistic pack size, and consolidate when the same ingredient appears in multiple meals.

### Plates

6. **Plate ingredients are per-serving.** For each plate the user eats, add the plate's `additional_ingredients` × the number of times they eat that plate.

7. **Plates with `base_servings_consumed > 1` are one bake at a time.** If a plate consumes, say, 6 base servings (like bolognese's `lasagne` plate), the schedule must group all 6 portions together — one bake commits 6 base servings and produces 6 plate portions. The user cannot eat a fractional bake. Quantities in the plate's ingredient table are per-portion; multiply by `base_servings_consumed` to get the full-bake total.

8. **Stunt plates (marked ⚡)** are higher-effort, higher-impact treats. Macros are usually higher. Schedule them sparingly — typically once per week, on a day when the user has time to cook.

### Localisation

9. **Replace generic ingredient names with brand-specific products** available at the user's grocery store and location. The user's store and location are provided earlier in the prompt. Examples:

   - `beef_mince_regular` → "Coles 3-Star Beef Mince 500g" (Coles, Australia) or "Woolworths Heart Smart Beef Mince 500g" (Woolworths, Australia)
   - `crushed_tomatoes_canned` → "Mutti Polpa 400g" or "Ardmona Rich & Thick Crushed Tomatoes 400g"
   - `chicken_thigh_skinless` → "Coles RSPCA Approved Chicken Thigh Fillets 1kg"

10. **Keep the quantities.** Only the names and pack-size guidance change. If a brand-specific product comes in a different default pack size, round the user's required quantity up to the nearest pack.

11. **If a generic ingredient isn't available at the user's store**, substitute the closest equivalent and flag it. Example: if the user shops at a small IGA that doesn't stock Kashmiri chilli powder, substitute "sweet paprika + a pinch of cayenne" and note the swap.

12. **Match dietary flags.** If the user has dietary restrictions (vegetarian, gluten-free, dairy-free, nut-free), choose brand-specific products that meet those restrictions and flag any ingredients in the meal that conflict with them.

---

## A note on the master ingredient dictionary

Every `ingredient_id` referenced in any per-meal file corresponds to an entry in the app's master `INGREDIENTS` dictionary, which contains: display name, category, canonical unit, dietary flags, allergens, and typical pack size. The AI does not need to fetch this dictionary — the per-meal files contain enough information on their own. The dictionary exists in case the AI is asked to reason about ingredient properties beyond what's in the per-meal file.
