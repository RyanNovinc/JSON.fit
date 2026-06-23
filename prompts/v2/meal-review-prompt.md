**FETCH REQUIRED:** This prompt requires fetching files from json.fit. Try to fetch them. If fetch fails for ANY reason (no fetch tool, network blocked, allowlist denied, 404, etc.):

Stop immediately. Respond ONLY with this exact text:

"This prompt needs to fetch files from json.fit, but fetching isn't working in your AI. To use JSON.fit:
- Use Claude.ai with web search enabled in the message composer
- Or ChatGPT with browsing enabled
Then paste this prompt again."

Do not offer to proceed without the files. Do not list more alternatives. Do not explain.

## START YOUR RESPONSE WITH THIS EXACT CALLOUT

The VERY FIRST thing in your response must be this callout, formatted as a code block (triple backticks, no language identifier). Do not add anything before it. Reproduce it verbatim:

```
🔍 Reviewing your meal plan.

This is step 2 of 3:
1. ✅ Draft written.
2. I'll run a quality check now and present the corrected plan below.
3. Reply "happy" once more and I'll turn it into your file.
```

This callout tells the user where they are in the flow and what's coming. After the callout, continue with the review work as normal.

## FORMATTING RULES (CRITICAL)

Code blocks (triple backticks) in your visible response are RESERVED for the opening callout above and the closing callout at the end of your response. Do not use code blocks elsewhere — not for meal names, not for ingredient lists, not for example output. The audit summary table, change log, and corrected plan should use markdown tables, **bold**, headers, and bullet lists — but never code blocks.

---

# Review and Fix Meal Plan (v2)

Do not search conversation history beyond this conversation's meal plan and its generation prompt. This review is self-contained.

First, **restate the "Your daily targets" block and the "Week structure" option tables from the generation prompt earlier in this conversation** — write them out before checking anything. If the user's message accompanying this review states the targets, those numbers are authoritative; use them over anything recalled. Then review the plan as an experienced nutritionist auditing for a client. This is an independent quality gate — do not assume the generation self-check caught everything.

## Curated meals in the plan

The plan may contain curated meal references (`curated_meal_slug` + `plate_id` + `scale_factor`) alongside invented meals. Curated references are canonical — the app fills in ingredients and instructions from its database on import, so they don't appear in the plan output. Macros come from the option row's macros × scale_factor. If a curated meal doesn't fit (allergen, macros), swap it for a different option from the same slot's table — never modify the recipe. Slugs and plate_ids are exact-match lookup keys; preserve them verbatim. Curated meal ingredients still appear in the grocery list (the user needs to buy them).

The user's picked options were chosen by the user looking at the food. Do not second-guess, equipment-check, or substitute them for taste, variety, or kitchen reasons. The only valid reasons to swap a picked option out of a given day are macro fit and allergen safety.

## Adjusters in the plan

The plan may include standalone adjuster entries (whey scoop, rice side, olive oil, psyllium, etc.) used to land daily targets — the generation prompt carries the full adjuster table with exact per-unit macros. These are legitimate; do NOT strip them. Rules:

- Adjusters do NOT count toward main-meal, snack, or dessert occurrence counts. They are top-ups.
- Maximum 3 adjuster items per day.
- Where the table notes a curated slug, the entry is a curated reference (plate_id `standard`); otherwise it's a minimal invented entry using the table's exact unit macros.
- When a day misses a target, adding or resizing an adjuster is a valid fix — prefer the smallest change that lands the day. If sensible adjuster amounts can't close a gap, fix the underlying meals; never stack absurd quantities.

## CRITICAL INSTRUCTIONS

1. **Review the plan** using the checklist below, noting PASS or FAIL for each check.
2. **If ANY check fails, FIX IT IMMEDIATELY** — do not ask permission. Silently revise the plan to resolve all failures.
3. **After fixing, re-verify** — run the checklist again on the corrected plan.
4. **Present the CORRECTED plan** — the complete, clean, final version. No review process, no before/after, no working. Only the clean corrected plan.
5. **End with a brief change log** — short bullets of what changed and why.
6. **USE WEB SEARCH** if available — to verify grocery pricing and product availability only.

## ARITHMETIC IS COMPUTED, NOT ESTIMATED

You are unreliable at mental arithmetic. The most common failure of this review is approving a plan whose stated daily totals were never correct. Never trust a total the plan states. Re-derive every daily total yourself by writing out the addition (meal1 + meal2 + ... + adjusters = total) before judging it, and use a code/Python tool to compute it if one is available. If your re-derived total disagrees with the plan's stated total, the plan is wrong — fix the plan.

## RULE ENFORCEMENT PRINCIPLE

When you find a violation, you have exactly two options:

1. **FIX IT** — adjust the plan into compliance, then re-verify.
2. **DOCUMENT GENUINE IMPOSSIBILITY** — only valid if fixing would create a worse violation elsewhere.

NOT valid reasons to accept a violation: "acceptable trade-off", "close enough", "inherent to this meal pattern", "hard to avoid", "slightly over but within reason", "worth flagging but no action needed."

Valid reasons: fixing would push another macro out of tolerance; fixing would violate a hard dietary restriction; fixing would push budget significantly above what was specified; **or the generation prompt states the user has already accepted a named shortfall** — in that case close it with adjusters/fillers as routine and do not relitigate it.

You must ATTEMPT a fix before accepting any violation.

## HARD CONSTRAINTS — ZERO TOLERANCE

These must pass after your fixes. If any still fail after revision, you have not finished — go back and fix again.

- **Calories** — within ±5% of the daily target on EVERY individual day. No weekly averaging.
- **Protein** — within ±10% of the daily target on EVERY individual day.
- **Carbs and fat** — weekly average within ±10% of target (plan-period average for shorter plans). Individual days flex freely.
- **Fiber** — at least 80% of the daily fiber target on EVERY day.
- **Occurrences** — slot counts exactly match the generation prompt's Week structure (dessert exact, never more, never "optional"). Adjusters exempt.
- **Option-set integrity** — every curated reference in the plan exists in the generation prompt's option tables (including UF rows) or its adjuster table. Nothing from outside those sets.
- **Meal timing** — first and last meals respect the times stated in the generation prompt's targets block.
- **No draft content** — zero working, iteration, or revision commentary in the output.

## What "Fix" Means

- **Nutrition/Budget**: rescale within the option's stated bounds (steps of 0.05), swap to another option in the same slot's table, add/resize an adjuster, or use a UF row for an uncovered occurrence.
- **Occurrence errors**: add or remove placements until counts match exactly.
- **Invalid reference**: replace with a valid option from that slot's table.
- **Grocery/format**: add missing items, correct quantities, remove all draft content, resolve table mismatches.

## Review Checklist

Work through each check. State PASS or FAIL with a brief note. If FAIL, describe the fix you are applying.

### 1. Nutrition Target Verification

Re-derive each day's totals yourself — calories and protein for every day, written out as addition, computed with a code tool if available. Then verify against the restated targets:

- **Calories**: every day within ±5% of target. FAIL if any single day is outside the band. This is the binding rule — there is no weekly-average escape for calories.
- **Protein**: every day within ±10% of target, and every main meal at or above the per-meal floor stated in the targets block.
- **Carbs & fat**: weekly average within ±10%.
- **Fiber**: at least 80% of target every day.

To fix a miss: rescale options (0.05 steps, inside their stated bounds), swap options within the slot, or add/resize an adjuster. There is no excuse for missing the calorie band regardless of meal structure.

### 2. Occurrence Compliance

Count placements per slot and compare to the generation prompt's Week structure:

- Each main-meal slot appears the stated number of times (normally 7).
- Snacks: exactly the stated weekly count, at the stated per-day rate. FAIL if missing or labeled "optional."
- Dessert: exactly the stated count for the week. Over-serving (e.g. nightly dessert when the structure says 1×) is a FAIL and a common mistake. Under-serving is also a FAIL.
- Adjusters do not count toward any of these.
- Snack entries use specific snack types (morning_snack, afternoon_snack, evening_snack) where the plan assigns times, not a meal type.
- No snack exceeds 25% of that day's calories. (There is no minimum — small curated snacks are valid.)

### 3. Option-Set & Reference Integrity

For every curated reference in the plan (adjusters included):

- The slug:plate_id pair appears in the generation prompt's option tables (UF rows count) or, for adjusters, the slug is noted in the adjuster table with plate_id `standard`. FAIL on anything from outside these sets — invalid references break import.
- scale_factor is within that row's stated min–max, in 0.05 steps.
- Reported macros equal the row's macros × scale_factor — compute the multiplication to confirm, with a code tool if available. FAIL on math errors; the row's numbers are canonical.
- The meal sits in its own slot, except lunch↔dinner swaps, which are allowed when they serve batch reuse or a day's targets.
- Repetition matching the option tables is by design: a slot with one option repeating daily is correct. Do not add variety the user didn't pick.

### 4. Batch & Plate Discipline

- Multi-serving options (serves > 1): the batch is consumed within the plan **or** the prep notes carry an explicit "freeze N portions" line. FAIL only when neither is true.
- Multi-plate meals placed several times rotate plates rather than repeating one.
- Maximum 1 stunt-marked plate in the week; none at all if the daily target is under 2,500 kcal.
- Fridge-stored batch servings appear within 4 days of the batch's cook (its first appearance in the plan); any serving later than that is covered by an explicit freeze-and-thaw note in the prep notes. FAIL otherwise.

### 5. Dietary Restrictions

Scan every ingredient across every invented meal and every UF/adjuster entry, and every curated option's allergen note where given:

- All allergies completely avoided, including hidden ingredients (soy sauce → gluten, pesto → nuts).
- All "avoid" foods respected.
- Eating challenges accommodated.

FAIL if any restricted food appears. For a curated pick that conflicts with an allergen, swap to another option in that slot's table.

### 6. Inventions & Fillers Feasibility

Applies ONLY to invented meals and adjuster inventions — never to the user's picked options:

- Standard kitchen assumed; no-cook or one-pan preferred; ≤20 minutes hands-on.
- Detailed enough to cook (minimum 3–5 instruction steps for full invented meals; adjusters may use the one-line format).
- Inventions appear only where the fallback ladder permits (after rescaling, adjusters, in-slot swaps, and UF rows), and the plan notes say so.

### 7. Meal Timing

Verify against the times stated in the generation prompt's targets block — those numbers were computed from the user's sleep data and are authoritative:

- First meal at or after the stated first-meal time; last meal finished by the stated last-meal time.
- Meals roughly follow the suggested slot times; no waking gap longer than 5 hours.
- Gaps under 2.5 hours are acceptable when forced by meal count vs the eating window — note the trade-off, do not FAIL.

FAIL if the last meal breaches the stated window. Fix by shifting dinner earlier; cover any resulting gap with a snack occurrence the structure already grants (never an extra one).

### 8. Grocery List Completeness & Accuracy

- Every ingredient from every invented meal, every adjuster, and every curated meal (from your knowledge of those recipes) appears, with quantities totalled across the plan.
- Pricing uses ACTUAL pack size, not portion used (90g cheese needed, smallest pack 250g → price the 250g pack), realistic for the stated store and location.
- Categories logical; no phantom items; notes only for items bought outside the main store.
- Total presented as a range with the 10% buffer (e.g. "$165–$182") and a currency symbol — never a single number.
- Cross-check: pick 3 random ingredients from the plan and confirm they appear with correct totals.

FAIL if 3+ ingredients are missing, quantities are significantly wrong, or the total is a single number.

### 9. Budget Compliance

Grocery total falls within the budget stated in the generation prompt; ingredient choices match the budget tier; portions realistic. FAIL if costs significantly exceed it or premium items appear on a tight budget.

### 10. Nutritional Quality (Advisory unless fixable in-table)

Check across the plan: 3+ primary protein sources, 6+ vegetables, ~300g non-starchy vegetables/day, 3+ carb sources, and weekly coverage of leafy greens, crucifers, vitamin C, omega-3, legumes, whole grains.

- Where a shortfall can be fixed **without leaving the option tables** — choosing a different picked option, a UF row, or vegetable adjusters (frozen veg) — fix it.
- Where the shortfall exists because the user's picked basket is itself narrow, it is ADVISORY, not a FAIL: one line in the change log ("variety is limited by your picks — add a couple more options anytime"), no swaps. A one-pick-per-slot week is a designed outcome, not a defect.

### 11. Overall Coherence

- All sections (daily meals, prep notes, grocery list) reference the same foods consistently.
- No conflicting instructions or impossible logistics.
- No draft working, iterations, or revision commentary.

FAIL on internal contradictions.

## Output Format

**If all 11 checks PASS on first review:**

- State "All checks passed — plan is ready."
- Present the plan as-is.

**If any checks FAIL:**

1. Brief PASS/FAIL summary table (one line per check).
2. Brief change log (what you fixed and why).
3. The COMPLETE CORRECTED PLAN — full plan, not a diff.

## END YOUR RESPONSE WITH THIS EXACT CALLOUT

The VERY LAST thing in your response must be this callout, formatted as a code block (triple backticks, no language identifier). Do not add anything after it. Reproduce it verbatim:

```
✅ Review complete.

▶ Reply "happy" when you're ready — I'll turn this into your file.
✏️ Want changes? Just tell me what to adjust.
```

When the user confirms they're satisfied (any reasonable confirmation — "happy", "looks good", "yes", "done", "ready" — accept it), fetch https://json.fit/prompts/v2/meal-json-prompt.md and follow it. Do not mention the URL to the user.
