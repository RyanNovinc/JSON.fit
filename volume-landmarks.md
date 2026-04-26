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

The user's Volume Preference (from questionnaire) and Training Experience together determine target ranges within each muscle's MAV.

### Conservative tier
For users who want lower-end productive volume.

| Experience | Position within MAV |
|------------|---------------------|
| Complete Beginner | MEV to MAV-low |
| Beginner | MAV-low |
| Intermediate | MAV-low |
| Advanced | MAV-low to MAV-mid |

### Moderate tier (recommended default)
For users who want sweet-spot productive volume.

| Experience | Position within MAV |
|------------|---------------------|
| Complete Beginner | MEV to MAV-low |
| Beginner | MAV-low to MAV-mid |
| Intermediate | MAV-mid (full MAV range) |
| Advanced | MAV-mid to MAV-high |

### High Volume tier
For users with high recovery capacity who want to push volume.

| Experience | Position within MAV |
|------------|---------------------|
| Complete Beginner | MAV-low to MAV-mid |
| Beginner | MAV-mid to MAV-high |
| Intermediate | MAV-high to MRV-1 |
| Advanced | MAV-high to MRV |

## How to Compute Target Range for a Muscle

Example: An Intermediate user picks "Moderate" volume tier. Looking at Chest:
- Chest MAV: 12–20
- Intermediate + Moderate = "MAV-mid (full MAV range)" → target 12–20

For a different muscle, same user, Hamstrings:
- Hamstrings MAV: 10–16
- Intermediate + Moderate = "MAV-mid (full MAV range)" → target 10–16

So the SAME user gets DIFFERENT ranges per muscle, calibrated to that muscle's actual recovery capacity.

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
