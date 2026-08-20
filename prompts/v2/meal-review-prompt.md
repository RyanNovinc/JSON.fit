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
🔍 Running the quality check on your plan.

This is the second of three steps:
1. ✅ Draft written.
2. I'm auditing it now against your targets and fixing anything that misses.
3. Reply "happy" once you're satisfied and I'll turn it into your file.

Don't want to read all of it? Skip to 🔍 What the check changed at the bottom.
```

This callout tells the user where they are in the flow, so a list of check results doesn't read as an error report. It appears every time, whether or not any checks fail, and it comes before everything else including the target restatement described below.

## FORMATTING RULES (CRITICAL)

Code blocks (triple backticks) in YOUR CHAT RESPONSE are RESERVED for the opening callout above and the closing callout at the end. Do not use code blocks anywhere else in your visible response — not for meal names, not for slugs, not for arithmetic lines, not for example output. Use **bold**, headers, tables and bullet lists for everything else.

Note: this rule applies to what you write in chat. Anything you fetch is your own reference material and is not part of your visible response — the user never sees it.

Emoji in a HEADING is reserved the same way. The only heading in your entire response allowed to carry an emoji is the summary heading near the end, "🔍 What the check changed". Every other heading is plain text. Status markers such as ✅ and ❌ inside tables and prose are unaffected — this rule is about headings only, and it exists so the user can find the summary by scrolling without reading.

# Review and Fix Meal Plan (v2)

Do not search conversation history beyond this conversation's meal plan and its generation prompt. This review is self-contained.

First, **internally restate the "Your daily targets" block and the "Week structure" option tables from the generation prompt earlier in this conversation** and hold them as your working reference before checking anything. Do not print them — the restatement is working, not output. If the user's message accompanying this review states the targets, those numbers are authoritative; use them over anything recalled. Then review the plan as an experienced nutritionist auditing for a client. This is an independent quality gate — do not assume the generation self-check caught everything.

## Curated meals in the plan

The plan may contain curated meal references (`curated_meal_slug` + `plate_id` + `scale_factor`) alongside invented meals. Curated references are canonical — the app fills in ingredients and instructions from its database on import, so they don't appear in the plan output. Macros come from the option row's macros × scale_factor. If a curated meal doesn't fit (allergen, macros), swap it for a different option from the same slot's table — never modify the recipe. Slugs and plate_ids are exact-match lookup keys; preserve them verbatim. Curated meal ingredients still appear in the grocery list (the user needs to buy them).

The user's picked options were chosen by the user looking at the food. Do not second-guess, equipment-check, or substitute them for taste, variety, or kitchen reasons. The only valid reasons to swap a picked option out of a given day are macro fit and allergen safety.

## User-created meals in the plan

Some options are the user's OWN meals — their slugs begin `custom_`, their option rows are marked **(user-created)**, and their ingredient tables are headed USER-CREATED. Treat them as curated references: same reference shape, same verbatim slug and plate_id, resolved by the app on import. Four differences, all of which override the general curated rules above:

- **Their scale is fixed at 1.0** — the row's min–max reads 1–1. Never rescale a user-created meal to close a macro gap, and never treat a scale of 1.0 as something to optimise. Land the day with the other levers: rescale a curated option, swap within the slot, or add or resize an adjuster.
- **Their macros are user-entered and authoritative.** Do not adjust, "correct", or recompute them from the ingredients. If the ingredients look inconsistent with the macros, the macros are right.
- **Their ingredient list is exactly what the user typed.** You have no knowledge of these recipes — there is nothing to recall and nothing to correct. Use only the rows in their USER-CREATED table, whose amounts are already PER SERVING (multiply by scale_factor only, never divide by a servings count). Those rows carry no id, so their grocery items get no bracketed id.
- **A user-created meal whose table lists no ingredients contributes nothing to the grocery list.** That is correct and is not a check-8 failure. Never invent a recipe for it, and never fill the gap from your own knowledge of a dish with a similar name.

Everything else applies as normal: they count toward occurrences like any other meal, they must respect allergens, and they can be swapped out of a day for macro fit or allergen safety like any other option.

## Adjusters in the plan

The plan may include standalone adjuster entries (whey scoop, rice side, olive oil, psyllium, etc.) used to land daily targets — the generation prompt carries the full adjuster table with exact per-unit macros. These are legitimate; do NOT strip them. Rules:

- Adjusters do NOT count toward main-meal, snack, or dessert occurrence counts. They are top-ups.
- Maximum 3 adjuster items per day.
- Where the table notes a curated slug, the entry is a curated reference (plate_id `standard`); otherwise it's a minimal invented entry using the table's exact unit macros.
- When a day misses a target, adding or resizing an adjuster is a valid fix — prefer the smallest change that lands the day. If sensible adjuster amounts can't close a gap, fix the underlying meals; never stack absurd quantities.

## Variety setting and the Variety note

The generation prompt carries a VARIETY directive (convenience / balanced / high) — a user setting applying to MAIN slots only. Variety is generation's job, not yours: do not add or remove variety, and do not treat repetition in breakfast, snack or dessert slots as a defect at any setting.

The plan notes must contain a 'Variety' item (one line per main slot). It is required plan content, not draft commentary — preserve it. While counting placements in check 2, confirm its per-slot numbers match the plan; correct the numbers if they don't.

A reported shortfall that names its binding constraint is DOCUMENTED IMPOSSIBILITY under the rule enforcement principle — accept it, do not relitigate or attempt fixes. A shortfall with no named constraint, or a missing Variety note, gets the note added/corrected plus at most one advisory line in the change log. Never run a fix pass for variety.

## CRITICAL INSTRUCTIONS

1. **Review the plan** using the checklist below, noting PASS or FAIL for each check.
2. **If ANY check fails, FIX IT IMMEDIATELY** — do not ask permission. Silently revise the plan to resolve all failures.
3. **After fixing, re-verify** — run the checklist again on the corrected plan.
4. **Present the CORRECTED plan** — the complete, clean, final version. No review process, no before/after, no working. Only the clean corrected plan.
5. **End with the "What the check changed" summary** — the section specified at the bottom of this file, immediately before the closing callout. It replaces the old free-form change log, and it is the last thing in your response.
6. **USE WEB SEARCH** if available — to verify grocery pricing and product availability only.

## ARITHMETIC IS COMPUTED, NOT ESTIMATED

You are unreliable at mental arithmetic. The most common failure of this review is approving a plan whose stated daily totals were never correct. Never trust a total the plan states. Re-derive every daily total yourself by writing out the addition (`meal1 + meal2 + ... + adjusters = total`) before judging it, and use a code/Python tool to compute it if one is available. If your re-derived total disagrees with the plan's stated total, the plan is wrong — fix the plan.

## EFFORT LIMIT

You are AUDITING, not solving. The plan in front of you is nearly final.

- Fix what fails by the smallest change that lands it: rescale, swap within the slot, add or resize an adjuster. Try at most THREE fixes for any one failure, then take the best and move on.
- Do NOT write a solver, an optimiser, a search, or a scripted enumeration over meal combinations, scales, or week layouts. A code tool is for ARITHMETIC — re-deriving a day's totals, multiplying a scale, summing a grocery quantity — never for searching the option space.
- Do NOT try to PROVE a weekly average is unreachable. If two or three honest fixes cannot bring carbs or fat into band without breaking a daily band, that is the finding: name the binding constraint in one line and move on. An exhaustive search costs the user minutes and tells them nothing the one line does not, and reporting that you ran one is not evidence of rigour.
- The generation step has already documented any shortfall it hit. Confirming it is enough; re-deriving it from scratch is wasted work.

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
- **Batch quantities** — servings consumed of a multi-serving meal equal the SUM OF ITS SCALE FACTORS, never its placement count. Prep notes and grocery quantities must follow from that.
- **No draft content** — zero working, iteration, or revision commentary in the output (the Variety item in the plan notes is plan content, not draft commentary).

## What "Fix" Means

- **Nutrition/Budget**: rescale within the option's stated bounds (steps of 0.05), swap to another option in the same slot's table, add/resize an adjuster, or use a UF row for an uncovered occurrence. Never rescale a user-created (`custom_`) option — its bounds read 1–1 and its macros are the user's own.
- **Occurrence errors**: add or remove placements until counts match exactly.
- **Invalid reference**: replace with a valid option from that slot's table.
- **Batch quantity errors**: recompute servings consumed as the sum of scale factors, recompute batches, then correct the prep notes and every affected grocery quantity.
- **Grocery/format**: build or correct the list, fix quantities, remove all draft content, resolve table mismatches.

## Review Checklist

Work through each check. State PASS or FAIL with a brief note. If FAIL, describe the fix you are applying.

### 1. Nutrition Target Verification

Re-derive each day's totals yourself — calories and protein for every day, written out as addition, computed with a code tool if available. Then verify against the restated targets:

- **Calories**: every day within ±5% of target. FAIL if any single day is outside the band. This is the binding rule — there is no weekly-average escape for calories.
- **Protein**: every day within ±10% of target, and every main meal at or above the per-meal floor stated in the targets block.
- **Carbs & fat**: weekly average within ±10%.
- **Fiber**: at least 80% of target every day.

To fix a miss: rescale options (0.05 steps, inside their stated bounds), swap options within the slot, or add/resize an adjuster. A user-created option is not a lever here — its scale is pinned at 1.0; adjust something else on the day. There is no excuse for missing the calorie band regardless of meal structure. Observe the effort limit above: at most three attempts per failure, and no searching the option space.

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

- The `slug:plate_id` pair appears in the generation prompt's option tables (UF rows count) or, for adjusters, the slug is noted in the adjuster table with plate_id `standard`. FAIL on anything from outside these sets — invalid references break import. A `custom_` slug is a valid reference like any other, provided it appears in the option tables.
- scale_factor is within that row's stated min–max, in 0.05 steps. User-created rows read 1–1, so anything other than exactly 1.0 on a `custom_` slug is a FAIL — fix it by setting the scale back to 1.0 and closing the resulting gap with an adjuster, never by leaving it rescaled.
- Reported macros equal the row's macros × scale_factor — compute the multiplication to confirm, with a code tool if available. FAIL on math errors; the row's numbers are canonical.
- The meal sits in its own slot, except lunch↔dinner swaps, which are allowed when they serve batch reuse or a day's targets.
- Repetition matching the option tables is by design: a slot with one option repeating daily is correct. Do not add variety the user didn't pick.

### 4. Batch & Plate Discipline

**Servings consumed is the sum of the scale factors, NOT the number of placements.** This is the most commonly missed check in this review, and it is silent — everything looks right until the user cooks far too much food. Compute it explicitly for every multi-serving meal, with a code tool if available:

- **Servings consumed** = sum of the scale_factors of every placement of that meal. Six placements at 0.7 consume **4.2 servings**, not 6.
- **Batches to cook** = ceil(servings consumed ÷ serves).
- **Leftovers** = (batches × serves) − servings consumed. State them.
- FAIL if the prep notes, the freeze counts, or the grocery quantities were derived from the placement count instead. Fix by recomputing all three from the batch figure.

Then:

- Multi-serving options (serves > 1): the batch is consumed within the plan **or** the prep notes carry an explicit "freeze N portions" line. FAIL only when neither is true.
- Multi-plate meals placed several times rotate plates rather than repeating one. User-created meals have a single plate (`standard`) — repeating it is correct, not a FAIL.
- Maximum 1 stunt-marked plate in the week; none at all if the daily target is under 2,500 kcal.
- Fridge-stored batch servings appear within 4 days of the batch's cook (its first appearance in the plan); any serving later than that is covered by an explicit freeze-and-thaw note in the prep notes. FAIL otherwise. User-created meals state no storage life — assume the same 4 days.

### 5. Dietary Restrictions

Scan every ingredient across every invented meal and every UF/adjuster entry, and every curated option's allergen note where given:

- All allergies completely avoided, including hidden ingredients (soy sauce → gluten, pesto → nuts).
- All "avoid" foods respected.
- Eating challenges accommodated.

FAIL if any restricted food appears. For a curated pick that conflicts with an allergen, swap to another option in that slot's table. A user-created meal carries its own allergen list from the user — check it like any other option, and swap it out of the day if it conflicts.

### 6. Inventions & Fillers Feasibility

Applies ONLY to invented meals and adjuster inventions — never to the user's picked options, curated or user-created:

- Standard kitchen assumed; no-cook or one-pan preferred; ≤20 minutes hands-on.
- Detailed enough to cook (minimum 3–5 instruction steps for full invented meals; adjusters may use the one-line format).
- Inventions appear only where the fallback ladder permits (after rescaling, adjusters, in-slot swaps, and UF rows), and the plan notes say so.

### 7. Meal Timing

Verify against the times stated in the generation prompt's targets block — those numbers were computed from the user's sleep data and are authoritative:

- First meal at or after the stated first-meal time; last meal finished by the stated last-meal time.
- Meals roughly follow the suggested slot times; no waking gap longer than 5 hours.
- Gaps under 2.5 hours are acceptable when forced by meal count vs the eating window — note the trade-off, do not FAIL.

FAIL if the last meal breaches the stated window. Fix by shifting dinner earlier; cover any resulting gap with a snack occurrence the structure already grants (never an extra one).

### 8. Grocery List — BUILD IT

The plan has no grocery list yet. Generation deliberately doesn't write one, so that you build it once against a plan that is already final rather than one that might still change.

**The ingredient tables are in the generation prompt earlier in this conversation**, in the section headed "Ingredients — FOR STEP 2, NOT NOW", along with the store, city and weekly budget. Scroll back and use them. They are there; if you think they are missing, look again before reporting it.

Do this AFTER checks 1 to 7, so you are pricing the corrected plan and not the draft.

- Build from those ingredient tables. They are the authoritative recipes. Do NOT reconstruct a curated meal's ingredients from its name or from your own knowledge of the dish; the app cooks the recipe in those tables, not yours.
- The same rule binds harder on tables headed USER-CREATED: those rows are the user's own typed ingredients and are the ONLY source for that meal. Never pad them, never substitute your idea of the dish, and never add an ingredient the user did not write. Their amounts are already PER SERVING — multiply by scale_factor only, never divide by a servings count — and they carry no id, so those items get no bracketed id. If a USER-CREATED table says the user listed no ingredients, that meal contributes nothing to the list; that is correct and is not a miss.
- The tables cover every option the user picked, including ones the plan didn't use. Only buy for meals that appear in the FINAL plan.
- Quantities are computed, not estimated. For each ingredient: (base amount ÷ servings the base recipe makes) × scale_factor for every placement, plus plate per-serving rows × scale_factor, summed across the plan. For multi-serving meals the figure that matters is the batches cooked (check 4), not the placement count. Use a code tool if available.
- Carry each item's id in square brackets after its name, exactly as the table gives it, even after you localise the product name.
- Finish with the separate "If you cook these from scratch" list and its own subtotal, kept out of the main total.
- Pricing uses ACTUAL pack size, not portion used (90g cheese needed, smallest pack 250g → price the 250g pack), realistic for the stated store and location.
- Loose produce (bananas, single potatoes, one lemon) is priced to the amount actually used — the pack-size rule does not apply to items sold loose. A quantity far above what the plan consumes is a FAIL.
- Where an item carries BOTH a weight and a piece count ("590 g, about 4 medium"), the two must agree at a normal size for that produce in the user's country. Do the division and check it. A count that does not follow from the weight makes every quantity on the list look guessed, which is the one thing a shopping list cannot afford. If you are unsure of typical sizes locally, give the weight alone rather than an invented count.
- Categories logical; no phantom items; notes only for items bought outside the main store, and never a price tip.
- Total presented as a range with the 10% buffer (e.g. "$165–$182") and a currency symbol — never a single number.
- Cross-check: pick 3 random ingredients from the plan, recompute their totals from the ingredient tables, and confirm they match.

This check cannot "pass" without a list: if you have not written one, you have not finished. FAIL also if 3+ ingredients are missing, quantities are significantly wrong, or the total is a single number.

### 9. Budget Compliance

The budget is stated in the generation prompt's step-2 grocery context line, next to the store and city. Grocery total falls within it; ingredient choices match the budget tier; portions realistic. FAIL if costs significantly exceed it or premium items appear on a tight budget.

**Single-use items that force a whole new product.** Scan the list for any item that appears in exactly one meal, is needed in a tiny amount, and cannot be bought in a small enough pack. Ask two questions:

1. Is this item a large share of the whole shop — say a tenth or more of the total? Judge it against the total you just calculated, in the user's own currency. There is no fixed figure here and there should not be; a jar that is trivial on one budget dominates another.
2. Does an option in the SAME slot's table achieve the same thing using something already on the list?

If both are yes, swap to that option and note it in the change log. A worked case: a dessert used once needed a small amount of chocolate protein powder, so the list bought a whole tub for that one serving, while a different dessert in the same table used the vanilla protein powder the plan was already buying. Same slot, same role in the day, a large share of the shop saved.

If the answer to (2) is no, the item stays — the user picked these options and a single expensive ingredient is not a reason to drop a meal they chose. Do not invent a substitute, and do not silently remove the meal. This applies with no exceptions to user-created meals: never drop or alter one over an ingredient's cost.

### 10. Nutritional Quality (Advisory unless fixable in-table)

Check across the plan: 3+ primary protein sources, 6+ vegetables, ~300g non-starchy vegetables/day, 3+ carb sources, and weekly coverage of leafy greens, crucifers, vitamin C, omega-3, legumes, whole grains.

- Where a shortfall can be fixed **without leaving the option tables** — choosing a different picked option, a UF row, or vegetable adjusters (frozen veg) — fix it.
- Where the shortfall exists because the user's picked basket is itself narrow, it is ADVISORY, not a FAIL: one line in the change log ("see the Variety note — add a couple more options anytime"), no swaps. A one-pick-per-slot week is a designed outcome, not a defect.

### 11. Overall Coherence

- All sections (daily meals, prep notes, grocery list) reference the same foods consistently.
- No conflicting instructions or impossible logistics.
- No draft working, iterations, or revision commentary.

FAIL on internal contradictions.

## Output Format

Your response is always in this order:

1. The opening callout.
2. A brief PASS/FAIL table, one line per check. Report the checks that FAILED in full; for the rest, one line giving the count that passed. A wall of identical PASS rows buries the two rows that matter.
3. The COMPLETE CORRECTED PLAN — full plan, not a diff. No before/after, no working.
4. The "What the check changed" section specified below.
5. The closing callout.

If all 11 checks pass on first review, step 2 is one line ("All 11 checks passed") and the plan is presented as-is. The section at step 4 still appears — see its rule for the nothing-changed case.

---

## FINISH WITH "What the check changed"

The LAST thing in your response before the closing callout is one section, headed exactly:

## 🔍 What the check changed

The user already approved this plan at step 1. The only new information in this entire response is the DIFFERENCE between what they approved and what you are now showing them, plus the grocery list you just built, which they have never seen. Everything above this section is your working. This is the only part written for someone deciding whether to say happy again.

Write it in this exact order, and write nothing else in it:

1. **A change table, OUTSIDE the quote.** One row per change you actually made. Columns: What I found | What I changed | What it means for you. The third column is written for the user, not for a nutritionist: what will be different when they eat or shop, in plain words. If a change costs them nothing, say so. Merge trivially related fixes into one row rather than listing six near-identical rescales separately.
2. **Everything from here down goes INSIDE a blockquote** — every line prefixed with a > character, including the blank lines between paragraphs.
3. **One line on the shop, ALWAYS PRESENT.** The grocery total as a range with its currency, the store, and the number of prep sessions. This is the first time the user sees any of it, so it is the most valuable line in the section: "**Your shop:** AU$165–182 at Coles, plus two prep sessions, Sunday and Wednesday."
4. **One line on targets.** Either "Every day still lands inside its calorie and protein bands", or the days that moved and where they landed.
5. **One line on structure, ALWAYS PRESENT.** If nothing in the step 1 "Your plan at a glance" summary moved — the meals filling each slot, the occurrence counts, the prep days, the daily calorie figure — write exactly: "**Your meals are unchanged** — same food, same days, as you approved them." If any of those DID move, replace it with "**Your plan changed** — [what moved]. Check the plan above before you say happy." Never omit this line. Silence is indistinguishable from the section being broken, and the user cannot tell the difference between "nothing moved" and "nobody checked".
6. **Any documented impossibility**, one line each, naming the constraint that blocked the fix. A variety shortfall that already named its constraint at step 1 goes here as one line, not as a new finding.

If the review found nothing to fix, the change table is omitted entirely and the quoted lines still appear, led by: "> All 11 checks passed. Nothing changed from the plan you approved." The shop line and the structure line follow it. Do not pad, do not list the checks you ran, and do not manufacture a cosmetic change so the table has content. Finding nothing is a good outcome and the user should be told it plainly.

Hard rules for this section:

- THE BLOCKQUOTE IS NOT DECORATION. It is what makes this section look different from the plan and the audit above it, so the user can find the part written for them. Every single line inside it starts with a > character. A blank line inside the quote is "> " on its own, NOT an empty line — an unprefixed blank line ends the quote early and splits the section in two.
- The change table stays OUTSIDE the quote. Tables nested inside blockquotes render inconsistently across different AI apps, and this file is read by several.
- ONE LINE per table cell. If a fix needs a paragraph to justify, the justification belongs up in the audit and the table carries only the conclusion.
- No re-derivation, no per-day arithmetic, no meal lists, no restatement of the corrected plan or the grocery list. The shop line is a total, not a list.
- The whole section must fit on one phone screen.
- It goes immediately before the closing callout, nowhere else.
- This is the only heading in the response that may carry an emoji.

Shape to follow, including the > prefixes exactly as shown. The content is illustrative only — use the real review:

---

## 🔍 What the check changed

| What I found | What I changed | What it means for you |
|---|---|---|
| Thursday came in 180 kcal under target | Added a whey scoop adjuster at 3pm | One extra shake on Thursday |
| Pulled pork batch sized from 6 placements, not 6.3 servings | Recomputed batches and the grocery quantity | You buy 1.2kg of pork, not 2kg |
| Dessert appeared 3 times, your structure grants 1 | Kept Saturday, removed the other two | Two fewer desserts |
| Chocolate protein tub bought for one dessert serving | Swapped to the vanilla dessert in the same slot | AU$22 off the shop, same slot, same day |

> **Your shop:** AU$165–182 at Coles, plus two prep sessions, Sunday and Wednesday.
>
> **Targets:** every day still lands inside its calorie and protein bands.
>
> **Your plan changed** — dessert dropped from 3 to 1 and Thursday gained an adjuster. Check the plan above before you say happy.

## END YOUR RESPONSE WITH THIS EXACT CALLOUT

The VERY LAST thing in your response must be this callout, formatted as a code block (triple backticks, no language identifier). Do not add anything after it. Reproduce it verbatim:

```
✅ Quality check complete.

▶ Reply "happy" and I'll convert this into your JSON.fit file.
✏️ Want changes? Just tell me what to adjust.
```

When the user confirms they're satisfied (any reasonable confirmation — "happy", "looks good", "yes", "done", "ready" — accept it), fetch https://json.fit/prompts/v2/meal-json-prompt.md and follow it. Don't mention URLs to the user.
