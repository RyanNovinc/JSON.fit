# Rest Period Guidance

User's rest tier (Optimal / Moderate / Minimal) comes from questionnaire. Apply matrix by exercise category.

**This file is the source of truth for the numbers, and the JSON.fit app implements it directly.** Rest is no longer written into a user's plan by the AI — the app resolves it at runtime from the exercise's category, how heavily it is loaded in the current block, and whichever tier the user is on. All three tiers are resolved for every exercise, and the user can switch between them mid-workout. Editing a number here changes what every existing plan rests for; nothing has to be regenerated.

## Matrix

| Exercise Category | Optimal | Moderate | Minimal |
|---|---|---|---|
| Heavy compound (squat, deadlift, bench, OHP, weighted pull-ups/dips at <6 RM) | 3–5 min | 2.5–3 min | 2 min |
| Moderate compound (rows, machine compounds, lat pulldowns, leg press, hack squat) | 2.5–3 min | 2 min | 75–90 s |
| Unilateral compound (Bulgarian splits, lunges, single-arm rows) | 90 s–2 min between sides; 2.5 min between pairs | 75–90 s between sides; 2 min between pairs | 60 s between sides; 90 s between pairs |
| Large-muscle isolation (curls, triceps ext, leg curls, leg ext, pec deck) | 2 min | 75–90 s | 60 s |
| Small-muscle isolation (lateral raises, rear delts, calves, wrist curls, face pulls) | 60–90 s | 45–75 s | 30–60 s |
| Superset transition (between the two exercises of an antagonist pair) | 60 s | 45 s | 30 s |
| Superset round (after the second exercise, before repeating the pair) | 2 min | 105 s | 90 s |

Hard floor on heavy compounds: never below 2 min, regardless of tier or instructions elsewhere. The app enforces this as a clamp applied after every other adjustment, so no goal override, deload rule or tier can undercut it.

The two superset rows are the per-tier split of the antagonist-superset range given under Edge Cases below. They are listed as matrix rows because a superset member needs a tier lookup like any other exercise — the edge-case note gives the range, these rows give the value.

**Unilateral note.** The row above gives two numbers because a unilateral exercise has two rest events. JSON.fit counts one set as both sides, so the only rest event its timer fires is the between-pairs one — that is the value the app uses. The between-sides number is for the lifter's own pacing.

## Goal Overrides

- **Strength (1–5 RM):** Override matrix. Heavy compounds = 3–5 min regardless of tier. Singles/doubles in advanced lifters = 5–7 min. The override applies to free-weight compounds; machine and cable compounds stay on their own row, because the external support removes the stabilisation demand that earns the longer rest.
- **Hypertrophy / Recomp / Fat Loss:** Use matrix as-is. Create deficit via diet and separate cardio, not shorter rest.
- **General Fitness:** 60–120 s across all categories. Supersets encouraged.
- **Minimal tier:** Pair with antagonist supersets (chest/back, biceps/triceps, hamstrings/quads isolation, side delts/face pulls) for further time savings.

## Why The Minimal Column Is Safe

The Optimal column is the well-supported one: longer rest preserves reps across sets, and preserved reps mean preserved volume load. The Minimal column needs its own justification, because it is the column making the risky claim.

The claim is not that short rest is equally good in general. It is that **volume load, not the clock, is what drives the adaptation** — so rest can be cut right up to the point where reps start falling off, and no further. That point is what the Feedback Signal below detects. The Minimal numbers are the shortest rests at which most lifters stay above that line on each category; they are a starting estimate, and the feedback signal is the correction.

This is why the Minimal column shortens far more on isolation work than on heavy compounds. A lateral raise recovers enough in 30 seconds to repeat its reps; a heavy squat does not, at any tier, which is what the hard floor encodes.

## Edge Cases

- **Antagonist supersets:** 30–60 s between the two exercises, then 90 s–2 min before next round. See the two superset rows in the matrix for the per-tier values.
- **Same-muscle supersets:** Avoid for hypertrophy. Finishers only.
- **Drop sets:** ≤10 s between drops (load-change time). Normal category rest between full drop-set rounds.
- **Sets to failure:** Add ~60 s to normal rest after compound failure; ~30 s after isolation failure.
- **Deload:** Resolve every tier to its Optimal-column value for the week. Applying a flat 2–3 min literally would make a deload lateral raise rest longer than a training-week one, which inverts the intent — a deload is less work with full recovery, not more waiting on small movements.

## Set-to-Set Progression

- Hypertrophy: allow rep targets to drop slightly on later sets, OR extend rest 15–30 s on later sets.
- Strength (heavy 3–5 RM): rest grows naturally — set 2 may need 3 min, set 4 may need 5 min.

## Feedback Signal

If reps drop >15–20% from set 1 to set 2 at the same load, rest was too short. Use as correction trigger.

This is the mechanism behind the whole matrix, not a footnote to it. Every number above is an estimate of where this line sits for a given category and tier. A lifter who trips it should lengthen rest before changing anything else in the program.

## Priority Hierarchy

Rest is a secondary lever. Adaptation drivers in order:
1. Weekly volume per muscle (see volume-landmarks.md)
2. Proximity to failure / RIR (see rir-guidance.md)
3. Progressive overload
4. Exercise selection

For full citations see https://json.fit/rest-references.md
