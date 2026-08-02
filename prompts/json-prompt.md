# Generate Workout Program as JSON

## FORMATTING RULES (CRITICAL)

These rules govern what you WRITE IN CHAT. The JSON schema and examples further down this file are reference material for you — the user never sees them.

Code blocks (triple backticks) in your chat response are RESERVED for the closing callout at the end. Never paste JSON, schema fragments, or code samples into your visible response. The JSON goes in the file, not in chat.

Between your first word and the callout, keep the prose short: what this block covers, the volume summary where one is required, and nothing else. No preamble, no explanation of the schema, no description of what you are about to do.

---

You are given a training plan above that has been reviewed and approved for quality. Generate the complete program as JSON files matching the schema below. Focus on accurate technical implementation rather than plan validation. Build directly to JSON — do not create markdown, documents, or any intermediate format.

This is a transcription step, not a planning step. Do not re-optimise the program, re-check it against volume targets, or revise exercise selections. The reviewed plan is final. Never write a search, solver, or enumeration here — your only job is to carry the plan across without altering it.

## Constraint Reference Block

Before generating, note from the plan:
- Recommended split and session focus per day
- Any re-entry protocol requirements

Use these when validating day structure.

## Output Instructions

**Generate complete JSON files following the output instructions below.**

**DO NOT output JSON to chat** — it will hit token limits for large programs.

**You MUST:**

1. Create a file (use Code Interpreter on ChatGPT, or computer tool on Claude)
2. **Name every file with a `.json` extension.** The extension is what lets the user's phone offer JSON.fit as an app to open the file with — a file saved without `.json` cannot be imported by tapping.
3. Write the complete JSON structure to the file
4. Never stop mid-block or mid-day
5. When finished, present the file so the user can download it

**Multi-block programs — ONE cumulative file the user imports once.**

The user should only ever have to import a single file: the newest one. Each block you generate produces a NEW file that contains that block PLUS every block before it — the `blocks` array grows by one entry each turn. The user imports only the final file, and it holds the whole program.

Generate one block at a time (this keeps each response within output limits), but each file is cumulative:

- **Block 1:** write a file whose `blocks` array holds block 1. Name it `workout-program-part-1.json`.
- **Block 2 (on "next"):** write a NEW file whose `blocks` array holds blocks 1 AND 2. Name it `workout-program-part-2.json`.
- **Block 3 (on "next"):** a new file holding blocks 1, 2 AND 3. `workout-program-part-3.json`.
- ...and so on. The final part file contains every block.

Naming rule: `workout-program-part-[N].json`, where N is the number of blocks the file contains. The highest-numbered file is always the complete program. Do not use per-block names like `block-2.json` that suggest a single block — the file is cumulative, and the name should reflect that it is the program "up to and including part N".

After each block:

1. Present the cumulative file for that turn.
2. Output a brief **volume summary** for the block you just added (total primary-tagged sets per muscle group, training weeks not deload). This gives the user something to check against for the new block.
3. End with **CALLOUT A** if more blocks remain, or **CALLOUT B** if this was the final block.
4. **STOP and wait for user input.** Do not proceed to the next block until the user responds.

**When user says "next":**

1. Generate the next block, and write a new cumulative file containing all blocks so far (prior blocks copied across verbatim from what you already generated — do not regenerate or alter them).
2. Present it, output the volume summary for the new block, and end with the correct callout.
3. **STOP and wait for user input.**

**If a cumulative file would be too large to write in one response** (long programs, typically 4+ blocks): STOP at the end of a complete block, tell the user in one line "this part was large — say **continue** and I'll finish writing the file", and complete the same file on the next turn. Never present a file that is cut off mid-structure.

**When user says "review":**

1. Read the workout program document from earlier in the conversation.
2. Apply the embedded review checklist below to the most recent block.
3. Write a corrected cumulative file (all blocks, with the fixes applied) and present it.
4. End with **CALLOUT A**.

### Embedded Review Checklist

Re-read the workout plan document from earlier in the conversation. Compare your JSON output against the plan and fix any discrepancies in exercise names, set counts, muscle tags, superset pairings, or day structure.

Each cumulative file has one routine_name, one description, one days_per_week, and a `blocks` array holding every block generated so far in order. Keep routine_name and description identical across all the part files — they are the same program at different stages of completion.

**Long programs (5+ blocks):** Continue generating blocks in this same conversation. Do not suggest starting a fresh chat.

**Mesocycle-based programs:** If the plan states this is Mesocycle [X] of [N], after generating and delivering the FINAL block of this mesocycle:

If X < N:

1. Output a Mesocycle [X] Summary:
   - Phase name and training emphasis
   - Split structure used
   - Rep range focus
   - Volume per muscle group (sets/week from your volume summaries)
   - Key exercises used across all blocks
2. Add one line in your prose, before the callout: "When you're ready for Mesocycle [X+1], just ask — I'll use the roadmap and summary above."
3. Then end with **CALLOUT B**. The user has files in hand and is done for now, so they get the import steps.

If X equals N, add one line in your prose noting the program is complete, then end with **CALLOUT B**.

The plan is fully self-contained: it lists all exercise pools, block structures, and periodization details. You do not need conversation history from prior blocks to generate any block correctly. Always reference the plan — never rely on memory of prior blocks in the conversation.

---

## Translation Principles

1. **The plan is authoritative for structure; the exercise library is authoritative for tags** — use the exercise names, sets, superset pairings, and day structure exactly as specified from the plan. However, before finalizing any JSON, verify every exercise's primaryMuscles and secondaryMuscles tags against the canonical exercise library at https://json.fit/exercises.md. If the plan's tags differ from the library, use the library's tags (the library is authoritative). Do not add, remove, or rename exercises. If the plan declares a mesocycle structure, append the mesocycle name to routine_name in every JSON file. The reviewed plan's set counts are final — do not adjust them based on your own volume recalculation.
2. **Treat exercise names as identifiers** — use the exact same string for the same exercise across all blocks, days, notes, and superset references. Never vary naming.
3. **Design what the plan doesn't specify** — you are responsible for alternative exercises and technique notes. For rep progressions: follow the plan's scheme if stated, otherwise use the defaults below. You are NOT responsible for rest periods — see the Rest Periods section.
4. **Only program working sets** — do not include warm-up sets.

---

## Exercise Programming Details

### Rep Progressions

For each exercise, design a weekly rep progression across the block. Since the app doesn't track weight, progressions are expressed entirely through rep targets — the user manages their own load increases.

**Starting point rule:**
Start at the TOP of the prescribed range in Week 1, reduce across the block. The rep ceiling is Week 1; the floor is the final training week before deload. This signals increasing load week over week.

**Linear progression (default for all exercises):**
Maintain rep targets in early weeks. Slight rep reduction in later weeks signals that the lifter should be using heavier loads.
Example (5-week block, 4 sets): Week 1: "10, 10, 10, 8" → Week 2: "10, 10, 8, 8" → Week 3: "8, 8, 8, 8" → Week 4: "8, 8, 6, 6" → Week 5 (deload): "12, 12"

`reps_weekly` values must be comma-separated rep targets per set (e.g., "10, 10, 10, 8"), not shorthand like "4x10".

**rir_weekly field — REQUIRED whenever the exercise has reps_weekly populated.**

If an exercise prescribes weekly reps, it must also prescribe weekly RIR. This applies to all resistance training exercises (compound lifts, machines, isolation work). It does NOT apply to cardio, flexibility, or mobility work — those don't have RIR.

Structure: identical to reps_weekly. An object with week numbers as keys ("1", "2", "3", "4") and a comma-separated string of per-set RIR values for each week.

Translation rules:

1. The number of comma-separated values per week must match the exercise's set count for that week (matches reps_weekly)
2. Source the values from the exercise's notes field, which contains the RIR progression (e.g., "RIR 3 W1 → 2 W2 → 1 W3 → 0-1 W4")
3. The week-level target from the notes is the middle-set value. Apply within-exercise progression:
   - Set 1: target + 1 (one rep further from failure)
   - Middle sets: target
   - Last set: target - 1 (one rep closer to failure, never below 0)
4. Values can be single integers ("3", "2", "1", "0") or ranges ("0-1", "1-2")
5. If the plan notes specify exact per-set values (e.g., "Set 1: 3 RIR. Set 2: 2 RIR. Set 3: 1 RIR."), use those exact values rather than re-deriving

Example: for an exercise with 3 sets per week and notes "RIR 3 W1 → 2 W2 → 1 W3 → 0-1 W4", rir_weekly is an object mapping week "1" to "4, 3, 2", week "2" to "3, 2, 1", week "3" to "2, 1, 0", and week "4" to "1-2, 0-1, 0".

Floor: never go below RIR 0. If within-exercise math produces a negative value, clamp to 0.

Do not regenerate RIR guidance from scratch — translate from the plan notes that already include the RIR progression.

**reps_weekly and rir_weekly are load-bearing beyond rep display.** The app derives each exercise's rest period from them: first-set reps plus first-set RIR give an estimated RM, and that decides whether a compound is treated as a heavy set or a moderate one. A missing or malformed rir_weekly does not just lose the RIR display, it makes the app guess at the load. Populate both accurately for every resistance exercise.

**Match progressions to the plan's rep range focus.** If the plan says "Block B: Strength — 5-8 reps," your compound progressions should work within that range. Isolation exercises can run 2-4 reps higher than the block's stated range (e.g., 8-12 isolation reps in a "5-8" strength block is fine).

### Rest Periods

**Do not design rest periods. The app calculates them.**

JSON.fit resolves rest at runtime from the exercise's category, how heavily it is loaded in the current block (read from `reps_weekly` and `rir_weekly`), whether the week is a deload, and whether the exercise is part of a superset. It resolves all three rest tiers for every exercise, and the user chooses between them — including mid-workout. Nothing you write into the file is used for timing.

Set the `rest` field to a plain integer number of seconds anyway. It is a compatibility fallback for users on app versions that predate runtime resolution, and it is ignored by current versions. A sensible category default is enough — 180 for free-weight compounds, 120 for machine compounds and large-muscle isolation, 90 for small-muscle isolation. Do not spend effort tuning it, do not derive a second reduced value from it, and do not give superset members a special value.

**One thing you DO carry across: which pace the user starts on.**

The app resolves all three tiers, but it has to pick one as the selected pace when the program is imported. That choice comes from the plan, in the root `default_pace` field.

The plan states its rest summary in one named pace. Read the pace from the plan and write it to `default_pace` at the root of the JSON, **lowercase**.

**Where to read it from, in this order:**

1. **Preferred.** The plan contains a line reading `Default rest pace: optimal` (or `moderate`, or `minimal`). Copy that value verbatim. It is already in the correct casing and needs no translation.
2. **Fallback, for older plans that have no such line.** The rest summary names the pace in a line shaped like `Rest (OPTIMAL pace): around ...`. Translate it:

| Pace named in the plan | `default_pace` value |
|---|---|
| OPTIMAL / Optimal / Full | `"optimal"` |
| MODERATE / Moderate / Balanced | `"moderate"` |
| MINIMAL / Minimal / Quick | `"minimal"` |

Rules:

- Lowercase only. `"OPTIMAL"` is not a valid value and the app will ignore it, silently leaving the user on the middle pace.
- Emit `default_pace` once, at the root, alongside `routine_name`. Never on a block, a day, or an exercise.
- If the plan's rest summary does not name a pace at all, write `"moderate"`. Do not guess a pace from the program's goal, its rep ranges, or the rest numbers quoted in the summary.
- This sets the starting pace only. The user can change it in the app at any time, and the app will not override a pace they have already chosen for themselves.

### Alternative Exercises

Each exercise must include 2 alternatives (1 for bodyweight-only programs). Alternatives should target the same primary muscles, use different equipment or movement variations, and include their own primaryMuscles and secondaryMuscles tags.

### Notes

Only include non-obvious technique tips or specific setup instructions. Do not add notes for standard exercises performed in standard ways. If the plan includes notes for an exercise, carry them through.

### Supersets

Place superset exercises adjacent in the exercises array. Include "Superset with [exact exercise name]" in both exercises' notes field. Add "superset_group": "ss1" (or "ss2", "ss3" etc.) to both exercises in the pair — use the same string value for both. The plan marks supersets with SS[n]a/SS[n]b notation — translate these to adjacent array entries with matching superset_group values.

`superset_group` is what tells the app to apply superset rest timing, so getting the pairing and the matching group string right matters more than it used to. Adjacency plus a matching group value is the whole contract.

---

## Muscle Taxonomy

Before generating JSON, read the canonical exercise library at https://json.fit/exercises.md to get authoritative muscle tags. Every exercise in your JSON must use primaryMuscles and secondaryMuscles tags that exactly match what's in that library. Do not use generic terms like "Shoulders", "Back", "Arms", or "Legs". If an exercise is not found in the library, do not include it in the JSON — flag it as an error requiring replacement.

Exercise names must also match the library exactly. The app looks up each exercise by name to determine its rest category, so a renamed or invented exercise falls back to a generic default rest instead of the right one.

---

## JSON Schema

```
{
  "routine_name": "string",
  "description": "string",
  "days_per_week": 7,
  "default_pace": "optimal | moderate | minimal (lowercase — the rest pace named in the plan's rest summary)",
  "blocks": [
    {
      "block_name": "string",
      "weeks": "string (e.g. '1-6')",
      "structure": "string (e.g. 'Push Pull Legs Upper Lower')",
      "weekly_schedule": [
        {
          "day_number": "number",
          "type": "training | rest",
          "day_name": "string (e.g. 'Push', 'Pull', 'REST DAY')"
        }
      ],
      "deload_weeks": "[number] (optional — include only if block has deloads)",
      "days": [
        {
          "day_name": "string",
          "estimated_duration": "number (minutes)",
          "exercises": "[Exercise]"
        },
        {
          "day_name": "REST DAY",
          "estimated_duration": 0,
          "exercises": []
        }
      ]
    }
  ],
  "_metadata": {
    "isSamplePlan": "true (for sample plans only — prevents contaminating user exercise preferences)"
  }
}
```

**For sample plan generation only:** Include `"_metadata": {"isSamplePlan": true}` at the root level to prevent the plan from overwriting users' saved exercise preferences when imported.

### Strength Exercise

```
{
  "type": "strength",
  "exercise": "string",
  "sets": "number",
  "reps": "string",
  "rest": "number (seconds — compatibility fallback only; current app versions ignore it and resolve rest at runtime)",
  "primaryMuscles": ["from taxonomy"],
  "secondaryMuscles": ["from taxonomy, or empty array"],
  "superset_group": "string (optional — e.g. 'ss1'; same value on two exercises links them as a superset)",
  "reps_weekly": { "1": "string", "2": "string" },
  "rir_weekly": { "1": "string", "2": "string" },
  "sets_weekly": { "1": "number", "2": "number" },
  "notes": "string (form cues, RIR guidance, or other coaching notes — multiple notes allowed)",
  "alternatives": [
    { "exercise": "string", "primaryMuscles": ["..."], "secondaryMuscles": ["..."] }
  ]
}
```

---

## Schema Rules

1. **Block-relative keys** — weekly progression keys always start from "1" within each block. Block B (weeks 7-12) uses "1", "2", "3"... not "7", "8", "9".
2. **Deload tagging** — if a block has deload weeks, include a `deload_weeks` array with the block-relative week numbers (e.g., [5] for a 5-week block with deload on week 5). The app also reads this to lengthen rest during deload weeks, so an omitted deload_weeks costs more than a missing label.
3. **Empty arrays** — if an exercise has no secondary muscles, use `[]`. Do not omit the field.
4. **Estimated duration** — ALWAYS recalculate using this duration formula instead of trusting plan estimates: `Straight sets: (sets × 45s) + (sets × rest_seconds) | Superset pairs: (pairs × 90s) + (pairs × rest_seconds) + (pairs × 150s) | Total: exercise_count × 150s + 300s warmup`. Use the same category defaults given under Rest Periods for `rest_seconds`. This figure is an estimate shown before import; the app recomputes it live from the user's actual rest pace, so do not agonise over it. Duration has been pre-approved in the review stage.
5. **sets vs sets_weekly** — `sets` is the default set count for training weeks (used for display). `sets_weekly` must be specified for every week in the block: training weeks should match `sets`, and deload weeks should show reduced values. Both fields are required for every strength exercise.
6. **deload_weeks optionality** — omit `deload_weeks` entirely for blocks without deloads. Do not include an empty array.
7. **weekly_schedule** — create a 7-day schedule showing training and rest days. For each day 1-7, specify: day_number, type ("training" or "rest"), and day_name (e.g., "Push", "Pull", "REST DAY"). Training days must match the day_name values in the days array. Example for 5-day program: Day 1 training "Push", Day 2 training "Pull", Day 3 rest "REST DAY", Days 4 and 5 training, Day 6 rest, Day 7 training.
8. **Sample plan protection** — for sample plans only, include `"_metadata": {"isSamplePlan": true}` at the root level to prevent overwriting users' exercise preferences during import.
9. **RIR** — carry RIR guidance from the approved plan into each exercise's notes field. Do not regenerate or modify RIR values — the plan is authoritative.
10. **default_pace** — include `default_pace` at the root, lowercase, as one of `"optimal"`, `"moderate"` or `"minimal"`, read from the pace named in the plan's rest summary (see Rest Periods). Fall back to `"moderate"` only when the plan names no pace. This is the one rest-related value you carry from the plan into the file.

---

## Pre-Delivery Self-Check

Before presenting each block, silently verify:

- [ ] Every exercise from the plan appears in JSON with correct set counts
- [ ] Exercise names are identical everywhere (across days, notes, superset references) AND match the canonical library exactly
- [ ] Superset exercises are adjacent with matching superset_group values and cross-referenced in notes
- [ ] Rep progressions trend flat-to-decreasing across weeks (not identical every week)
- [ ] RIR guidance from the plan carried through to every exercise's notes
- [ ] rir_weekly field populated for every exercise that has reps_weekly (matching structure and set counts)
- [ ] Deload weeks show reduced sets_weekly (~40-50%) and increased reps, and the block carries a `deload_weeks` array
- [ ] Every exercise's muscle tags verified against canonical library at https://json.fit/exercises.md (library tags override plan tags)
- [ ] Block-relative week keys start from "1"
- [ ] `default_pace` is present at the root, lowercase, and matches the pace named in the plan's rest summary
- [ ] Session durations are recalculated using the duration formula
- [ ] The filename ends in `.json`; for multi-block programs it follows `workout-program-part-[N].json` where N is the number of blocks in the file, and the `blocks` array actually contains all N blocks (every prior block copied across unchanged, newest block added)

Fix any issues before presenting.

---

## IF THE USER SAYS THEY CAN'T IMPORT (reference only)

This section is for LATER messages, after you have already delivered a file and its callout. Do not volunteer any of it in your conversion response.

If the user comes back saying the import isn't working:

- The working route is: tap the file, tap the ••• button, tap Share or Download, then choose JSON.fit from the list of apps. The wording on step 3 differs by AI app (Claude on iOS says Download, ChatGPT says Share) and may differ again on Android, so describe the action rather than insisting on a label.
- If JSON.fit doesn't appear in that list, the likely causes are that the file was saved without a `.json` extension, or their installed app version predates file support. Two fallbacks both work: download the file, then open JSON.fit and use its Import screen to pick it; or copy the file contents and paste them into that same Import screen.
- Multi-block programs are delivered as cumulative files (part 1, part 2, ...), each containing all blocks up to that point. The user only needs the highest-numbered file — it holds the whole program. If they've been importing along the way, the newest file supersedes the earlier ones; re-importing the final part gives them everything.
- If the import screen reports a format error, ask them to paste the exact error text. Do not guess at the cause.
- Do not invent other routes. There is no import link, no QR code, and no share URL for an AI-generated program. The website's share links only exist for programs already saved in someone's app.
- If they ask for changes to the program instead, make the change and hand back a fresh file.

---

## END YOUR RESPONSE WITH ONE OF THESE EXACT CALLOUTS

Every response you make in this stage ends with a callout, formatted as a code block (triple backticks, no language identifier). It comes AFTER the file. Do not add anything after it. Choose the correct one:

### CALLOUT A — use when more blocks are still to come

Reproduce verbatim, substituting the real block numbers for [X] and [Y]:

```
📦 Part [X] of [Y] built — your program so far is in the file above.

▶ Say "next" and I'll add the following block.
🔍 Or say "review" to check this part first.
```

Do not give import instructions here. The user waits until the whole program is built and imports the final file only. Telling them to import now would just be replaced by the next, more complete file.

### CALLOUT B — use after the final block

If you know the user's first name, put it on its own line as the FIRST line inside the code block, followed by a colon (e.g. `Ryan:`). If you do not know it, omit that line entirely and start the block at the checkmark. Never write a placeholder, a bracket, or a guessed name. That first-name line is the ONLY part you may change — every line from the checkmark down is reproduced verbatim.

```
Ryan:

✅ That's your whole program — it's all in this last file.

1. Tap the file above.
2. Tap the ••• button.
3. Tap Share or Download.
4. Choose JSON.fit from the list of apps.

No JSON.fit in the list? Download or copy the file, then import it in the app.
```

(The `Ryan:` line is an EXAMPLE — replace it with the actual user's first name, or drop the line if you don't know it.)

The file this callout refers to is the final, highest-numbered part file — the one that contains every block. Do not tell the user to import the earlier part files; this one supersedes them all. For a single-block program there is just one file, and CALLOUT B is the only callout you use.
