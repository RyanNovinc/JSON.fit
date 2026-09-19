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

**Counting sets toward Back.** The exercise library tags Lats and Upper Back separately, and most back exercises tag one as Primary and the other as Secondary. For the Back row a set counts ONCE: 1.0 if either Lats or Upper Back is Primary, 0.5 if one of them appears only as Secondary. Never add the Primary and the Secondary contribution of the same set together. A 4-set row is 4.0 toward Back, not 6.0. Tags in the program and in the JSON stay exactly as the library writes them (Lats, Upper Back). Only the volume row is combined, so the per-muscle target table has one Back row and no separate Lats or Upper Back rows.

**Lats or Upper Back as a priority muscle.** If the user names Lats or Upper Back as a priority, the Back row takes the priority range, and at least 60% of Back sets must come from exercises whose Primary tag is the named muscle. With no back priority, vertical pulls make up at least one-third of Back sets.

### Note on Traps

The Traps numbers above describe what the traps tolerate. They are not a floor to fill. Rows, deadlift variants and lateral raises all load the traps, but the exercise library tags prime movers only and leaves stabilisers untagged, so a tag-based count reads Traps as 0 on a program that loads them several times a week. Do not add shrugs to close that gap. Traps get direct work only when the user names Traps as a priority or auxiliary muscle.

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

Use these EXACT formulas. Do not approximate. Both Prompt 1 and Prompt 2 must produce identical numbers from the same input.

For a muscle with MAV range [low, high]:
- span = high − low
- third_offset = round(span / 3)
- two_thirds_offset = round(2 × span / 3)

Where round() uses standard rounding (0.5 rounds up).

Then compute the target ranges (both bounds inclusive, all integers):

- **MEV** = [muscle's MEV value, muscle's MEV value + 1]
- **MAV-low** = [low, low + third_offset]
- **MAV-mid** = [low + third_offset, low + two_thirds_offset]
- **MAV-high** = [low + two_thirds_offset, high]
- **MAV-high to MRV** = [low + two_thirds_offset, MRV]

### Worked Examples

**Chest (MAV 12–20, MRV 22):**
- span = 8, third_offset = round(8/3) = 3, two_thirds_offset = round(16/3) = 5
- MAV-low: 12–15
- MAV-mid: 15–17
- MAV-high: 17–20
- MAV-high to MRV: 17–22

**Hamstrings (MAV 10–16, MRV 20):**
- span = 6, third_offset = 2, two_thirds_offset = 4
- MAV-low: 10–12
- MAV-mid: 12–14
- MAV-high: 14–16
- MAV-high to MRV: 14–20

**Side Delts (MAV 16–22, MRV 26):**
- span = 6, third_offset = 2, two_thirds_offset = 4
- MAV-low: 16–18
- MAV-mid: 18–20
- MAV-high: 20–22
- MAV-high to MRV: 20–26

**Triceps (MAV 10–14, MRV 18):**
- span = 4, third_offset = round(4/3) = 1, two_thirds_offset = round(8/3) = 3
- MAV-low: 10–11
- MAV-mid: 11–13
- MAV-high: 13–14
- MAV-high to MRV: 13–18

The SAME user gets DIFFERENT, deterministically-calculated ranges per muscle — calibrated to that muscle's recovery capacity AND positioned consistently across muscles for balance. The deterministic formulas guarantee that any two AI runs with the same inputs produce the same numbers.

## Auxiliary Muscles (Opt-In)

If the user has selected an auxiliary muscle (Neck, Obliques, Lower Back, Hip Abductors, Hip Adductors, Serratus Anterior, Shins, Forearms direct work), use that muscle's MAV-low range as the floor — typically 4–6 effective sets.

## Priority Muscles (User-Specified)

If a muscle is flagged as priority, target MAV-high to MRV (top of the muscle's productive range).

Non-priority muscles step DOWN from the user's tier position to keep total stress recoverable. Use this ladder and these EXACT steps. Both Prompt 1 and Prompt 2 must produce identical numbers from the same input.

Ladder, low to high: MEV → MAV-low → MAV-mid → MAV-high. For stepping, read "MAV-high to MRV" as MAV-high and "MEV to MAV-low" as MAV-low.

- 1 or 2 priority muscles → non-priority muscles move ONE step down the ladder.
- 3 or more priority muscles → non-priority muscles move TWO steps down the ladder.
- Never below MEV. A user already at MEV stays at MEV.

Worked example: High Volume + Intermediate = MAV-high. With 5 priority muscles, non-priority muscles move two steps to MAV-low (Quads 12–14, Triceps 10–11). With 1 priority muscle they move one step to MAV-mid (Quads 14–16, Triceps 11–13).

The step applies to non-priority, non-exempt muscles only. Auxiliary muscles and exempt-from-floor muscles are not moved by it.

## Exempt-from-Floor Muscles

Some muscles are trained as a by-product of compounds chosen for other muscles:
- Front Delts (heavy indirect from pressing)
- Traps (indirect from rows, deadlifts)
- Rear Delts (indirect from rows, face pulls)
- Lower Back (indirect from squats, deadlifts)
- Glutes (heavy indirect from squats and hinges)
- Forearms (indirect from grip-loaded pulling)

These muscles have NO floor. They can show 0 direct sets, and a total below any landmark is not a violation. Do not add direct work to bring one of them up to MEV. The exercise library tags prime movers only, so stabiliser work (traps and lower back on rows, squats and hinges) never appears in a tag-based count. A low number here usually means under-counted, not under-trained.

They have NO target ceiling below MRV either. Write their row in the per-muscle target table as 0–[MRV − 1] (Front Delts 0–11, Traps 0–13). Do not restrict exercise selection to hold one of them under a lower number. Avoiding every press that tags Front Delts, for example, trades a real chest stimulus for a bookkeeping result.

They are NOT exempt from MRV — going over the ceiling still causes problems.

A muscle on this list that the user names as a priority or auxiliary muscle is no longer exempt. The priority or auxiliary rules apply to it instead.

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
| Below any landmark, including 0 | No action. These muscles have no floor. Do not add direct sets to reach MEV. |
| Below MRV | In range, no action. There is no target ceiling below MRV. |
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

### Forbidden Rationalisation Language (Applies Everywhere)

The forbidden phrases below MUST NOT appear ANYWHERE in the output — not in violation handling, not in recommendations to the user, not in notes, not in advisory text, not in suggested swaps or future modifications. This rule applies to the entire program document, not just the violation handling section.

Forbidden phrases:
- "Acceptable trade-off"
- "Appropriate for this user"
- "Exempt-from-floor muscle so it's fine"
- "Accept being [N] set(s) over the ceiling"
- "Accept being over the ceiling"
- "Acceptable overflow"
- "Slightly over but within MRV"
- "Worth flagging but no action needed"
- Any variation that suggests the user should accept a target violation as OK

If the program has a target violation, the AI's job is to FIX IT, not to explain why it's acceptable or recommend accepting it. The user can make their own modifications later — but the AI must not pre-approve violations through advisory language.

If the AI is tempted to write something like "if X feels excessive, drop Y to Z (would land at A, just B below target — acceptable trade-off)," the correct alternative is:
- Either: don't include the recommendation at all (the program is already correct)
- Or: rewrite it as "if X feels excessive, drop Y to Z, then add equivalent volume elsewhere to stay in target range"

Recommendations should never instruct the user to violate volume targets.
