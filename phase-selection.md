# JSON.fit Phase Selection

Canonical reference for training-phase selection (bulk / lean bulk / recomp / cut / maintenance). AI MUST apply this when generating workout and meal plans. The app derives the phase from the user's profile and states it in the generation prompt's PHASE CONTEXT block — your job is to HONOUR that phase and understand its consequences, not to re-derive or override it.

For the studies, effect sizes, and confidence grading behind the numbers on this page, see [phase-selection-references.md](https://json.fit/phase-selection-references.md).

## Core Rules

1. The generation prompt states the derived phase. Treat it as authoritative. Do not silently switch phases.
2. If the prompt provides no phase (older profile, or missing goal data), derive one using the Decision Matrix below and state which you chose and why.
3. The phase is a recommendation the user may override. If the user explicitly asks for a different phase, honour the user.
4. Explain the phase to the user in one plain sentence when relevant. Never lecture.

## Phases

| Phase | Energy balance | Primary intent |
|-------|----------------|----------------|
| bulk | Surplus (~+10%) | Maximise muscle gain; accept some fat |
| lean_bulk | Small surplus (~+5%) | Muscle gain with minimal fat |
| recomp | Maintenance to slight deficit | Gain muscle and lose fat at once |
| cut | Deficit (≤500 kcal) | Lose fat, retain muscle |
| maintain | Maintenance | Hold composition |

## Decision Matrix (only if the prompt did not state a phase)

Inputs: training state (new / returning / consistent / advanced), current body fat if known, and goal direction (current vs goal weight).

| Condition | Phase |
|-----------|-------|
| New or returning, body fat ≥ ~15% | recomp |
| Body fat high (≥ ~15–20%) and leanness is the goal | cut |
| Body fat low (≤ ~12–15%) and size is the goal | lean_bulk |
| Low body fat, size the goal, user accepts faster gain | bulk |
| Goal ≈ current, or user wants a break | maintain |
| Ambiguous | Follow goal-weight direction; state it as a preference, not a rule |

## HARD RULE — No Cut-First Mandate

Never tell the user they MUST cut before bulking in order to build muscle. There is no compelling evidence that cutting to get lean first "potentiates" hypertrophy or makes future gains leaner, and across a normal healthy body-fat range (roughly ≤20–25% for men) body-fat percentage does not meaningfully impair muscle gain. A user at 18–20% body fat can bulk and build muscle.

(Whether very high body fat impairs gains, and the exact shape of that relationship, is genuinely debated in the literature — see the references doc. The rule below rests only on the agreed conclusion: getting lean first is not a prerequisite for building muscle.)

Reasons to cut or recomp first are legitimate but are about HEALTH (staying under ~20%), AESTHETICS, keeping the later cut SHORT, RECOVERY, and PREFERENCE — never a claim that the user physiologically cannot build muscle otherwise.

Forbidden statements (do NOT produce):
- "You need to cut first before you can build muscle."
- "You're too fat to bulk / you won't gain muscle at this body fat."
- "Get to 12% before bulking or your gains will all be fat."

Permitted framing:
- "You can bulk from here. Cutting first is optional — it keeps your later cut shorter and gets you leaner sooner. Your call."

## What The Phase Changes (index)

The phase modifies existing systems. It does NOT change exercise selection or the training split.

- **Training volume** — position within the MAV range. cut → MEV/MAV-low; recomp → MAV-low/mid; lean_bulk → MAV-mid/high; bulk → MAV-high to MRV. The numbers come from `volume-landmarks.md`; the phase only sets the position, expressed through the volume tier already carried in the prompt. Do not restate landmark numbers here.
- **RIR** — cut adds +1 RIR (see `rir-guidance.md`, Phase Modifiers). Other phases use base.
- **Cardio** — advisory only, never a tracked/imported entity. cut & recomp: optional low-intensity steady-state as a lever to hit the target fat-loss rate, never a mandate; use the least needed. bulk & lean_bulk: minimal, to protect the surplus. maintain: user preference.
- **Calories & protein** — set by the app and stated in the meal prompt's targets block; enforced there. Protein 1.6–2.2 g/kg bodyweight, biased to the high end on a cut.

## Rate Rationale (for explaining to the user; the app computes the actual numbers)

Note: the monthly gain-rate tiers and the exact surplus percentages below are practitioner planning heuristics (Lyle McDonald / Alan Aragon models), not figures from controlled trials. The evidence-backed part is the *direction* — a small surplus is enough and a large one just adds fat. Treat the numbers as adjustable defaults.

- Muscle gain has a training-age ceiling: new ~1–1.5%/month of bodyweight, consistent ~0.5–1%/month, advanced ~0.25–0.5%/month. Eating much faster than this only adds fat. This is why the surplus scales with training state and is capped.
- Fat loss: target ~0.5–0.8% of bodyweight per week. Keep the deficit ≤ ~500 kcal/day to protect muscle; under ~400 kcal/day permits recomposition. The maximum fat-loss rate falls as the user gets leaner — scale the target to how much fat they carry, not a flat number.
- A returning lifter's fast phase is muscle memory (regain), best served by maintenance or a modest surplus, not an aggressive one.

## Plan Naming

Name the plan from the phase so the file matches the flow:

- bulk → "Bulk"
- lean_bulk → "Lean Bulk"
- recomp → "Recomp"
- cut → "Cut"
- maintain → "Maintenance"

(e.g. "7-Day Lean Bulk", "14-Day Cut", "8-Week Recomp".) Do not append calorie counts or macro splits to the name.

## Precedence

Explicit user instructions in the generation prompt override this file. This file overrides your own assumptions. Where this file meets `volume-landmarks.md`, `rir-guidance.md`, or the meal targets block on their own domains, THOSE files are authoritative for the numbers — this file only governs which phase applies and which position/modifier to hand to them.
