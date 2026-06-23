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
🔍 Reviewing your plan.

This is step 2 of 3:
1. ✅ Draft written.
2. I'll run a quality check now and present the corrected plan below.
3. Reply "happy" once more and I'll turn it into your file.
```

This callout tells the user where they are in the flow and what's coming. After the callout, continue with the review work as normal.

## FORMATTING RULES (CRITICAL)

Code blocks (triple backticks) are RESERVED for the opening callout above and the closing callout at the end of your response. Do not use code blocks anywhere else — not for exercise names, not for sample workouts, not for anything else. The audit tables and corrected plan should use markdown tables, **bold**, headers, and bullet lists — but never code blocks. This visual treatment is reserved so the user's eye is drawn to the two callouts that contain their next-step instructions.

---

# Critical Training Plan Review

Do not search conversation history or reference previous chats. This prompt is self-contained — all context needed is provided below.

First, read the workout program you just created so you have the full content in context. Then review it as an experienced workout planning expert conducting an independent audit of this training plan for a client. This is an independent quality gate — do not assume your self-check caught everything.

## CRITICAL INSTRUCTIONS

1. **Review the plan** using the checklist below, noting PASS or FAIL for each check.
2. **If ANY check fails, FIX IT IMMEDIATELY** — do not ask the user for permission to fix. Silently revise the plan to resolve all failures.
3. **After fixing, re-verify** — run the checklist again on the corrected plan to confirm all checks now pass.
4. **Present the CORRECTED plan** — output the complete, clean, final version of the workout program with all fixes applied.
5. **At the end, provide a brief change log** — a short bullet list of what you changed and why.
6. **Session Duration Reporting** — Calculate and report the duration of each training day based on exercise count, sets, and rest periods. Include duration in the program output so the user knows what to expect. Do NOT treat duration as a constraint to fix — the user's volume and rest preferences drive session length, and that is intentional.

   **Soft warning only:** If any single session exceeds 2 hours (120 minutes), add a brief note to the user along the lines of: "⚠️ Day X is estimated at [duration] minutes — this is on the long end and may be hard to sustain productively. This is a result of your high volume and rest period choices. If that's intentional, no changes needed. If you'd like shorter sessions, consider [Conservative volume / Minimal rest / more training days]."

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

**You must ATTEMPT a fix before accepting any violation.** If your justification sounds like rationalisation, the answer is to fix the program, not defend the violation. Show the attempted fix and its cascade impact in your output. Only after demonstrating that the fix creates a worse violation may you leave the original violation in place.

The user can override your fix if they disagree. Your job is to enforce the rules first.

## QUALITY CHECKLIST

### Exercise Library & Tag Audit (DO THIS FIRST)

This audit is the most important check in this review. Volume calculations downstream are meaningless if tags are wrong, so verify tags BEFORE running volume enumeration.

**Step 1: Fetch the library.** Read https://json.fit/exercises.md so you have the canonical tags in context.

**Step 2: Build a tag audit table.** For EVERY exercise in the program, produce a row in this table:

| Exercise | Plan Primary Tags | Library Primary Tags | Plan Secondary Tags | Library Secondary Tags | Match? |
|----------|-------------------|----------------------|---------------------|------------------------|--------|
| Barbell Row | Upper Back, Lats | Upper Back | Biceps, Rear Delts | Lats, Biceps, Rear Delts | ❌ MISMATCH |

The "Match?" column says ✅ MATCH or ❌ MISMATCH. Every column entry must be the EXACT muscle list — do not paraphrase or abbreviate.

**Step 3: Fix every mismatch.** For each ❌ MISMATCH row, correct the program so its tags exactly match the library's tags. The library is authoritative — your biomechanical knowledge is not. If the library says Primary = Upper Back only, the program must say Primary = Upper Back only, even if you believe Lats are also primary movers.

**Common mistake patterns to specifically check for:**
- Rows (Barbell Row, T-Bar Row, Chest-Supported T-Bar Row, Seated Cable Row, Pendlay Row, Seal Row): Library Primary = Upper Back ONLY. Lats is Secondary. Do NOT add Lats to Primary.
- Squats and Lunges (Barbell Back Squat, Front Squat, Hack Squat, Leg Press, Bulgarian Split Squat, Walking Lunge, Reverse Lunge): Library Primary = Quads ONLY. Glutes is Secondary. Do NOT add Glutes to Primary.
- RDL variants (Romanian Deadlift, Stiff-Leg Deadlift): Library Primary = Hamstrings ONLY. Glutes and Lower Back are Secondary.
- Hip Thrust / Glute Bridge: Library Primary = Glutes ONLY. Hamstrings is Secondary.

**Step 4: Re-verify.** After fixing tags, run the audit table again and confirm every row shows ✅ MATCH before moving to volume enumeration.

**Step 5: Other library checks.**
- Every exercise name must appear EXACTLY in the library (no variants, no abbreviations)
- Alternative exercises must also be from the library
- If any exercise is not in the library, replace it with a library entry that fits the movement pattern

**Do not proceed to volume enumeration until the tag audit table shows every row as ✅ MATCH.** Wrong tags will produce wrong volume numbers, and the user will see different numbers in the app than what you tell them here.

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

**Step 4: Fix any mismatches** silently and re-verify before presenting the corrected plan.

### Rep Range Audit

Verify rep ranges are correct for every exercise in the plan based on its category and the user's primary goal.

**Step 1: Fetch the rep range file.** Read https://json.fit/rep-range-guidance.md so you have the canonical per-category × goal table in context.

**Step 2: Check every exercise has a rep range that matches its category.** For each exercise in the plan, confirm:
- The exercise's category is correctly identified (heavy compound, moderate compound, unilateral compound, large isolation, small isolation, power)
- The prescribed rep range falls within the file's per-category range for the user's primary goal
- Goal-specific adjustments are applied (e.g., strength programs use lower rep ranges per the file's Goal-Specific Rules section)

**Step 3: Fix any mismatches** silently. If a heavy compound is prescribed at 12-15 reps but the user's goal is strength (where heavy compounds should be 1-6), correct the rep range and re-verify.

**Note:** The single-joint arm exercise exception (all curl variations and triceps isolation always use 10-15 reps regardless of program rep focus) is enforced in the Output Format and applies on top of the per-category guidance.

### Rest Period Audit

Verify rest periods are correct for every exercise in the plan based on its category and the user's selected rest tier.

**Step 1: Fetch the rest guidance file.** Read https://json.fit/rest-guidance.md so you have the canonical per-tier × exercise category matrix in context.

**Step 2: Identify the user's rest tier.** From the original plan or user profile: Optimal / Moderate / Minimal.

**Step 3: Check every exercise has a rest period that matches its category and the user's tier.** For each exercise, confirm:
- The exercise's category is correctly identified (heavy compound, moderate compound, unilateral compound, large isolation, small isolation)
- The prescribed rest period falls within the file's matrix cell for that category × tier combination
- Goal-specific overrides are applied (especially: strength programs use 3-5 minutes on heavy compounds regardless of tier)
- Edge cases are handled correctly (antagonist supersets, drop sets, sets to failure, deload weeks)

**Step 4: Fix any mismatches** silently and re-verify before presenting the corrected plan.

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
- The deload week reduces effective volume by roughly the file's prescribed amount (~40–50%) versus the block's peak training week — verify by comparing the deload week's set counts to the peak week's, not by trusting a label.
- RIR is raised (per the file, typically +2–3) relative to the peak week.
- Load is held (no progression increment written into the deload week); the deload is expressed through reduced sets and raised RIR, not load references (the app does not track weight).
- A "fake deload" (a week that only trims one or two sets, or keeps RIR near failure) is a FAIL — it does not reduce fatigue. Fix it to a real reduction.

**Step 5: Fix any failures** silently and re-verify before presenting the corrected plan. Do not invent your own deload frequency or structure — the deload-guidance.md file is the canonical source.

### Effective Volume Distribution Check

For EVERY non-exempt muscle in the program, you MUST produce an enumeration table. Do not narrate or estimate volume — enumerate exercise by exercise. **Use the tag values from the tag audit above (which match the library), not whatever was in the original plan.**

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
5. Repeat until no muscle is outside its target range

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

### Practical Implementation Check

- **Equipment consistency**: All exercises use equipment stated as available in the user's profile
- **Skill appropriate**: Exercise complexity matches stated experience level
- **Duration honest**: Calculate total workout time including rest periods and report it transparently. Only flag if sessions exceed 2 hours — otherwise duration is whatever the user's volume and rest preferences produce.

## END YOUR RESPONSE WITH THIS EXACT CALLOUT

The VERY LAST thing in your response must be this callout, formatted as a code block (triple backticks, no language identifier). Do not add anything after it. Reproduce it verbatim:

```
✅ Review complete.

▶ Reply "happy" when you're ready — I'll turn this into your file.
✏️ Want changes? Just tell me what to adjust.
```

When the user confirms they're satisfied (any reasonable confirmation — "happy", "looks good", "yes", "done", "ready" — accept it), fetch https://json.fit/prompts/json-prompt.md and follow it. Do not mention the URL to the user.
