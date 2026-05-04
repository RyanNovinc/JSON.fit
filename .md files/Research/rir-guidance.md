# JSON.fit RIR Guidance

Canonical reference for RIR (Reps In Reserve) prescription. AI MUST apply this when generating workouts.

## Core Rules

1. RIR = reps left before momentary muscular failure. RIR 0 = the point at which one more rep with good form is impossible.
2. Output RIR in exercise notes only. Never as a per-set logged field.
3. Apply exercise category × mesocycle week × set count × goal.
4. Tier-appropriate language (see Output Format section).
5. Output RIR for EVERY exercise — compounds, machines, isolation, and accessories. No exceptions.
6. RIR notes appear per-exercise, never grouped. Each exercise gets its own line, even if multiple exercises share the same values. Never write "Bench Press, T-Bar Row: RIR 3 W1...".

## Standardised Language

Use these exact phrases. Do not paraphrase or substitute.

- For RIR 0 prescription: write "RIR 0" — never "true failure", "to failure", or "go to failure"
- For RIR 0-1 prescription: write "RIR 0-1" — never "near failure" or similar
- For drop set permission: write "Drop set optional" — never "AMRAP" or "burnout set"
- For compound technique reminder: write "Stay technical" — keep this exact phrase
- For mesocycle progression: write "RIR X W1 → Y W2 → Z W3 → W W4" using the arrow symbol →

## Exercise Categories

Classify every exercise as one of:

- `barbell_compound` — back squat, deadlift, bench press, OHP, barbell row, front squat
- `machine_compound` — leg press, hack squat, chest press machine, lat pulldown, cable row, smith machine, hip thrust, glute bridge, chest-supported t-bar row, hex bar deadlift
- `isolation` — curls, lateral raises, tricep extensions, leg curls, leg extensions, flyes, calf raises
- `unilateral_compound` — Bulgarian split squat, single-leg RDL, single-arm DB row, lunges, step-ups
- `high_skill` — power clean, snatch, conventional deadlift, complex Olympic-derivative

**Classification rule:** Classification is based on stability and skill demand, not equipment. A barbell movement that is supported (chest-supported, fixed-path, or pad-stabilised) or has minimal balance/technique demand classifies as `machine_compound`, not `barbell_compound`. When in doubt: high stability + low skill = `machine_compound`. Free-standing + high skill = `barbell_compound` or `high_skill`.

## Base Matrix (Hypertrophy, 4-Week Mesocycle)

Target RIR for middle sets:

| Category | W1 | W2 | W3 | W4 |
|----------|----|----|----|----|
| barbell_compound | 3 | 2 | 1 | 0-1 |
| machine_compound | 2 | 1-2 | 1 | 0-1 |
| isolation | 2 | 1 | 0-1 | 0 |
| unilateral_compound | 3 | 2 | 1-2 | 1 |
| high_skill | 3-4 | 3 | 2 | 2 |

**3-week mesocycle:** use W1, W2, W4 columns (skip W3).
**5-6 week mesocycle:** add an extra week at W1 value before progressing.

## Goal Modifiers

Apply to base matrix:

- `hypertrophy` → use base
- `strength` → +1 RIR for compound categories only; isolation unchanged
- `powerlifting` → +1 RIR for barbell_compound and high_skill; others unchanged
- `general_fitness` → +1 RIR all categories

## Within-Exercise RIR (by Set Count)

Target RIR from matrix = middle sets. Adjust set-by-set:

| Sets | Set 1 | Middle | Last Set |
|------|-------|--------|----------|
| 1 | — | — | RIR 0 (regardless of week) |
| 2 | target+1 | — | target-1 |
| 3 | target+1 | target | target-1 |
| 4 | target+1 | target | target-1 |
| 5+ | target+2 (cap 4 on compounds) | target | target-1 |

**Hard floors:**
- `barbell_compound` and `high_skill`: never below RIR 0
- `machine_compound`: RIR 0 allowed on last set only
- `isolation`: RIR 0 encouraged on last set; drop set optional in W4

## Output Format (by User Tier)

### Beginner / "Take It Easy"
Behavioural cues, no numbers. Single line per exercise:

`"First sets: stop when reps slow down. Last set: push hard, last 1-2 reps should grind."`

### Intermediate / "Build Steady"
Hybrid format:

`"RIR 3 W1 → 2 W2 → 1 W3 → 0-1 W4. First set easier, last set hardest."`

### Advanced / "Push Hard"
Pure numerical, set-aware:

`"RIR target W1:3, W2:2, W3:1, W4:0-1. Set 1: target+1. Last set: target-1."`

## Standard Notes (Append When Applicable)

- `barbell_compound` (any week): `"Stay technical. Never sacrifice form for RIR target."`
- `isolation` W4: `"Last set: RIR 0. Drop set optional."`
- First exercise of session: `"Don't burn out. Save energy for later movements."`
- `high_skill`: `"Form first. Stop set if technique breaks, regardless of RIR."`
- 1-set exercises: `"Single set = single chance. RIR 0."`

## Accuracy Calibration

Users underestimate RIR by ~1-2 reps on average. Accuracy is worse at lighter loads (high-rep isolation) and further from failure (RIR 3+). This is why isolation targets are aggressive (0-1 RIR) — actual RIR will be ~2-3.

## Worked Example

User: intermediate, hypertrophy goal, "Build Steady" tier, W2 of mesocycle, chest day.

**Bench Press (barbell_compound), 3 sets:**
Target W2 = 2 RIR.
Notes: `"RIR 3 W1 → 2 W2 → 1 W3 → 0-1 W4. Set 1: 3 RIR. Set 2: 2 RIR. Set 3: 1 RIR. Stay technical."`

**Cable Flye (isolation), 4 sets:**
Target W2 = 1 RIR.
Notes: `"RIR 2 W1 → 1 W2 → 0-1 W3 → 0 W4. Set 1: 2 RIR. Sets 2-3: 1 RIR. Set 4: RIR 0."`

**Pec Deck (isolation), 1 finishing set:**
Notes: `"Single set = single chance. RIR 0."`
