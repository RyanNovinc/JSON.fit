# JSON.fit Volume Landmarks 

This file is the canonical reference for weekly volume targets per muscle group on JSON.fit.

## Instructions for AI

When generating workout programs, you MUST:

1. Use these per-muscle volume ranges as targets, NOT a single major/medium classification.
2. Each muscle has its own MEV/MAV/MRV — respect them individually.
3. The user's selected volume tier (Conservative/Moderate/High) and training experience map to specific positions within each muscle's MAV range.
4. Volume is measured in EFFECTIVE sets (Primary × 1.0 + Secondary × 0.5), consistent with the rest of the JSON.fit system.

## Volume Landmark Definitions

- **MV** (Maintenance Volume): Minimum to retain current muscle. Below this, muscle is lost.
- **MEV** (Minimum Effective Volume): Minimum to grow. Below this, training maintains but doesn't add muscle.
- **MAV** (Maximum Adaptive Volume): The productive sweet spot. Best gains-per-fatigue ratio.
- **MRV** (Maximum Recoverable Volume): Upper ceiling. Above this, recovery fails and gains stop.

## Per-Muscle Volume Landmarks (effective sets per week)

| Muscle | MV | MEV | MAV (low–high) | MRV |
|--------|----|----|----------------|----|
| Chest | 4 | 8 | 12–20 | 22 |
| Back (Lats + Upper Back combined) | 8 | 10 | 14–22 | 25 |
| Front Delts | 0 | 0 | 4–8 | 12 |
| Side Delts | 6 | 8 | 16–22 | 26 |
| Rear Delts | 0 | 4 | 6–12 | 18 |
| Traps | 0 | 4 | 6–10 | 14 |
| Biceps | 5 | 8 | 14–20 | 26 |
| Triceps | 4 | 6 | 10–14 | 18 |
| Forearms | 0 | 4 | 4–10 | 14 |
| Quads | 6 | 8 | 12–18 | 20 |
| Hamstrings | 4 | 6 | 10–16 | 20 |
| Glutes | 0 | 6 | 8–18 | 22 |
| Calves | 6 | 8 | 12–18 | 22 |
| Core | 0 | 0 | 8–16 | 20 |
| Lower Back | 0 | 4 | 4–8 | 12 |
| Neck | 0 | 0 | 4–8 | 14 |
| Obliques | 0 | 0 | 4–8 | 12 |
| Hip Abductors | 0 | 0 | 4–8 | 12 |
| Hip Adductors | 0 | 0 | 4–8 | 12 |
| Serratus Anterior | 0 | 0 | 2–6 | 10 |
| Shins (Tibialis) | 0 | 0 | 4–10 | 14 |

### Note on Back

Treat Back as a single muscle group (lats, mid-back, upper back combined). Splitting into separate "Lats" and "Upper Back" with full back-volume ranges each would double-count work from rows, pulldowns, and pull-ups. Lat vs. mid-back emphasis is handled through exercise selection within the combined back volume budget.

### Note on Traps

The Traps numbers above assume effective-set (fractional) counting, where heavy rows and deadlifts contribute 0.5 effective sets to traps. Stay consistent with the fractional convention across the program.

## Tier Mapping (Volume Preference × Experience)

The user's Volume Preference (from questionnaire) and Training Experience together determine the target position within each muscle's MAV.

**IMPORTANT:** When no priority muscles are specified, target a single position (not a range) so non-priority muscles land at SIMILAR effective set counts within their respective MAV ranges. This produces balanced programs. Treat the position as a target, not a license to use the full range.

### Conservative tier
For users who want lower-end productive volume.

| Experience | Target Position |
|------------|-----------------|
| Complete Beginner | MEV |
| Beginner | MEV to MAV-low |
| Intermediate | MAV-low |
| Advanced | MAV-low |

### Moderate tier (recommended default)
For users who want sweet-spot productive volume.

| Experience | Target Position |
|------------|-----------------|
| Complete Beginner | MEV |
| Beginner | MAV-low |
| Intermediate | MAV-mid |
| Advanced | MAV-mid |

### High Volume tier
For users with high recovery capacity who want to push volume.

| Experience | Target Position |
|------------|-----------------|
| Complete Beginner | MAV-low |
| Beginner | MAV-mid |
| Intermediate | MAV-high |
| Advanced | MAV-high to MRV |

## How Target Positions Translate to Numbers

The "Target Position" defines where in the muscle's MAV range to land. Compute the target as a tight range around that position (±1-2 sets to allow exercise selection flexibility):

- **MEV** = the muscle's MEV value, ±1 set
- **MAV-low** = lower third of MAV (e.g., for Chest MAV 12–20, MAV-low ≈ 12–14)
- **MAV-mid** = middle third of MAV (e.g., for Chest MAV 12–20, MAV-mid ≈ 14–17)
- **MAV-high** = upper third of MAV (e.g., for Chest MAV 12–20, MAV-high ≈ 17–20)
- **MAV-high to MRV** = upper third of MAV through MRV (e.g., for Chest MAV 12–20, MRV 22, this ≈ 17–22)

When building the per-muscle target table, output each muscle's target as a tight range around the appropriate position.

## How to Compute Target Range for a Muscle

Example: An Intermediate user picks "Moderate" volume tier.
Tier × Experience = MAV-mid

For Chest (MAV 12–20):
- MAV range = 12–20, span = 8
- MAV-mid = middle third ≈ 14–17
- Target: 14–17

For Hamstrings (MAV 10–16):
- MAV range = 10–16, span = 6
- MAV-mid = middle third ≈ 12–14
- Target: 12–14

So the SAME user gets DIFFERENT, tightly-targeted ranges per muscle — calibrated to that muscle's recovery capacity AND positioned consistently across muscles for balance.

## Auxiliary Muscles (Opt-In)

If the user has selected an auxiliary muscle (Neck, Obliques, Lower Back, Hip Abductors, Hip Adductors, Serratus Anterior, Shins, Forearms direct work), use that muscle's MAV-low range as the floor — typically 4–6 effective sets.

## Priority Muscles (User-Specified)

If a muscle is flagged as priority, target MAV-high to MRV (top of the muscle's productive range). Reduce non-priority muscles toward their MEV to keep total stress recoverable.

## Exempt-from-Floor Muscles

Some muscles get sufficient volume from compounds and don't need direct work to clear MEV:
- Front Delts (heavy indirect from pressing)
- Traps (indirect from rows, deadlifts)
- Rear Delts (indirect from rows, face pulls)
- Lower Back (indirect from squats, deadlifts)
- Glutes (heavy indirect from squats and hinges)
- Forearms (indirect from grip-loaded pulling)

These can show 0 direct sets if compound contributions cover MEV. They are NOT exempt from MRV — going over the ceiling still causes problems.

## Volume Violation Handling

When a muscle's effective volume falls outside its target range, apply these rules. This section is the canonical answer for what to do with volume violations and supersedes any HIGH/LOW handling guidance in the prompts.

### Decision order
For each muscle, evaluate in this order:
1. Priority muscle (user-selected)? → Priority rules
2. Auxiliary muscle (user-selected)? → Auxiliary rules
3. Exempt-from-floor muscle (Front Delts, Traps, Rear Delts, Lower Back, Glutes, Forearms) AND not selected as priority/auxiliary? → Exempt rules
4. Otherwise → Non-Priority Non-Exempt rules

### Non-Priority, Non-Exempt Muscle

| Status | Action |
|--------|--------|
| Below target floor | Must fix — add sets to reach floor |
| Above target ceiling | Must fix — reduce sets to within range |
| At or above MRV | Must fix immediately — hard fail |

### Exempt-from-Floor Muscle

| Status | Action |
|--------|--------|
| Below target floor | Acceptable IF compound contributions cover MEV. No action needed. |
| Above target ceiling, below MRV | Attempt fix first. Reduce a press only if doing so doesn't drop Chest, Front Delts (if direct), Triceps, Back, or any other affected muscle below their target floors. If reduction is impossible without violating another target, document the cascade and accept the overshoot. |
| At or above MRV | Must fix — overtraining risk is real, even from indirect volume. Reduce pressing or split exercises across more days. |

### Priority Muscle (User-Selected)

| Status | Action |
|--------|--------|
| Below MAV-high | Must fix — add sets toward MAV-high to MRV range |
| Above MRV | Must fix — reduce to within MAV-high to MRV range |
| Within MAV-high to MRV | In target range, no action |

### Auxiliary Muscle (User-Selected)

| Status | Action |
|--------|--------|
| Below MAV-low | Must fix — add sets to reach floor (typically 4-6 effective sets) |
| Above MRV | Must fix — reduce sets |
| Between MAV-low and MRV | In target range, no action |

### What "Must Fix" Means

When a violation requires fixing:
1. Attempt the fix (add or remove sets, swap exercises)
2. Recount affected muscles to verify the fix doesn't create a new violation
3. If the fix creates a worse violation elsewhere, document specifically which muscle and why no fix is possible
4. "Acceptable trade-off," "appropriate for this user," or "exempt-from-floor muscle so it's fine" are NOT valid justifications
