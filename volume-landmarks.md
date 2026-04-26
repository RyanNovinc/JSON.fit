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
| Chest | 6 | 8 | 12–20 | 22 |
| Lats | 6 | 10 | 14–22 | 25 |
| Upper Back | 6 | 10 | 14–22 | 25 |
| Front Delts | 0 | 6 | 6–12 | 16 |
| Side Delts | 6 | 8 | 12–20 | 26 |
| Rear Delts | 4 | 6 | 10–16 | 20 |
| Traps | 0 | 4 | 6–10 | 14 |
| Biceps | 6 | 8 | 12–20 | 24 |
| Triceps | 6 | 6 | 10–18 | 22 |
| Forearms | 0 | 4 | 4–10 | 14 |
| Quads | 6 | 8 | 12–18 | 22 |
| Hamstrings | 4 | 6 | 10–16 | 20 |
| Glutes | 0 | 6 | 8–16 | 22 |
| Calves | 6 | 8 | 12–20 | 25 |
| Core | 0 | 0 | 4–10 | 16 |
| Lower Back | 0 | 4 | 4–8 | 12 |
| Neck | 0 | 0 | 4–8 | 12 |
| Obliques | 0 | 0 | 4–8 | 12 |
| Hip Abductors | 0 | 0 | 4–8 | 12 |
| Hip Adductors | 0 | 0 | 4–8 | 12 |
| Serratus Anterior | 0 | 0 | 2–6 | 10 |
| Shins (Tibialis) | 0 | 0 | 4–8 | 12 |

## Tier Mapping (Volume Preference × Experience)

The user's Volume Preference (from questionnaire) and Training Experience together determine the target position within each muscle's MAV.

**IMPORTANT:** When no priority muscles are specified, target a single position (not a range) so non-priority muscles land at SIMILAR effective set counts within their respective MAV ranges. This produces balanced programs. Treat the position as a target, not a license to use the full range.

### Conservative tier
For users who want lower-end productive volume.

| Experience | Target Position |
|------------|-----------------|
| Complete Beginner | MEV |
| Beginner | MAV-low |
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

## Research Basis

These landmarks are synthesized from:
- Pelland 2024 meta-regression (fractional set counting)
- Schoenfeld 2017 dose-response meta-analysis
- RP Strength volume guides (Israetel)
- Hevy app guidelines
- Krieger 2010 multi-set meta-analysis

All numbers represent EFFECTIVE sets (Primary × 1.0 + Secondary × 0.5).
