**FETCH REQUIRED:** This prompt requires fetching files from json.fit. Try to fetch them. If fetch fails for ANY reason (no fetch tool, network blocked, allowlist denied, 404, etc.):

Stop immediately. Respond ONLY with this exact text:

"This prompt needs to fetch files from json.fit, but fetching isn't working in your AI. To use JSON.fit:
- Use Claude.ai with web search enabled in the message composer
- Or ChatGPT with browsing enabled
Then start again from your JSON.fit prompt."

Do not offer to proceed without the files. Do not list more alternatives. Do not explain.

## START YOUR RESPONSE WITH THIS EXACT CALLOUT

The VERY FIRST thing in your response must be this callout, formatted as a code block (triple backticks, no language identifier). Do not add anything before it. Reproduce it verbatim:

```
🔍 Reviewing your plan.

This is step 2 of 3:
1. ✅ Draft written.
2. I'll run a quality check now and present the corrected plan below.
3. Reply "happy" once more and I'll turn it into your file.

Don't want to read all of it? Skip to 🔍 What the check changed at the bottom.
```

This callout tells the user where they are in the flow and what's coming. After the callout, continue with the review work as normal.

## FORMATTING RULES (CRITICAL)

Code blocks (triple backticks) are RESERVED for the opening callout above and the closing callout at the end of your response. Do not use code blocks anywhere else — not for exercise names, not for sample workouts, not for anything else. The audit tables and corrected plan should use markdown tables, **bold**, headers, and bullet lists — but never code blocks. This visual treatment is reserved so the user's eye is drawn to the two callouts that contain their next-step instructions.

Emoji in a HEADING is reserved the same way. The only heading in your entire response allowed to carry an emoji is the summary heading near the end, "🔍 What the check changed". Every other heading is plain text. Status markers such as ✅, ❌, ⚠️ and ℹ️ inside tables and prose are unaffected — this rule is about headings only, and it exists so the user can find the summary by scrolling without reading.

---

# Critical Training Plan Review

Do not search conversation history or reference previous chats. This prompt is self-contained — all context needed is provided below.

First, read the workout program you just created so you have the full content in context. Then review it as an experienced workout planning expert conducting an independent audit of this training plan for a client. This is an independent quality gate — do not assume your self-check caught everything.

## CRITICAL INSTRUCTIONS

1. **Review the plan** using the checklist below, noting PASS or FAIL for each check.
2. **If ANY check fails, FIX IT IMMEDIATELY** — do not ask the user for permission to fix. Silently revise the plan to resolve all failures.
3. **After fixing, re-verify** — run the checklist again on the corrected plan to confirm all checks now pass.
4. **Present the CORRECTED plan** — output the complete, clean, final version of the workout program with all fixes applied.
5. **End with the "What the check changed" summary** — the section specified at the bottom of this file, immediately before the closing callout. It replaces the old free-form change log.
6. **Session Duration Reporting** — Calculate and report the duration of each training day based on exercise count, sets, and the rest summary stated in the plan. Include duration in the program output so the user knows what to expect. Do NOT treat duration as a constraint to fix — the user's volume and rest preferences drive session length, and that is intentional.

   Duration is an estimate at the user's default rest pace. The app applies rest itself and recalculates session length live, so a user who switches to a faster pace mid-workout will see a shorter figure than the one you report here. That is expected, not an error to correct.

   **Soft warning only:** If any single session exceeds 2 hours (120 minutes), add a brief note to the user along the lines of: "⚠️ Day X is estimated at [duration] minutes — this is on the long end and may be hard to sustain productively. This is a result of your high volume and rest period choices. If that's intentional, no changes needed. If you'd like shorter sessions, consider [Conservative volume / a faster rest pace / more training days]."

   Do NOT pause for user confirmation. Do NOT compress rest periods or reduce volume to fit a time target. Continue with the program as designed unless the user explicitly asks for changes.

## RULE ENFORCEMENT PRINCIPLE

When you find a rule violation, you have exactly two options:

1. **FIX IT** — adjust the program to bring it into compliance, then re-verify with the table.
2. **DOCUMENT GENUINE IMPOSSIBILITY** — only valid if fixing would create a worse violation elsewhere.

The following are NOT valid reasons to accept a violation:
- "Acceptable trade-off"
- "Exempt-from-floor muscle so it's fine"
- "Appropriate for this user's experience level"
- "All from compound indirect work"
- "Slightly over but within MRV"
- "Worth flagging but no action needed"
- "Below the guideline but appropriate here"

The following ARE valid reasons to accept a violation:
- Fixing would push another muscle below MEV
- Fixing would push another muscle above MRV
- Fixing would require an exercise not in the library
- Fixing would violate a hard constraint from the user profile (equipment, movement limitations)

**You must ATTEMPT a fix before accepting any violation.**

**Attempting a fix is capped at three rounds.** Try up to three targeted changes — add or remove sets, swap an exercise for another in the library, move sets to another training day. If the violation is still there after the third round, stop, mark the muscle ℹ️ CONSTRAINED, name the constraint blocking it in one line, and present the plan. Never write a search, solver, or enumeration over exercise and set combinations, and never state or imply that you checked every possibility. Three honest attempts and a clear explanation is the required standard, not proof.

Name the blocking constraint in one line in the summary. You do not need to reproduce the failed attempts or their cascade tables in your output — the user wants the corrected plan and a short reason, not your working.

If your justification sounds like rationalisation rather than a named constraint, the answer is to fix the program, not defend the violation.

The user can override your fix if they disagree. Your job is to enforce the rules first.

## QUALITY CHECKLIST

### Exercise Library & Tag Audit (DO THIS FIRST)

This audit is the most important check in this review. Volume calculations downstream are meaningless if tags are wrong, so verify tags BEFORE running volume enumeration.

**Step 1: Fetch the library.** Read https://json.fit/exercises.md so you have the canonical tags in context.

**Step 2: Check EVERY exercise in the program** — its primary tags, its secondary tags, and its name — against the library. Do this for all of them, without exception. Compare the exact muscle lists, not a paraphrase or an abbreviation.

**Step 3: Report only the MISMATCHES.** Do not print a row for an exercise that matches. Give the count of exercises checked, then a table of mismatches only:

| Exercise | Plan Primary Tags | Library Primary Tags | Plan Secondary Tags | Library Secondary Tags |
|----------|-------------------|----------------------|---------------------|------------------------|
| Barbell Row | Upper Back, Lats | Upper Back | Biceps, Rear Delts | Lats, Biceps, Rear Delts |

If every exercise matches, write one line: "Tag audit: [N] exercises checked against the library, all match." Nothing else.

Checking every exercise is not optional. Only the REPORTING is trimmed to failures, because a wall of identical PASS rows buries the two rows that matter.

**Step 4: Fix every mismatch.** Correct the program so its tags exactly match the library's tags. The library is authoritative — your biomechanical knowledge is not. If the library says Primary = Upper Back only, the program must say Primary = Upper Back only, even if you believe Lats are also primary movers.

**Common mistake patterns to specifically check for:**
- Rows (Barbell Row, T-Bar Row, Chest-Supported T-Bar Row, Seated Cable Row, Pendlay Row, Seal Row): Library Primary = Upper Back ONLY. Lats is Secondary. Do NOT add Lats to Primary.
- Squats and Lunges (Barbell Back Squat, Front Squat, Hack Squat, Leg Press, Bulgarian Split Squat, Walking Lunge, Reverse Lunge): Library Primary = Quads ONLY. Glutes is Secondary. Do NOT add Glutes to Primary.
- RDL variants (Romanian Deadlift, Stiff-Leg Deadlift): Library Primary = Hamstrings ONLY. Glutes and Lower Back are Secondary.
- Hip Thrust / Glute Bridge: Library Primary = Glutes ONLY. Hamstrings is Secondary.

**Step 5: Re-verify.** After fixing tags, re-check every corrected exercise and confirm it now matches before moving to volume enumeration.

**Step 6: Other library checks.**
- Every exercise name must appear EXACTLY in the library (no variants, no abbreviations)
- Alternative exercises must also be from the library
- If any exercise is not in the library, replace it with a library entry that fits the movement pattern

**Do not proceed to volume enumeration until every tag matches.** Wrong tags will produce wrong volume numbers, and the user will see different numbers in the app than what you tell them here.

Exercise names carry a second job beyond tags: the app looks each one up by name to decide how long that exercise rests for. A name that does not match the library falls back to a generic default rest. So a name mismatch is not cosmetic — fix it here rather than letting it through.

### Per-Muscle Volume Targets (DO THIS BEFORE VOLUME ENUMERATION)

The volume enumeration tables in the next section need correct per-muscle target ranges to verify against. The original plan should already include a per-muscle target table — but rebuild it here from the canonical source to verify it's correct.

**Step 1: Fetch the landmarks file.** Read https://json.fit/volume-landmarks.md so you have the canonical per-muscle MEV/MAV/MRV ranges in context.

**Step 2: Identify the user's tier and experience.** From the original plan or user profile:
- Volume Tier (Conservative / Moderate / High Volume)
- Training Experience (Complete Beginner / Beginner / Intermediate / Advanced)

**Step 3: Look up the tier × experience mapping.** In the landmarks file, find the matching cell in the tier mapping table to determine the position within MAV (e.g., "MAV-low", "MAV-mid", "MAV-high to MRV").

**Step 4: Build the per-muscle target table.** For every muscle in the program (including any auxiliary muscles the user has selected), apply the position from Step 3 to that muscle's MAV range from the landmarks file:

| Muscle | Target Range (effective sets/week) |
|--------|------------------------------------|
| Chest | [low]–[high] |
| Lats | [low]–[high] |
| Upper Back | [low]–[high] |
| Front Delts | [low]–[high] |
| Side Delts | [low]–[high] |
| Rear Delts | [low]–[high] |
| Biceps | [low]–[high] |
| Triceps | [low]–[high] |
| Quads | [low]–[high] |
| Hamstrings | [low]–[high] |
| Glutes | [low]–[high] |
| Calves | [low]–[high] |
| (continue for any auxiliary muscles user has selected, using their MAV-low range as floor) |

**Step 5: Compare to the plan's target table.** If the original plan's table differs from what you computed from the landmarks file, USE YOUR COMPUTED VALUES, not the plan's values. The landmarks file is the canonical source. Note any discrepancies in the audit output.

Use this per-muscle target table when running volume enumeration in the next section. Each muscle has its own range — do NOT apply a single major/medium range to all muscles.

### RIR Guidance Audit

Verify RIR guidance is present and correct for every exercise in the plan.

**Step 1: Fetch the RIR file.** Read https://json.fit/rir-guidance.md so you have the canonical matrix in context.

**Step 2: Check every exercise has RIR guidance.** Every exercise in the plan should have an RIR specification. If any exercise is missing RIR guidance, add it using the matrix from the file.

**Step 3: Verify RIR matches the matrix.** For each exercise, confirm:
- Exercise category is correctly identified (compound vs isolation vs machine vs unilateral)
- RIR values match the file's matrix for the user's goal and mesocycle week
- Within-exercise progression follows the set-count pattern from the file
- Format matches the user's experience tier (behavioural cues for beginners, numerical for advanced)

**Step 4: Fix any mismatches** silently and re-verify before presenting the corrected plan. Report only the checks that FAILED, plus a one-line pass count for the rest.

**Why this audit matters more than it looks.** RIR is not only a training cue in JSON.fit. The app combines each exercise's first-set reps with its first-set RIR to estimate the load, and that estimate decides whether a compound gets heavy-compound rest or moderate-compound rest. RIR that is missing, or set far from what the lifter will actually do, changes how long they rest as well as how hard they train.

### Rep Range Audit

Verify rep ranges are correct for every exercise in the plan based on its category and the user's primary goal.

**Step 1: Fetch the rep range file.** Read https://json.fit/rep-range-guidance.md so you have the canonical per-category × goal table in context.

**Step 2: Check every exercise has a rep range that matches its category.** For each exercise in the plan, confirm:
- The exercise's category is correctly identified (heavy compound, moderate compound, unilateral compound, large isolation, small isolation, power)
- The prescribed rep range falls within the file's per-category range for the user's primary goal
- Goal-specific adjustments are applied (e.g., strength programs use lower rep ranges per the file's Goal-Specific Rules section)

**Step 3: Fix any mismatches** silently. If a heavy compound is prescribed at 12-15 reps but the user's goal is strength (where heavy compounds should be 1-6), correct the rep range and re-verify. Report only the categories that FAILED, plus a one-line pass count for the rest.

**Note:** The single-joint arm exercise exception (all curl variations and triceps isolation always use 10-15 reps regardless of program rep focus) is enforced in the Output Format and applies on top of the per-category guidance.

### Deload Audit

Verify the plan's deload programming — whether a deload is required, and if so whether it is correctly placed and structured — against the canonical deload guidance.

**Step 1: Fetch the deload file.** Read https://json.fit/deload-guidance.md so you have the canonical frequency matrix and structure rules in context.

**Step 2: Identify the user's experience and each block's length.** From the original plan or user profile: Training Experience (Complete Beginner / Beginner / Intermediate / Advanced) and the week-length of each block in the program.

**Step 3: Check deload PRESENCE against the matrix.** For each block, use the file's experience × block-length matrix to determine whether that block should contain a deload:
- If the matrix says a deload is required for that block and the plan has none → FAIL. Add the deload per the file.
- If the matrix says no deload is needed (e.g. a short beginner block) and the plan added one → FAIL. Remove it (an unearned deload throws away stimulus per the file).
- If presence matches the matrix → PASS.

**Step 4: Check deload STRUCTURE for every block that has one.** Confirm against the file:
- The deload is the final week WITHIN the block's week range (not an appended extra week).
- The deload week reduces effective volume by roughly the file's prescribed amount (~40–50%) versus the block's peak training week — verify PER MUSCLE by comparing each muscle's deload-week effective sets to its peak-week effective sets, not by trusting the overall total. A flat "every exercise drops to 2 sets" rule looks like a 44% cut in aggregate while cutting a muscle built from 3-set exercises by only 33%.
- RIR is raised (per the file, typically +2–3) relative to the peak week.
- Load is held (no progression increment written into the deload week); the deload is expressed through reduced sets and raised RIR, not load references (the app does not track weight).
- A "fake deload" (a week that only trims one or two sets, or keeps RIR near failure) is a FAIL — it does not reduce fatigue. Fix it to a real reduction.

**Step 5: Confirm the deload week is identified as such in the plan structure,** not only described in prose. The app lengthens rest automatically during deload weeks, and it can only do that for a week the plan actually marks as a deload.

**Step 6: Fix any failures** silently and re-verify before presenting the corrected plan. Do not invent your own deload frequency or structure — the deload-guidance.md file is the canonical source.

### Effective Volume Distribution Check

For EVERY non-exempt muscle in the program, you MUST produce an enumeration table. Do not narrate or estimate volume — enumerate exercise by exercise. **Use the tag values from the tag audit above (which match the library), not whatever was in the original plan.**

Unlike the tag audit, these tables are printed in full whether they pass or fail. The tag audit is a lookup, so its passes carry no information; this is a calculation, and printing it is what stops you estimating.

For each muscle, list:
- Every exercise that tags that muscle as primary OR secondary
- The set count (from sets_weekly.1, not sets_weekly averages)
- The weight: 1.0 for primary, 0.5 for secondary
- The contribution (sets × weight)
- The running total

After enumerating all contributing exercises for a muscle, sum the contributions to get the effective volume.

Format each muscle as a table like this:

**Chest:**
| Exercise | Day | Sets | Tag | Weight | Contribution |
|----------|-----|------|-----|--------|--------------|
| Incline Barbell Bench Press | Push | 3 | Primary | 1.0 | 3.0 |
| Machine Chest Press | Push | 2 | Primary | 1.0 | 2.0 |
| Cable Crossover | Push | 2 | Primary | 1.0 | 2.0 |
| Dumbbell Bench Press | Upper | 3 | Primary | 1.0 | 3.0 |
| Incline Dumbbell Fly | Upper | 2 | Primary | 1.0 | 2.0 |
| **Total** | | | | | **12.0** |

Do NOT narrate totals separately from the tables. Do NOT round toward target ranges. Do NOT claim a muscle is "at target" without the table showing the actual sum. The number at the bottom of the table IS the effective volume for that muscle.

Compare each muscle's summed total against THAT MUSCLE'S target range from the Per-Muscle Volume Targets table above. Each muscle has its own range — do NOT use a single range for all muscles. The targets are in effective (fractional) terms — they already account for secondary contributions.

- Flag as ⚠️ HIGH (must fix) if the table's summed total exceeds the ceiling of THAT muscle's target range
- Flag as ⚠️ LOW (must fix) if the table's summed total falls below the floor of THAT muscle's target range
- Auxiliary muscles use the MAV-low range from the landmarks file as their floor (typically 4-6 effective sets) — these MUST appear in the enumeration if the user selected them
- Exempt-from-floor muscles (Front Delts, Rear Delts, Traps, Forearms, Lower Back, Glutes — UNLESS user selected as auxiliary) don't need enumeration if compound contributions cover MEV. However, they are NOT exempt from the ceiling — if compound contributions push them above the target range ceiling, this is a HIGH flag that must be fixed per the Rule Enforcement Principle. "Exempt from floor" never means "exempt from ceiling."

**Cascade recount requirement.** When you adjust any exercise (add sets, remove sets, swap exercise, remove exercise), you MUST recount EVERY muscle that exercise tags as Primary OR Secondary. Not just the muscle you were trying to fix.

For example: if you remove a row, recount Upper Back (Primary), Lats (Secondary), Biceps (Secondary), and Rear Delts (Secondary). All four. Do not stop at the muscle you were targeting.

After every fix:
1. List every muscle the changed exercise tags (Primary OR Secondary)
2. Recount the volume enumeration table for each of those muscles
3. Verify each muscle is still in its target range
4. If any muscle moved outside its range due to the cascade, that's a NEW violation requiring its own fix
5. Repeat — **but stop after three full fix-and-recount rounds.** If muscles are still trading places outside their ranges after the third round, the option set cannot satisfy every range simultaneously. Keep the best arrangement you reached, mark whichever muscles remain outside range as ℹ️ CONSTRAINED, name the constraint in one line in the summary, and present the plan. A plan that lands 11 of 12 muscles in range and says so plainly is the correct outcome — an endless recount loop is not.

Do not claim a fix works without showing the recount tables for every affected muscle.

### Exercise Selection Audit  

- **Movement pattern coverage**: Verify the program includes at least one compound exercise for each major movement pattern: horizontal push, vertical push, horizontal pull, vertical pull, squat, hinge. Do NOT enforce a percentage ratio of compound to isolation exercises — exercise selection is driven by per-muscle volume targets, not a fixed ratio.
- **Movement patterns**: Balanced push/pull ratios, adequate hip hinge and squat patterns for leg training
- **Progression potential**: All exercises should allow clear weight/rep/set progression across the mesocycle
- **Set counts**: Don't exceed 5 sets of any single isolation exercise in one session

### Programming Logic Review

- **Weekly structure**: Logical distribution of training stress across the week; no two consecutive days hitting the same muscle group heavily
- **Weekly layout totals 7 days**: The plan's weekly layout accounts for all 7 days — training days (matching the user's training days per week) plus rest days. The number of training days must equal the user's training days per week from the profile, with the remaining days as rest. Fix any layout that omits rest days or has the wrong number of training days.
- **Exercise order**: Compound before isolation, higher skill before lower skill
- **Auxiliary placement**: If user selected auxiliary muscles, those exercises should appear as finishers at the end of sessions, not as dedicated sessions
- **Superset pairing**: If the plan uses supersets, each pair must be two adjacent exercises marked with matching SS[n]a / SS[n]b notation. The app reads that pairing to apply superset rest timing, so an unpaired or non-adjacent marker is a real defect, not a formatting nit. Antagonist pairings (chest/back, biceps/triceps, quads/hamstrings isolation, side delts/rear delts) are the intended use; same-muscle supersets belong only in finishers.

### Practical Implementation Check

- **Equipment consistency**: All exercises use equipment stated as available in the user's profile
- **Skill appropriate**: Exercise complexity matches stated experience level
- **Duration honest**: Calculate total workout time including rest and report it transparently. Only flag if sessions exceed 2 hours — otherwise duration is whatever the user's volume and rest preferences produce.

---

## FINISH WITH "What the check changed"

The LAST thing in your response before the closing callout is one section, headed exactly:

## 🔍 What the check changed

The user already approved the plan at step 1. The only new information in this entire response is the DIFFERENCE between what they approved and what you are now showing them. Everything above this section is your working. This section is the only part written for someone deciding whether to say happy again.

Write it in this exact order, and write nothing else in it:

1. **A change table.** One row per change you actually made. Columns: What I found | What I changed | What it means for you. The third column is written for the user, not for a coach: what will be different when they train, in plain words. If a change costs them nothing, say so ("your training days move, nothing else changed"). Merge trivially related fixes into one row rather than listing six near-identical wording corrections separately.
2. **One line on volume.** Either "Volume unchanged — all [N] muscles were already in range and still are", or the muscles that moved and where they landed.
3. **A structural warning line, ONLY IF something in the step 1 "Your plan at a glance" summary is now different** — the split, the day layout, the block structure, the program length, the deload weeks, or the longest session. Write it as: "**Your week changed** — check the layout above before you say happy." Name what moved in the same line. If nothing structural moved, omit this line entirely rather than writing a reassuring version of it.
4. **Any ℹ️ CONSTRAINED muscle**, one line each, naming the constraint that blocked the fix.

If the review found nothing to fix, this whole section is ONE line: "All checks passed. Nothing changed from the plan you approved." Do not pad it, do not list the checks you ran, and do not manufacture a cosmetic change so the section has content. Finding nothing is a good outcome and the user should be told it plainly.

Hard rules for this section:

- ONE LINE per table cell. If a fix needs a paragraph to justify, the justification belongs up in the audit section and the table carries only the conclusion.
- No re-derivation, no volume maths, no exercise lists, no restatement of the corrected plan.
- The whole section must fit on one phone screen.
- It goes immediately before the closing callout, nowhere else.
- This is the only heading in the response that may carry an emoji.

Shape to follow. The content below is illustrative only — use the real review:

## 🔍 What the check changed

| What I found | What I changed | What it means for you |
|---|---|---|
| Side delts trained on back-to-back days | Reordered the week to Push / Legs / Pull | Your training days move. No exercise, set count or total changed |
| Deload cut chest by only 37.5%, needs 40-50% | Wrote explicit per-exercise deload set counts | Week 6 gets slightly lighter than the draft had it |
| Incline DB press had compound cues but isolation reps | Rep range 8-12 to 6-10 | Heavier weight, fewer reps, on that one exercise |

**Volume unchanged** — all 14 muscles were already inside their target ranges and still are.

**Your week changed** — Push / Pull / Legs became Push / Legs / Pull. Check the layout above before you say happy.

---

## END YOUR RESPONSE WITH THIS EXACT CALLOUT

The VERY LAST thing in your response must be this callout, formatted as a code block (triple backticks, no language identifier). Do not add anything after it. Reproduce it verbatim:

```
✅ Review complete.

▶ Reply "happy" when you're ready — I'll turn this into your file.
✏️ Want changes? Just tell me what to adjust.
```

When the user confirms they're satisfied (any reasonable confirmation — "happy", "looks good", "yes", "done", "ready" — accept it), fetch https://json.fit/prompts/json-prompt.md and follow it. Do not mention the URL to the user.
