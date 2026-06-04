# Authoring `meal_prep` — classification rubric

> Hosted reference doc (GitHub Pages, e.g. `https://json.fit/curated-meals/meal-prep-authoring.md`).
> This is for **whoever (or whatever) authors curated meals**. It is NOT fetched by the AI meal-planning pipeline — the app now derives the prep session deterministically from `meal_prep` + the plan. Keep it accurate; the prep feature is only as good as these classifications.

Every curated meal should carry a `meal_prep` block on the meal (and optionally an override on individual plates). It tells `buildPrepSession` how a meal is prepped ahead when the user batches their week.

```ts
meal_prep?: {
  strategy: 'full' | 'partial' | 'none';
  prep_note?: string;                 // one-line card summary
  reason?: string;                    // 'none' only: why it's fresh
  storage?: { fridge_days?: number; freeze_months?: number };
  prep_ahead_step_ids?: string[];     // 'partial' override (see note at end)
  day_of_step_ids?: string[];         // 'partial' override (see note at end)
};
```

If you leave `meal_prep` off a meal entirely, the app treats it as `none` (it lands in "Make fresh"). So an unclassified meal is safe — it just never shows up as cook-ahead.

---

## Pick the strategy

### `none` — make it fresh, nothing to prep
Use when the dish is *worse* made ahead, or is pure assembly with no cooking.

- Dairy bowls: yoghurt + fruit, cottage cheese bowls
- Smoothies / shakes (separate, oxidise, go grainy)
- Fresh undressed salads that wilt; anything texture-sensitive cold
- Grab-and-go items that are already "done" (jerky, a banana, a protein bar)

Always give a short `reason` — it shows in the Make Fresh list so the user knows it was skipped on purpose.

```ts
meal_prep: {
  strategy: 'none',
  reason: 'Best fresh — yoghurt and fruit go watery if pre-mixed.',
}
```

### `full` — cook everything ahead, store, reheat
Use for dishes that reheat as well as (or better than) day one.

- Stews, curries, braises, ragùs, chilli
- Roasts and pulled/shredded meats
- Mince dishes, soups, casseroles
- Cooked grain + protein bowls (e.g. teriyaki chicken & rice)

These surface as the headline **"Cook N servings"** cards and deep-link straight into the cook flow with servings preset.

```ts
meal_prep: {
  strategy: 'full',
  prep_note: 'Cook the curry, cool, store. Reheats brilliantly.',
  storage: { fridge_days: 4, freeze_months: 3 },
}
```

### `partial` — cook the cooked bits ahead, finish fresh
Use when there's a cooked core plus a crisp / fresh / sauce-on-top / bread / assembly element that has to happen at eating time.

- Spiced cooked protein → assembled into a fresh wrap or bowl (shawarma, kofta, fajita)
- A stew or ragù served with bread/pasta cooked fresh
- Anything with a fried egg, fresh salad, or crunchy topping added day-of

**Default boundary — no extra authoring needed:** the chosen method's base `instructions` are the *prep-ahead* steps, and the plate's `additional_instructions` are the *day-of* steps. This is exactly the recipe's existing "Cook the base" vs "Plate it up" split, so for most `partial` meals you set nothing beyond `strategy` + `prep_note`.

```ts
meal_prep: {
  strategy: 'partial',
  prep_note: 'Cook and store the spiced chicken. Build the wrap fresh.',
  storage: { fridge_days: 4, freeze_months: 2 },
}
```

---

## Storage defaults

Author real numbers where you know them; otherwise fall back to these.

| Component | Fridge | Freezer |
|---|---|---|
| Cooked protein (chicken, beef, pork) | ~4 days | ~3 months |
| Cooked grains (rice, pasta, oats) | ~5 days | — |
| Roasted / cooked veg | ~3 days | — |
| Sauces, dressings, braising liquid | ~4–5 days | — |
| Stews / curries / soups (combined) | ~4 days | ~3 months |

`storage` drives the "fridge 4 days · freeze 3 mo" line on the card. Omit `freeze_months` for things that don't freeze well (most assembled or dairy-heavy dishes).

---

## Plate-level overrides

`meal_prep` can also sit on a single `Plate`, where it **overrides the meal-level value for that plate only**. The plate inherits the meal's `meal_prep` when it has none of its own.

Typical case: the base is `full`, but one plate adds a fresh element.

- Bolognese (meal) → `full` (the sauce reheats fine)
- Bolognese **"with garlic bread"** plate → `partial` (reheat the sauce, bake the bread fresh)
- Bolognese **lasagne** plate → `full` (bake it, reheat slices)

```ts
// on the bolognese meal
meal_prep: { strategy: 'full', prep_note: 'Make the sauce, store, reheat.', storage: { fridge_days: 4, freeze_months: 3 } },

// on its garlic-bread plate
meal_prep: { strategy: 'partial', prep_note: 'Reheat the sauce; bake the bread fresh.' },
```

---

## Worked examples from the current catalogue

| Meal | Strategy | Why |
|---|---|---|
| `butter_chicken` | `full` | Curry reheats perfectly; rice cooks fresh or reheats. |
| `bolognese`, `chilli_con_carne`, `massaman`, `beef_stew`, `lamb_shanks`, `pulled_pork` | `full` | Slow-cooked, reheat-friendly. (Override individual fresh/bread plates to `partial`.) |
| `teriyaki_chicken_rice_bowl`, `beef_broccoli_stir_fry`, `chicken_fajita_bowl` | `full` | Cooked protein + rice/veg bowls; the whole bowl reheats. |
| `chicken_shawarma`, `lamb_kofta` | `partial` | Cook the protein ahead; assemble the wrap/bowl with fresh salad + sauce day-of. |
| `spaghetti_carbonara` | `none` | The egg sauce doesn't hold or reheat — explicitly a cook-fresh dish. |
| `greek_yoghurt_bowl`, `cottage_cheese_bowl`, `smoked_salmon_bagel` | `none` | Assembly / dairy / texture-sensitive. |
| Smoothies (`brekkie_grow`, `mango_mass`, …) | `none` | Separate and oxidise; blend fresh. |
| Grab-and-go snacks (`beef_jerky`, `banana_snack`, `protein_bar`, …) | `none` | Already done; nothing to prep. |
| Batch bakes (`fudgy_protein_brownies`, `no_bake_protein_balls`, `egg_muffins`, `freezer_breakfast_burrito`) | `full` | Made in a batch up front; store/freeze and grab. |

---

## A note on the step-id overrides (not yet wired)

`prep_ahead_step_ids` / `day_of_step_ids` exist for the rare meal whose prep boundary *isn't* "base ahead, plate fresh." **They are not consumed by the app yet** — `RecipeStep` has no stable `id`, so the only supported `partial` boundary today is the default base/plate split. Don't rely on these fields to change behaviour. If a meal genuinely needs a custom split, flag it: we'll add `id?: string` to `RecipeStep` and wire the override before that meal ships.
