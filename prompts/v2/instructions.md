# JSON.fit Meal Planning — Instructions (v2)

You fetched this file because a JSON.fit generation prompt told you to. It confirms your fetch capability works and defines how to read that prompt. Everything you need to build the plan — targets, slot structure, meal options with macros, curated ingredient tables, adjusters — is **inline in the prompt itself**. Do not fetch any per-meal files; there are none in this flow.

> Note on formatting: the generation prompt asks you to reserve code blocks in your **visible chat response** for its opening and closing callouts. The code block below is REFERENCE MATERIAL for you — it shows the JSON shape of a curated reference — it is not text you reproduce in chat. Curated references go into the chat plan as part of the per-day arithmetic and as compact entries, not as JSON code blocks.

## Options vs occurrences (the one rule that matters most)

The prompt gives each slot an **occurrence count** (how many times it appears across the week) and a table of **options** (the foods allowed to fill it). An option is a choice, not a promise of appearance.

- Fill every occurrence by choosing ONE option and a scale factor.
- Options may repeat across the week. One option for seven occurrences = that food seven times, varying scale. That is correct, not a defect.
- More options than occurrences = some options go unused. Also correct.
- Never exceed an occurrence count, and never label an occurrence "optional."

**Worked example 1 — dessert.** The user picked 3 dessert options but dessert occurs **1×/week**. Correct output: ONE dessert in the whole plan, using the best-fitting of the three. Three desserts, or "optional dessert" entries, is wrong.

**Worked example 2 — batch meal.** Pulled pork serves 8 and is a lunch/dinner option. If you schedule it, place enough servings across the week's lunch/dinner occurrences to consume the batch, rotating its plates — or state "freeze N portions" in the prep notes. One placement with 7 orphaned servings and no freeze note is wrong.

## Servings consumed is not the placement count

For any option that serves more than one, the servings a plan actually consumes is the **sum of the scale factors**, never the number of times it appears.

- Six placements at 0.7 consume **4.2 servings**, not 6.
- Batches to cook = ceil(servings consumed ÷ serves).
- Leftovers = (batches × serves) − servings consumed. State them in the prep notes.

Prep notes, freeze counts and every grocery quantity follow from the batch figure. Deriving them from the placement count buys and cooks far more food than the plan eats, and it is invisible in the plan output — nothing looks wrong until the user is standing at the checkout.

## Curated reference output contract

Options with a `key` in the form `slug:plate_id` are curated meals. Output them as **references only** (this code block is reference material — see the formatting note above):

```
{ "curated_meal_slug": "pulled_pork", "plate_id": "sandwich", "scale_factor": 1.0 }
```

- Never write ingredients, instructions, or recipes for curated options in the plan — the app fills those in on import.
- **The grocery list is the exception.** The user has to buy the food, so curated ingredients are aggregated there as shopping items. Take them from the prompt's ingredient tables, which are the authoritative recipes — never from your own knowledge of the dish, and never as a recipe or method in the plan. Amounts come from the arithmetic in the prompt's grocery section.
- The ingredient tables are deliberately generic and brand-free so you can localise them: find the equivalent product where the user shops, use pack sizes sold there, and price in the local currency. Swap the product, not the recipe.
- Slugs and plate_ids are exact-match lookup keys: copy them **verbatim** from the option tables. Invalid keys break import.
- Macros for a serving = the option row's macros × scale_factor. Use scale steps of **0.05**, inside the row's stated min–max. Never go outside a row's bounds.
- Rows marked **(UF)** are universal fillers the user did not pick — use them only to cover occurrences the user's picks can't.
- Maximum **1 stunt-marked plate** per week; skip stunt plates entirely below 2,500 kcal/day.

## User-created meals

Options marked **(user-created)** — their slugs start with `custom_` — are meals the user typed into the app themselves: their own recipe, photo and macros.

- Output them exactly like curated references: `{ "curated_meal_slug": "custom_…", "plate_id": "standard", "scale_factor": 1.0 }`. A `custom_` slug is a verbatim lookup key like any other.
- Their scale is **fixed at 1.0** (the row's min–max reads 1–1). Never rescale one to close a macro gap — close gaps with adjusters instead.
- Their macros are **user-entered and authoritative**. Never adjust, "correct", or recompute them from the ingredients — schedule the row's numbers as given.
- Their ingredient table is headed USER-CREATED and its amounts are already **PER SERVING**: multiply by scale_factor only, never divide by a servings count. The rows carry no id, so those grocery items get no bracketed id. Localise and price them like everything else, but never add ingredients the user did not write — and if the table says the user listed none, put nothing on the grocery list for that meal and do not invent a recipe for it.

## Adjuster output contract

Adjusters are standalone entries used to close a day's macro gaps (max 3 per day). They do **not** count toward meal, snack, or dessert occurrence counts.

- Where the adjuster table notes a curated slug, output a curated reference (plate_id `standard`).
- Otherwise output a minimal invented entry: name, type, time, the table's exact per-unit macros, ingredients on one line, instructions on one line.

## Inventions (last resort only)

Follow the prompt's fallback ladder: rescale → adjusters → swap within the slot → UF rows → invent. If you must invent, keep it simple (standard kitchen, no-cook or one-pan, ≤20 min hands-on), respect the allergy/avoid list, and say so in the plan notes.

If anything in this file conflicts with the generation prompt, the prompt wins — it carries the user's actual numbers.
