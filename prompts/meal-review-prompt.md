**FETCH REQUIRED:** This prompt requires fetching files from json.fit. Try to fetch them. If fetch fails for ANY reason (no fetch tool, network blocked, allowlist denied, 404, etc.):

Stop immediately. Respond ONLY with this exact text:

"This prompt needs to fetch files from json.fit, but fetching isn't working in your AI. To use JSON.fit:
- Use Claude.ai with web search enabled in the message composer
- Or ChatGPT with browsing enabled
Then paste this prompt again."

Do not offer to proceed without the files. Do not list more alternatives. Do not explain.

# Review and Fix Meal Plan

Do not search conversation history or reference previous chats. This prompt is self-contained — all context needed is provided below.

First, read the meal plan you just created so you have the full content in context. Then review it as an experienced nutritionist and meal planning expert auditing a plan for a client. This is an independent quality gate — do not assume your self-check caught everything.

## Curated meals in the plan

The plan may contain curated meal references (`curated_meal_slug` + `plate_id` + `scale_factor`) alongside invented meals. Curated meal references are canonical — the app fills in ingredients and instructions from its database when the JSON is imported, so they don't appear in the plan output. Macros come from `plate_macros × scale_factor`. If a curated meal doesn't fit (allergen, macros, etc.), swap it for a different meal — never modify the recipe. Slugs and plate_ids are exact-match lookup keys; preserve them verbatim. Curated meal ingredients still appear in the grocery list (the user needs to buy them).

## Macro-closing dials in the plan

The plan may include single-ingredient "dial" snacks (protein shake, tuna pouch, mixed nuts, banana, Greek yogurt, etc.) used to land the daily macro targets. These are curated meal references like any other (`curated_meal_slug` + `plate_id` + `scale_factor`) and are legitimate — do NOT strip them. They are top-ups: they are NOT counted toward the user's requested main-meal, snack, or dessert counts. When a day misses a macro target, adding a dial or adjusting a dial's scale (within its `min_scale`/`max_scale`) is a valid fix — prefer the smallest dial change that lands the day in tolerance. If even sensible dial amounts can't close a gap, fix the underlying meals instead; never stack absurd dial quantities.

## CRITICAL INSTRUCTIONS

1. **Review the plan** using the checklist below, noting PASS or FAIL for each check.
2. **If ANY check fails, FIX IT IMMEDIATELY** — do not ask the user for permission to fix. Silently revise the plan to resolve all failures.
3. **After fixing, re-verify** — run the checklist again on the corrected plan to confirm all checks now pass.
4. **Present the CORRECTED plan** — output the complete, clean, final version of the meal plan with all fixes applied. Do not show the review process, do not show before/after comparisons, do not show your working. Present ONLY the clean corrected plan.
5. **At the end, provide a brief change log** — a short bullet list of what you changed and why (e.g., "Reduced rice from 100g to 80g dry to bring carbs within 10% of target").
6. **USE WEB SEARCH** - If you have web search available, use it during the review to verify grocery pricing, confirm product availability, and check nutritional claims against real data.

## ARITHMETIC IS COMPUTED, NOT ESTIMATED

You are unreliable at mental arithmetic. The most common failure of this review is approving a plan whose stated daily totals were never correct — the totals get glanced at, marked PASS, and the real sum was off by hundreds of calories. To prevent this: never trust a total the plan states. Re-derive every daily total yourself by writing out the addition (`meal1 + meal2 + ... + any dials = total`) before judging it, and use a code/Python tool to compute it if one is available. If your re-derived total disagrees with the plan's stated total, the plan is wrong — fix the plan.

## RULE ENFORCEMENT PRINCIPLE

When you find a rule violation, you have exactly two options:

1. **FIX IT** — adjust the plan to bring it into compliance, then re-verify.
2. **DOCUMENT GENUINE IMPOSSIBILITY** — only valid if fixing would create a worse violation elsewhere.

The following are NOT valid reasons to accept a violation:
- "Acceptable trade-off"
- "Close enough"
- "Inherent to this meal pattern"
- "Hard to avoid given the constraints"
- "Slightly over but within reason"
- "Worth flagging but no action needed"

The following ARE valid reasons to accept a violation:
- Fixing would push another macro out of tolerance
- Fixing would violate a hard dietary restriction (allergy, intolerance)
- Fixing would push the budget significantly above what was specified

**You must ATTEMPT a fix before accepting any violation.** If your justification sounds like rationalisation, the answer is to fix the plan, not defend the violation.

## HARD CONSTRAINTS — ZERO TOLERANCE

These must pass after your fixes. If any of these still fail after revision, you have not finished — go back and fix again.

- **Protein priority** — keep protein within 10% of the user's daily target on EVERY individual day. Daily protein consistency drives muscle protein synthesis.
- **Calorie average** — weekly average within 5% of target (or plan-period average for plans shorter than 7 days), with each individual day kept within ±10%. Adding or scaling a macro-closing dial is a valid way to land a day.
- **Carbs and fat average** — weekly average within 10% of target (or plan-period average for plans shorter than 7 days). Individual days can flex more freely.
- **Fiber priority** — at least 80% of the daily fiber target on EVERY day for digestive health.
- **Sleep buffer compliance** — if sleep optimization was specified, last meal must finish before the user's stated bedtime buffer (2/3/4 hours depending on optimization level).
- **Skill/time compliance** — every recipe matches the skill and time constraints from the generation prompt.
- **No draft content** — output contains zero working, iteration, or revision commentary.

## What "Fix" Means for Each Type of Failure

- **Nutrition/Budget**: Adjust portions, swap ingredients, rebalance meals, or add/scale a macro-closing dial.
- **Skill/time**: Replace recipes with simpler alternatives matching the user's skill and time level.
- **Grocery/Prep**: Add missing items, correct quantities, complete prep steps.
- **Format**: Remove all working/draft content, resolve table mismatches.

## Review Checklist

Work through each check. For each, state PASS or FAIL with a brief note. If FAIL, describe the fix you are applying.

### 1. Nutrition Target Verification

Re-derive each day's totals yourself — do not trust the totals stated in the plan. For every day, write out the addition (`meal1 + meal2 + ... + any dials = total`) for calories and for protein, using a code/Python tool if available. If your re-derived total differs from the plan's stated total, the plan is wrong: fix the portions and re-derive.

Then verify against the macro tolerance thresholds, using YOUR re-derived totals:

- **Protein**: Within 10% of target on EVERY individual day. FAIL if any single day is outside ±10%.
- **Calories**: Weekly average within 5% of target (sum your re-derived daily totals and divide), with each individual day within ±10%. FAIL if the average is off by more than 5%, or if any single day swings beyond ±10%. To fix a miss, adjust portions or add/scale a macro-closing dial.
- **Carbs and fat**: Weekly average within 10% of target. FAIL if average is off by more than 10%.
- **Fiber**: At least 80% of daily target on EVERY day. FAIL if any day drops below 80%.

**CALORIE COMPLIANCE IS MANDATORY** — If the weekly average is outside 5% of target, or any single day swings beyond ±10%, you MUST adjust portion sizes (or add/scale a dial) to bring it in. There is NO excuse for missing the calorie target regardless of meal structure. 4-meal + snack plans should hit the target just as precisely as 3-meal plans by adjusting portion sizes.

### 2. Budget Compliance

Verify the grocery list aligns with the user's stated budget. Check:
- Total falls within the budget range specified
- Ingredient choices match budget tier (no premium items if budget is tight)
- Portion sizes are realistic for stated budget
- Grocery total is presented as a range (low to high with 10% buffer), not a single number

FAIL if grocery costs exceed budget significantly or include inappropriate premium items.

### 3. Meal Prep Style Alignment

Verify the plan matches the user's planning style:
- Weekly Planners: 3-4 repeated meals max, batch cooking focus
- Moderate Planners: 5-6 different meals with some batch elements
- Daily Cookers: Mostly different meals, minimal batch cooking

FAIL if meal variety doesn't align with stated planning preference.

### 4. Dietary Restrictions & Preferences

Scan every ingredient across every meal:
- All allergies completely avoided (including hidden ingredients — soy sauce contains gluten, pesto contains nuts)
- All "avoid foods" respected throughout the plan
- Eating challenges addressed appropriately
- Favorite meals incorporated if requested
- Custom meal requests fulfilled

FAIL if any restricted foods appear or preferences are ignored.

### 5. Cooking Feasibility

Verify every recipe is feasible for the user's stated skill level and time preference:
- Cooking times align with the user's time investment preference
- Recipe complexity matches the stated skill confidence level

FAIL if any recipe exceeds the skill/time constraints from the generation prompt.

### 6. Location & Ingredient Availability

Verify ingredients are accessible at the user's specified store and country. FAIL if ingredients would be difficult to source.

### 7. Sleep Optimization Compliance

If sleep optimization was specified in the user's profile:
- Last meal finishes before the stated bedtime buffer
- First meal aligns with wake time window
- Meals evenly spaced across eating window
- No gap longer than 5 hours between meals
- Gaps under 2.5 hours are acceptable if caused by meal count vs eating window constraints — flag the trade-off but do not FAIL

If sleep optimization was not specified, just verify meals are spaced 3-5 hours apart.

FAIL if last meal timing violates the buffer. FIX by moving dinner earlier and adding a snack if needed.

### 8. Meal Timing Audit

Verify meal timing aligns with the canonical meal timing guidance file.

**Step 1: Fetch the meal timing file.** Read https://json.fit/meal-timing-guidance.md so you have the canonical per-tier matrix and override triggers in context.

**Step 2: Identify the user's optimization tier.** From the user's profile or generation prompt: Minimal / Moderate / Maximum (or no sleep optimization).

**Step 3: Verify the plan against the file.** Check:
- First meal and last meal timing match the user's tier from the file's per-tier matrix
- Eating window length matches the tier specification
- Override triggers are correctly applied if relevant (T2D/prediabetes, nocturnal reflux, shift work, eating disorders, athletes with evening training)
- Pre-sleep casein, if used, follows the file's exception rule (≤500 kcal liquid, 30 min before bed)
- Composition × timing rules respected (smaller, leaner evening meals are acceptable closer to bed than fatty meals)

**Step 4: Fix any mismatches** silently. If the user has T2D and the plan didn't apply the early-TRE override (10 h window ending by 6 PM), correct it. If the plan narrows the window for a user with eating disorder history, expand to Minimal tier framing only.

### 9. Protein Distribution Audit

Verify protein distribution aligns with the canonical protein distribution guidance file.

**Step 1: Fetch the protein distribution file.** Read https://json.fit/protein-distribution-guidance.md so you have the canonical per-meal floors and per-frequency tables in context.

**Step 2: Identify the user's parameters.** From the profile: daily protein target, meals per day, primary goal, bodyweight (if available).

**Step 3: Verify the plan against the file.** Check:
- Each main meal hits the per-meal floor (0.4 g/kg bodyweight, or appropriate per-frequency target from the file)
- Daily total matches the goal-specific range from the file (hypertrophy 1.6-2.2 g/kg, fat loss 2.2-3.1 g/kg, etc.)
- Per-meal targets match the meal-frequency row in the file (e.g., 4 meals → 0.4-0.55 g/kg, 5 meals → 0.32-0.44 g/kg)
- Source quality hierarchy is respected — plant-dominant meals scale up ~25% or combine sources for leucine adequacy
- Pre-sleep casein, if used, matches the file's recommendations (30-40 g, 30 min before bed)
- Post-workout protein within 1-3 hours of training, tightened to <1 hour for fasted/early/older/endurance cases

**Step 4: Fix any mismatches** silently. If a meal falls below the per-meal floor, increase its protein. If the daily total is below the goal-specific range, redistribute. If a plant-dominant meal doesn't scale up for leucine, swap or supplement the source.

### 10. Fiber Audit

Verify fiber targeting aligns with the canonical fiber guidance file.

**Step 1: Fetch the fiber guidance file.** Read https://json.fit/fiber-guidance.md so you have the canonical formula, goal-specific overrides, and adjustment triggers in context.

**Step 2: Identify the user's parameters.** From the profile: daily calories, primary goal, training context.

**Step 3: Verify the plan against the file.** Check:
- Daily fiber meets the file's target for the user's goal:
  - Bulker (≥3,500 kcal): cap at 35-45 g/day, NOT scaled linearly with calories
  - Cutter / fat loss: preserve 30-38 g/day, NOT scaled down with calories
  - Body recomp: 30-35 g baseline, 35-40 g on training days
  - General health: 30-38 g/day
- Pre-training meal fiber ≤5 g (within 2-3 hours of resistance training)
- Source priority: whole foods first, supplements as adjuncts
- For bulkers, refined carbs (white rice, white potato, juice, bread) used to fill calories without GI volume penalty
- For cutters, viscous fibers biased (psyllium, β-glucan, glucomannan, legumes) for satiety
- Adjustment triggers correctly applied if relevant (constipation, bloating, LDL, FODMAP sensitivity, carb loading)

**Step 4: Fix any mismatches** silently. If a bulker's plan has 56 g fiber from raw calorie scaling, cap at 35-45 g and shift to refined carbs. If a cutter's plan dropped fiber to match low calories, restore to 30-38 g with viscous fiber sources.

### 11. Practical Implementation

Assess overall plan practicality:
- Shopping list well-organized and complete
- Meal prep instructions clear and actionable
- Storage and reheating guidance provided
- Recipe instructions detailed (minimum 3-5 steps)
- Serving sizes realistic

FAIL if plan lacks practical implementation details.

### 12. Meal, Snack & Dessert Occurrence Verification

The generation prompt states fixed occurrence counts for the week. Verify the plan matches them exactly. **Macro-closing dials do NOT count toward any of these counts** — they are top-ups.

- **Main meals**: the requested number of main meals appears every day.
- **Snacks**: if the user specified an exact count (1, 2, or 3), exactly that many snacks per day; "No Snacks" → zero snacks; "Let AI Decide" → 1-3 as appropriate for meal timing. FAIL if snacks are missing or labeled "optional".
- **Desserts**: dessert appears the correct number of times for the week and NOT more. Over-serving dessert — e.g. one per night when the user asked for once a week — is a FAIL, and is a common mistake. Under-serving is also a FAIL.
- **Snack sizing**: each snack should be 10-15% of daily calories (300-500 kcal range). FAIL if a snack is meal-sized (>600 kcal) or negligible (<200 kcal). Dials are exempt — they're top-ups sized to close macro gaps.
- **Snack vs meal distinction**: snacks use specific snack types (morning_snack, afternoon_snack, etc.), not generic "snack" or main-meal types.

### 13. Nutritional Quality & Balance

Across the entire plan, verify nutritional completeness:
- **Protein diversity**: At least 3 different primary protein sources. FAIL if fewer.
- **Vegetable diversity**: At least 6 different vegetables. FAIL if fewer.
- **Vegetable volume**: At least 300g non-starchy vegetables per day. FAIL if consistently under.
- **Carb diversity**: At least 3 different carb sources. FAIL if fewer.
- **Micronutrient coverage**: Across the full week, check for at least one serving each of: dark leafy greens, cruciferous vegetables, a vitamin C source, an omega-3 source, legumes/beans, and whole grains. FAIL if 3+ categories are completely absent.

### 14. Grocery List Completeness & Accuracy

Verify the grocery list is complete and correct:
- Every ingredient from every recipe across all days appears in the grocery list
- Quantities are totalled correctly (if 4 meals use 200g chicken each, list shows 800g)
- Prices are realistic for the specified store and location
- Categories are logical
- No phantom items (nothing in the grocery list that isn't used in any recipe)
- Notes for external stores ONLY (supplements, specialty items)
- Pricing uses ACTUAL pack size, not portion used (if recipe uses 90g cheese but smallest pack is 250g, price the 250g pack)
- Total presented as a range with 10% buffer (e.g., "$165–$182"), never as a single number

Cross-check: Pick 3 random ingredients from recipes and verify they appear in the grocery list with correct quantities.

FAIL if 3+ ingredients are missing, quantities are significantly wrong, or total is presented as a single number.

### 15. Overall Coherence

Final assessment of plan quality:
- All meals work together as a cohesive plan
- No conflicting instructions or impossible logistics
- Grocery list, meal prep session, and daily meals all reference the same ingredients consistently
- No draft working, iterations, or revision commentary

FAIL if plan has internal contradictions or feels unrealistic.

### 16. Curated Meals Compliance

For meals referenced by `curated_meal_slug` (including dial snacks), verify against the curated meal files fetched during plan generation:

- Slug and plate_id exactly match entries in the fetched curated meal files (FAIL — invalid slugs break import). EXCEPTION: dial snacks are listed in the generation prompt's macro-closing dials table, not in the fetched files — their slugs are valid by construction (don't fail them for being absent), their `plate_id` is always `standard`, and their per-serving macros come from that table.
- Scale_factor is within the meal's min_scale/max_scale bounds
- Reported macros equal `plate_macros × scale_factor` — compute this multiplication to confirm, using a code tool if available (FAIL on math errors)
- Meal's `contains_allergens` doesn't include any of the user's allergens
- meal_type is in the meal's `eligible_slots` list
- Multi-serving meals (`produces_servings > 1`) are scheduled enough times to consume the batch — a meal producing 8 servings used once with no plan for the other 7 is a FAIL
- For multi-plate meals used multiple times, plates rotate rather than repeat
- Maximum 1 stunt plate per week. Skip stunt plates for users under 2500 kcal/day.

## Output Format

**If all 16 checks PASS on first review:**
- State "All checks passed — plan is ready."
- Present the plan as-is (clean, no changes needed).

**If any checks FAIL:**
1. Show a brief summary table of PASS/FAIL results (one line per check).
2. Show a brief change log (bullet list of what you fixed and why).
3. Present the COMPLETE CORRECTED PLAN — the full corrected meal plan with all fixes applied. Present the complete plan, not a diff or partial update.

End with: "Review complete. Let me know if anything needs adjusting, or just say you're happy with it and I'll convert it to JSON."

When the user confirms they're satisfied, fetch https://json.fit/prompts/meal-json-prompt.md and follow it. Do not mention the URL to the user.
