# Generate Workout Program as JSON

You are given a training plan above that has been reviewed and approved for quality. Generate the complete program as JSON files matching the schema below. Focus on accurate technical implementation rather than plan validation. Build directly to JSON — do not create markdown, documents, or any intermediate format.

## Constraint Reference Block

Before generating, note from the plan:
- Recommended split and session focus per day
- The mesocycle roadmap (which blocks belong to which mesocycle, and each block's absolute week range)
- Any re-entry protocol requirements

Use these when applying rest style parameters, labelling blocks, and validating day structure.

## Output Instructions

**Generate complete JSON files following the output instructions below.**

**DO NOT output JSON to chat** — it will hit token limits for large programs.

**You MUST:**
1. Create a file (use Code Interpreter on ChatGPT, or computer tool on Claude)
2. Write the complete JSON structure to the file
3. If you reach output limits, STOP at the end of a complete block, then continue appending to the same file
4. Never stop mid-block or mid-day
5. When finished, provide the download link

**Multi-block programs:**
Generate one block at a time. After each block:
1. Provide the download link for that block's standalone JSON file.
2. **Update the cumulative program file** (`<routine_slug>_full.json`, where `<routine_slug>` is a filesystem-safe slug of `routine_name` — stable for the whole program). It has the same root fields (`routine_name`, `description`, `days_per_week`) and a `blocks` array holding **every block generated so far**, in order. Build it by **ASSEMBLY, not regeneration** — place the already-generated block objects into the array; do not re-derive exercises, sets, or progressions. On a new block, append it. On a corrected block (see "review" below), replace the matching block by `block_name`/position, leaving the others untouched. Write to file; **never print the combined JSON to chat** (it will exceed token limits). Present this as the **PRIMARY download**: "Import this file to load the whole program so far — it's the one to use. The per-block files are optional; each imports as a separate routine."
3. Output a brief **volume summary** showing total primary-tagged sets per muscle group for that block (training weeks, not deload). This gives the reviewer something to check against.
4. Say: "Mesocycle M, Block B complete (overall block N of T). Say 'review' to validate this block before continuing, or 'next' to generate the next block directly." Read M, B, N, and T from the plan's mesocycle roadmap.
5. **STOP and wait for user input.** Do not proceed to the next block until the user responds.

**When the user says "next" for subsequent blocks:**
1. Generate the next block directly as JSON format (do not create a text version first).
2. Apply the same JSON schema and structure established above.
3. Write the JSON to its own standalone file and provide the download link.
4. Append the new block to the cumulative `<routine_slug>_full.json` (assembly only — do not regenerate prior blocks) and provide its link as the primary download.
5. Output the volume summary for the new block.
6. Say: "Mesocycle M, Block B complete (overall block N of T). Say 'review' to validate this block before continuing, or 'next' to generate the next block directly."
7. **STOP and wait for user input.** Do not proceed to the next block until the user responds.

**When the user says "review" for any block:**
1. Read the workout program document from earlier in the conversation.
2. Apply the embedded review checklist below to the specified block.
3. Generate the corrected JSON version with all fixes applied.
4. Write the corrected JSON to that block's standalone file and provide the download link.
5. Replace that block in the cumulative `<routine_slug>_full.json` with the corrected version (assembly only — leave the other blocks untouched) and provide its link.
6. Say: "Mesocycle M, Block B reviewed and updated. Say 'next' to continue to the next block."

### Embedded Review Checklist

Re-read the workout plan document from earlier in the conversation. Compare your JSON output against the plan and fix any discrepancies in exercise names, set counts, muscle tags, superset pairings, or day structure.

Each block should be a complete, standalone JSON file with routine_name, description, days_per_week, and a single block in the blocks array. Keep routine_name and description consistent across all files (the standalone files and the cumulative file all share the same base routine_name).

**Long programs (5+ blocks):** Continue generating blocks in this same conversation. Do not suggest starting a fresh chat.

**Mesocycle-based programs:** If the plan states this is Mesocycle [X] of [N], after generating and delivering the FINAL block of this mesocycle:

If X < N:
1. Output a Mesocycle [X] Summary:
   - Phase name and training emphasis
   - Split structure used
   - Rep range focus
   - Volume per muscle group (sets/week from your volume summaries)
   - Key exercises used across all blocks
2. Then say: "Mesocycle [X] complete. When you're ready to continue, just ask me to generate Mesocycle [X+1] — I'll use the roadmap and summary above to design the next phase in this same conversation."

If X equals N, say: "That completes your full program — all [N] mesocycles are done. Enjoy your training!"

The plan is fully self-contained: it lists all exercise pools, block structures, and periodization details. You do not need conversation history from prior blocks to generate any block correctly. Always reference the plan — never rely on memory of prior blocks in the conversation.

---

## Translation Principles

1. **The plan is authoritative for structure; the exercise library is authoritative for tags** — use the exercise names, sets, superset pairings, and day structure exactly as specified from the plan. However, before finalizing any JSON, verify every exercise's primaryMuscles and secondaryMuscles tags against the canonical exercise library at https://json.fit/exercises.md. If the plan's tags differ from the library, use the library's tags (the library is authoritative). Do not add, remove, or rename exercises. **Keep `routine_name` stable across all blocks and files as the base program name — do NOT append a mesocycle suffix to it.** Mesocycle and block identity live in each block's `block_name`: set `block_name` to "Mesocycle M · Block B — <Phase> (Weeks X–Y)", where Weeks is the absolute program range (e.g. "Mesocycle 2 · Block 1 — Strength-Hypertrophy (Weeks 13–18)"). The reviewed plan's set counts are final — do not adjust them based on your own volume recalculation.
2. **Treat exercise names as identifiers** — use the exact same string for the same exercise across all blocks, days, and superset references. Never vary naming.
3. **Design what the plan doesn't specify** — you are responsible for rest periods and alternative exercises. For rep progressions: follow the plan's scheme if stated, otherwise use the defaults below.
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
2. Source the values from the RIR progression specified in the plan (e.g., "RIR 3 W1 → 2 W2 → 1 W3 → 0-1 W4")
3. The week-level target from the plan is the middle-set value. Apply within-exercise progression:
   - Set 1: target + 1 (one rep further from failure)
   - Middle sets: target
   - Last set: target - 1 (one rep closer to failure, never below 0)
4. Values can be single integers ("3", "2", "1", "0") or ranges ("0-1", "1-2")
5. If the plan specifies exact per-set values (e.g., "Set 1: 3 RIR. Set 2: 2 RIR. Set 3: 1 RIR."), use those exact values rather than re-deriving

Example: For an exercise with 3 sets per week and a plan RIR progression of "RIR 3 W1 → 2 W2 → 1 W3 → 0-1 W4":

```
"rir_weekly": {
  "1": "4, 3, 2",
  "2": "3, 2, 1",
  "3": "2, 1, 0",
  "4": "1-2, 0-1, 0"
}
```

Floor: never go below RIR 0. If within-exercise math produces a negative value, clamp to 0.

Do not regenerate RIR guidance from scratch — translate from the plan's RIR progression directly into rir_weekly.

**Match progressions to the plan's rep range focus.** If the plan says "Block B: Strength — 5-8 reps," your compound progressions should work within that range. Isolation exercises can run 2-4 reps higher than the block's stated range (e.g., 8-12 isolation reps in a "5-8" strength block is fine).

### Rest Periods

Use rest periods from the plan if specified, otherwise apply evidence-based defaults appropriate for exercise type and training goal. Calculate restQuick as approximately 65% of the main rest period.

**Superset rest encoding:** For superset pairs, the first exercise (SS[n]a) gets a brief transition rest to move to the second exercise. The second exercise (SS[n]b) gets the full rest appropriate to the exercise type before repeating the pair.

### Alternative Exercises

Each exercise must include 2 alternatives (1 for bodyweight-only programs). Alternatives should target the same primary muscles, use different equipment or movement variations, and include their own primaryMuscles and secondaryMuscles tags.

### Notes

The `notes` field is reserved for the user to fill in during training. Leave it empty (`""`) for every exercise.

### Supersets

Place superset exercises adjacent in the exercises array. Add "superset_group": "ss1" (or "ss2", "ss3" etc.) to both exercises in the pair — use the same string value for both. The plan marks supersets with SS[n]a/SS[n]b notation — translate these to adjacent array entries with matching superset_group values.

---

## Muscle Taxonomy

Before generating JSON, read the canonical exercise library at https://json.fit/exercises.md to get authoritative muscle tags. Every exercise in your JSON must use primaryMuscles and secondaryMuscles tags that exactly match what's in that library. Do not use generic terms like "Shoulders", "Back", "Arms", or "Legs". If an exercise is not found in the library, do not include it in the JSON — flag it as an error requiring replacement.

---

## JSON Schema

```json
{
  "routine_name": "string",
  "description": "string",
  "days_per_week": 4,
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

> **Note on `days_per_week` in the example above:** the value `4` is illustrative — it is the number of TRAINING days for an upper/lower program. Set it to the actual training-day count for the program you are generating (see Schema Rule #1). It is NOT always 7.

> **Note on `block_name`:** for mesocycle-based programs, set `block_name` to "Mesocycle M · Block B — <Phase> (Weeks X–Y)" using the plan's mesocycle roadmap (see Translation Principle #1). For short single-mesocycle programs (4/8 week) a plain block name is fine.

**For sample plan generation only:** Include `"_metadata": {"isSamplePlan": true}` at the root level to prevent the plan from overwriting users' saved exercise preferences when imported.

### Strength Exercise

```json
{
  "type": "strength",
  "exercise": "string",
  "sets": "number",
  "reps": "string",
  "rest": "number (seconds)",
  "restQuick": "number (seconds — ~65% of rest, rounded)",
  "primaryMuscles": ["from taxonomy"],
  "secondaryMuscles": ["from taxonomy, or empty array"],
  "superset_group": "string (optional — e.g. 'ss1'; same value on two exercises links them as a superset)",
  "reps_weekly": { "1": "string", "2": "string" },
  "rir_weekly": { "1": "string", "2": "string" },
  "sets_weekly": { "1": "number", "2": "number" },
  "notes": "string (leave empty — user fills this in during training)",
  "alternatives": [
    { "exercise": "string", "primaryMuscles": ["..."], "secondaryMuscles": ["..."] }
  ]
}
```

---

## Schema Rules

1. **`days_per_week` is the TRAINING-day count** — `days_per_week` is the number of training days per week (3 for a full-body program, 4 for upper/lower, 6 for push/pull/legs, etc.). It is NOT the number of calendar days and is NOT always 7. The `weekly_schedule` and `days` arrays still represent the full 7-day week (training days plus REST DAY entries); only `days_per_week` reflects how many of those are training days. Example: a 3-day full-body program has `days_per_week: 3`, with a 7-entry `weekly_schedule` / `days` array containing 3 training days and 4 REST DAY entries.
2. **`days` array always totals 7 entries** — the `days` array must contain exactly 7 day objects representing the full calendar week: the training days plus REST DAY objects padded so the total is 7. Each REST DAY object is `{"day_name": "REST DAY", "estimated_duration": 0, "exercises": []}`. The `days` array and the `weekly_schedule` array must agree: the same 7 days, in the same order, with rest days in the same positions. Never emit a `days` array with only the training days and no rest padding.
3. **Block-relative progression keys vs absolute `weeks`** — weekly progression keys (`reps_weekly`, `sets_weekly`, `rir_weekly`) always start from "1" within each block. The block's `weeks` field, by contrast, shows the ABSOLUTE program range. Example: a block covering program weeks 7–12 has `weeks: "7-12"` but uses progression keys "1", "2", "3", "4", "5", "6" — not "7", "8", "9". This keeps each block's progression self-contained while the timeline reads correctly across the whole program.
4. **Deload tagging** — if a block has deload weeks, include a `deload_weeks` array with the block-relative week numbers (e.g., [5] for a 5-week block with deload on week 5). This block-level flag marks which week(s) are deloads; the reduced training values for those weeks are carried in each exercise's `sets_weekly` / `reps_weekly` / `rir_weekly`. Emit BOTH — the flag marks the week, the per-week values carry the prescription.
5. **Empty arrays** — if an exercise has no secondary muscles, use `[]`. Do not omit the field.
6. **restQuick** — calculate as ~65% of the `rest` value, rounded to a clean number.
7. **Estimated duration** — ALWAYS recalculate using this duration formula instead of trusting plan estimates: `Straight sets: (sets × 45s) + (sets × rest_seconds) | Superset pairs: (pairs × 90s) + (pairs × rest_seconds) + (pairs × 150s) | Total: exercise_count × 150s + 300s warmup`. Duration has been pre-approved in the review stage.
8. **Superset rest encoding** — for superset exercises, SS[n]a's `rest` field represents the inter-exercise transition rest (60-90s). SS[n]b's `rest` field represents the full rest before repeating the pair (compound or isolation default for that exercise type). `restQuick` is calculated from each exercise's own `rest` value.
9. **sets vs sets_weekly** — `sets` is the default set count for training weeks (used for display). `sets_weekly` must be specified for every week in the block: training weeks should match `sets`, and deload weeks should show reduced values. Both fields are required for every strength exercise.
10. **deload_weeks optionality** — omit `deload_weeks` entirely for blocks without deloads. Do not include an empty array.
11. **weekly_schedule** — create a 7-day schedule showing training and rest days. For each day 1-7, specify: day_number, type ("training" or "rest"), and day_name (e.g., "Push", "Pull", "REST DAY"). Training days must match the day_name values in the days array. The number of `type: "training"` entries must equal `days_per_week`. Example for a 5-training-day program:
    - Day 1: {"day_number": 1, "type": "training", "day_name": "Push"}
    - Day 2: {"day_number": 2, "type": "training", "day_name": "Pull"}
    - Day 3: {"day_number": 3, "type": "rest", "day_name": "REST DAY"}
    - Days 4,5: training, Day 6: rest, Day 7: training
    (5 training entries → days_per_week: 5; 7 entries total.)
12. **Sample plan protection** — for sample plans only, include `"_metadata": {"isSamplePlan": true}` at the root level to prevent overwriting users' exercise preferences during import.
13. **RIR** — carry RIR guidance from the approved plan into each exercise's rir_weekly field. Do not regenerate or modify RIR values — the plan is authoritative. Do not put RIR in the notes field.
14. **Notes field** — leave the `notes` field as an empty string (`""`) for every exercise. This field is reserved for user input during training.
15. **routine_name and block_name** — `routine_name` is the stable base program name across every standalone block file AND the cumulative file (no mesocycle suffix). Mesocycle/block identity lives in `block_name`: "Mesocycle M · Block B — <Phase> (Weeks X–Y)" for mesocycle-based programs.

---

## Cumulative File Rules

The cumulative file (`<routine_slug>_full.json`) is the primary deliverable for multi-block programs. It is built purely by assembly:

1. Identical root fields to the standalone files (`routine_name`, `description`, `days_per_week`) — these are constant across all blocks.
2. Its `blocks` array is the ordered union of every block object generated so far. Each block object is byte-for-byte the same object that appears in that block's standalone file — do not re-derive or re-tag anything.
3. On "next": append the new block object.
4. On "review": replace the matching block object (by `block_name`/position) with the corrected one; leave all other blocks untouched.
5. Never include `_metadata.isSamplePlan` unless the program is a sample plan.
6. Write to disk and provide the link as the PRIMARY download. Never print the full JSON to chat.

A user who stops after any number of blocks can import this single file to load everything generated up to that point as one routine.

---

## Pre-Delivery Self-Check

Before presenting each block, silently verify:

- [ ] `days_per_week` equals the number of TRAINING days (not 7, unless the program genuinely trains 7 days)
- [ ] `days` array contains exactly 7 entries (training days + REST DAY padding), matching `weekly_schedule` day-for-day
- [ ] Number of training entries in `weekly_schedule` equals `days_per_week`
- [ ] `routine_name` is the stable base name (no mesocycle suffix) on both the standalone file and the cumulative file
- [ ] `block_name` follows "Mesocycle M · Block B — <Phase> (Weeks X–Y)" for mesocycle-based programs, with `weeks` set to the ABSOLUTE program range
- [ ] Every exercise from the plan appears in JSON with correct set counts
- [ ] Exercise names are identical everywhere (across days and superset references)
- [ ] Superset exercises are adjacent with matching superset_group values
- [ ] Rep progressions trend flat-to-decreasing across weeks (not identical every week)
- [ ] RIR guidance from the plan carried through to every exercise's rir_weekly field
- [ ] rir_weekly field populated for every exercise that has reps_weekly (matching structure and set counts)
- [ ] notes field is empty (`""`) for every exercise
- [ ] If the block has a deload: `deload_weeks` flag is set AND those weeks show reduced sets_weekly (~40-50%) and increased RIR
- [ ] restQuick ≈ 65% of rest for every exercise
- [ ] Every exercise's muscle tags verified against canonical library at https://json.fit/exercises.md (library tags override plan tags)
- [ ] Block-relative progression week keys start from "1"
- [ ] Session durations are recalculated using the duration formula
- [ ] Cumulative `<routine_slug>_full.json` updated with this block (appended on "next", replaced on "review") and offered as the primary download

Fix any issues before presenting.
