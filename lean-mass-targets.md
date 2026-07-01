# JSON.fit Lean-Mass Targets

Canonical reference for turning a goal weight + goal body-fat into a training target, and for the "overshoot then cut" strategy. AI MUST apply this when the user's profile includes a goal weight and/or a goal body-fat. If neither is provided, skip this file's math and plan from the stated phase alone.

For the theory and measurement-error limits behind this page, see [lean-mass-targets-references.md](https://json.fit/lean-mass-targets-references.md).

## Core Rule

The durable goal is a LEAN-BODY-MASS number, not a scale weight. Scale weight at a fixed body-fat is the RESULT of hitting a lean-mass target and then removing the excess fat.

## Formula

```
targetLeanMass = goalWeight × (1 − goalBodyFat% / 100)
currentLeanMass = currentWeight × (1 − currentBodyFat% / 100)   (only when body fat is known)
```

## The Overshoot Logic

A bulk adds fat alongside muscle. So a user cannot arrive at "goal weight AND goal body-fat" by bulking straight to goal weight — they will hit goal weight at a HIGHER body-fat. The path:

1. Bulk (or recomp) to accumulate the target lean mass. This lands the user ABOVE goal weight, at a higher body-fat.
2. Cut the excess fat. Lean mass is retained; scale weight falls to goal weight; body-fat falls to goal.

The overshoot is however much fat came along for the ride — it is NOT a fixed number and MUST NOT be promised as one.

## Worked Example

Goal: 90 kg at 10% body fat.

- targetLeanMass = 90 × (1 − 0.10) = **81 kg lean**.
- Bulk until lean mass ≈ 81 kg. In practice the user might reach this at ~94 kg and ~14% body fat.
- Cut to reveal: at 81 kg lean and 10% body fat, scale weight = 81 ÷ (1 − 0.10) = **90 kg**.
- Result: 90 kg at 10% — goal met.

## HARD RULES

1. Express bulk targets as LEAN MASS ("build toward ~81 kg of lean mass"), not as a precise scale-weight-at-body-fat promise.
2. Do NOT promise an exact landing spot. Bodyweight swings ±1–2 kg daily and consumer body-fat readings carry several points of error. Frame as "bulk to roughly X, then cut to your target," never "you will be exactly 90 kg at exactly 10%."
3. Do NOT invent a fixed overshoot (e.g. "gain 2 kg past goal then cut"). The overshoot depends on how much fat accumulates and is only known in retrospect.
4. If current lean mass is already at or above target lean mass and body-fat is above goal, the correct phase is a CUT, not a bulk — the user already has the muscle and needs to reveal it.

## How This Feeds Phase Selection

- current lean mass well below target → a gaining phase (bulk / lean_bulk) is justified; the gap is the runway.
- current lean mass ≈ target, body-fat above goal → cut.
- unknown body fat → plan from the stated phase and goal-weight direction; do not fabricate a lean-mass number.

## Precedence

The generation prompt's stated phase and computed calorie targets override this file. Use this math to inform framing and target-setting, not to override an explicit user choice or the computed numbers.
