# deload-guidance.md

> **Operating principle:** A deload is the planned removal of accumulated fatigue, not motivation — cut volume hard, hold load, raise RIR, and place it as the final week *inside* the block's existing week range.

This file is the single source of truth for deciding **when**, **how**, and **how much** to deload when generating a JSON.fit program. Deloads in this system are **scheduled**, **experience-scaled**, and **expressed as the final week of the block** with reduced `sets_weekly` and raised `RIR`.

---

## 0. Definitions (system-aligned)

- **Effective/fractional sets** — Primary movers count ×1.0, Secondary movers ×0.5 toward a muscle's weekly set total. Deload reductions apply to this *effective* count, not raw set count.
- **RIR** — Reps in Reserve. The lever that does most of the work in a deload: raising RIR lowers per-set fatigue cost while keeping the movement pattern and load intact.
- **MEV / MAV / MRV** — Minimum Effective, Maximum Adaptive, Maximum Recoverable Volume. A block ramps from ~MEV toward MRV; the deload drops back toward or below MEV (maintenance volume).
- **Mesocycle / block** — A 3–6 week accumulation unit. The deload is the *taper* of that unit, not a separate appended phase.
- **Exercise categories** — heavy compound barbell, moderate compound, unilateral compound, large-muscle isolation, small-muscle isolation. Fatigue cost descends roughly in that order; deload depth tracks it.

---

## 1. WHEN — frequency scaled by experience × block length

A block ramps volume from ~MEV toward MRV; fatigue beyond MRV causes the next week's rep strength to drop more than normal accumulation predicts. The deload pre-empts that. Practical and survey/consensus literature converges on a deload every **4–8 weeks**, with the lower end for high-volume/high-intensity or high-life-stress training and the upper end for moderate stress and good recovery.

### Deload-needed matrix (block length in weeks → final-week deload?)

| Experience | 3-wk block | 4-wk block | 5-wk block | 6-wk block | 8-wk block |
|---|---|---|---|---|---|
| **Beginner** | No deload | No deload | Optional | Final-week deload | Two deloads (split into 2 blocks) |
| **Intermediate** | No deload | Final-week deload | Final-week deload | Final-week deload | Mid + final deload |
| **Advanced** | Final-week deload | Final-week deload | Final-week deload | Final-week deload (mandatory) | Mid + final (mandatory) |

### When NO deload is needed — state plainly

- **Short beginner blocks (≤4 weeks).** Beginners accumulate fatigue slowly relative to the stimulus they need; a 3–4 week beginner block does not reach a fatigue ceiling that justifies sacrificing a week. Run the block, then deload between blocks only if volume has genuinely ramped.
- **Any block ≤3 weeks for beginner/intermediate** that never approaches MRV. If the top week sits at MAV or below with RIR ≥2 throughout, no within-block deload is warranted.
- **Do not** insert a deload to satisfy a calendar habit when the stimulus was never high enough to fatigue — that is lost stimulus (see §6).

### Scheduled vs autoregulated — and why this system defaults to SCHEDULED

| | Scheduled | Autoregulated |
|---|---|---|
| Trigger | Fixed calendar position (block end) | Real-time fatigue markers (§2) |
| Best for | **Pre-written programs** | Live coaching with day-to-day feedback |
| Needs | Nothing at runtime | RIR/velocity/readiness logging + adjustment authority |
| Failure mode | Mistimed if recovery differs | Drifts late; lifter rationalises "one more week" |

- JSON.fit emits a **pre-written program**. There is no live readiness feed at generation time, so autoregulated triggers cannot be evaluated.
- Therefore the system **defaults to scheduled**: the deload is written into the plan at a fixed position (the block's final week).
- Autoregulation is documented in §2 for completeness and for downstream tools that *do* have a feedback loop; it is not the default emission behaviour.

---

## 2. FATIGUE INDICATORS (autoregulated trigger — for completeness)

These would trigger a deload in an autoregulated context. They are read as **trends across weeks**, not single sessions (one bad day is noise).

| Indicator | Threshold suggesting deload |
|---|---|
| Performance drop | Rep strength or e1RM falls on the same load vs prior week, across multiple lifts |
| Effort drift (RIR/RPE) | Same load feels ~0.5+ RPE harder week-over-week (≈2–3% accumulated fatigue) |
| Bar/movement velocity | Persistent first-rep velocity loss at a fixed load |
| Persistent soreness | DOMS that does not clear before the next session for that muscle |
| Joint / connective tissue | Aching tendons, joint irritation not tied to a single session |
| Sleep | Disrupted or non-restorative sleep, reduced HRV markers (RMSSD/pNN50) |
| Motivation | Sustained drop in training drive / session readiness |

- **Action when triggered (autoregulated only):** apply the §3 default deload immediately, then resume at ~90% of pre-deload loads.
- **Agreement rule:** weight evidence higher when multiple markers move together (e.g. effort drift + velocity loss + flat performance).

---

## 3. HOW TO STRUCTURE — quantified

### The three levers

| Strategy | Volume | Load/Intensity | RIR | Effect |
|---|---|---|---|---|
| Drop volume / hold intensity | −40 to 60% sets | Hold (~same load) | +2–3 | Best fatigue clearance with least adaptation loss — **DEFAULT** |
| Hold volume / drop intensity | Hold sets | −10 to 20% load | +2–3 | Joint/connective recovery; weaker systemic fatigue clearance |
| Drop both | −40 to 50% sets | −10 to 15% load | +3 | Maximum recovery; use only for very high fatigue / advanced high-volume blocks |

### Default for this system: **drop volume, hold intensity, raise RIR**

- **Why:** cutting sets by roughly half is the single most reliable way to shed fatigue without erasing adaptation. Holding load (heavy, low-volume work) preserves strength and the trained movement pattern — minimal-volume work maintains gains even at ~1/3 of normal volume, so a one-week volume cut does not detrain.
- **Quantified default:**
  - **Volume:** reduce effective `sets_weekly` by **~40–50%** vs the block's peak week (round on the effective-set count, so a Secondary ×0.5 mover is reduced before a Primary mover where possible).
  - **Load/intensity:** **hold** the working load. Do not chase progression; repeat or slightly lighten the prior week's top load.
  - **RIR:** **raise by +2–3** relative to peak week. If the peak week ran RIR 0–1, the deload runs RIR 3–4. Every set stays clearly short of failure.

### Differences by exercise category

| Category | Deload emphasis |
|---|---|
| Heavy compound barbell | Largest set cut; keep load to preserve pattern, raise RIR most (highest systemic + joint cost) |
| Moderate compound | Standard set cut, hold load, +2–3 RIR |
| Unilateral compound | Standard set cut; can drop one session/week rather than halving every set |
| Large-muscle isolation | Moderate set cut; load held easily, low joint cost |
| Small-muscle isolation | Smallest cut needed; these contribute least systemic fatigue — trim last |

- Cut from the **highest-fatigue categories first**. A "20-set" week of heavy compounds is not the same fatigue as 20 sets of small-muscle isolation; reduce where the systemic cost lives.

---

## 4. DURATION

- **Default: one week (~7 days).** This is the dose used in practice and in the deload literature; it clears accumulated fatigue without entering detraining territory.
- **Detraining margin:** meaningful strength loss generally begins after ~2–3 weeks of *cessation*, and hypertrophy loss later still — a single reduced-volume week (which still trains) is well inside the safe margin. Minimal-volume training maintains strength/size, so a deload week loses nothing.
- **Two-week deloads** are reserved for very deep fatigue or end-of-macrocycle resets, not standard block emission.
- **Relative to block:** the deload is one week *of* the block. A 4-week block = 3 building weeks + 1 deload week. It is never appended on top of the stated week range.

---

## 5. HOW TO EXPRESS IT IN A WEEK-BY-WEEK PLAN (critical for formatting)

**Rules for emission:**

1. The deload is a week **within** the block's declared `week_range` — never an extra week. A 4-week block occupies weeks 1–4; week 4 *is* the deload.
2. By default it is the **LAST week** of the block.
3. That week carries **explicitly reduced per-week set counts** (`sets_weekly` cut ~40–50%) and **higher RIR** (+2–3). These are written into the week's data, not implied.
4. Load is held; do not write a progression increment into the deload week.

### Concrete example — 4-week intermediate block (chest, quads shown)

| Week | Phase | Chest sets_weekly | Quad sets_weekly | RIR | Load |
|---|---|---|---|---|---|
| 1 | Build (≈MEV) | 12 | 14 | 2–3 | base |
| 2 | Build | 15 | 17 | 1–2 | +small |
| 3 | Build (≈MRV) | 18 | 20 | 0–1 | +small |
| 4 | **Deload** | **9** | **10** | **3–4** | hold wk3 |

- Week 4 chest: 18 → 9 effective sets (−50%). Quads: 20 → 10 (−50%). RIR 0–1 → 3–4. Load = week 3 load held, no increment.
- The block is still reported as **weeks 1–4**. Week 4's reduced numbers and raised RIR *are* the deload; no separate "week 5" exists.

### JSON-shape note

A deload is expressed with **two complementary mechanisms — emit BOTH:**

1. **Per-week values (the prescription).** For each exercise in the deload week, emit the reduced `sets_weekly` and the raised `rir_weekly` (and optionally `reps_weekly` held or trimmed) directly on that week's keys. These carry the actual reduced training prescription.
2. **Block-level `deload_weeks` flag (the marker).** Set the block's `deload_weeks` array to the block-relative week number(s) that are deloads — e.g. `deload_weeks: [4]` for a 4-week block whose final week is the deload. This flags the week as a deload for display and downstream logic.

The per-week values and the `deload_weeks` flag are **complementary, not alternatives** — the flag marks *which* week is the deload, the per-week values define *what* the deload does. A downstream formatter reads the reduced prescription from the per-week keys and identifies the week as a deload from the flag. (This matches the JSON conversion schema: see json-prompt.md Schema Rules on deload tagging and `sets_weekly`.)

---

## 6. COMMON MISTAKES

- **Deloading too often** — inserting a deload into short blocks that never approached MRV throws away productive stimulus. Earn the deload by ramping volume first; no ramp, no deload.
- **The "fake" deload** — trimming one or two sets, or only nudging load while keeping sets and RIR near failure. This does not reduce fatigue; it just makes a normal week slightly shorter. A real deload cuts effective volume ~40–50% **and** raises RIR ≥+2.
- **Dropping the deload from a high-volume advanced block** — the case that needs it most. An advanced block ramped to MRV that then rolls straight into the next block compounds fatigue into stalled rep strength and injury risk. Advanced ≥6-week and all 8-week blocks: deload is mandatory.
- **Cutting intensity instead of volume by default** — load drops shed less systemic fatigue and bleed the trained pattern; reserve intensity cuts for joint/connective recovery, not as the primary lever.
- **Appending the deload as an extra week** — breaks the block's `week_range` contract. The deload is the final week *within* the range.
- **Emitting only one of the two deload mechanisms** — writing reduced per-week values but forgetting the `deload_weeks` flag (the week won't be recognised as a deload), or setting the flag but not actually reducing the per-week `sets_weekly`/`rir_weekly` (the "deload" trains like a normal week). Always emit both.

---

## Operating Principles

- Deload = fatigue removal, expressed as the **final week within the block's week range**, never an appended week.
- **Default scheduled**, because JSON.fit emits pre-written plans with no live readiness feed; autoregulation (§2) is documented for tools that have one.
- Frequency is **experience × block-length scaled**: short beginner blocks (≤4 wk) get **no** deload; advanced and all ≥6–8 wk blocks get a mandatory one.
- Default structure: **drop effective volume ~40–50%, hold load, raise RIR +2–3.** Volume is the primary lever; intensity cuts are the exception (joint/connective recovery).
- Cut fatigue where it lives: **heaviest compound categories first**, small-muscle isolation last.
- Duration **one week** — inside the detraining-safe margin; minimal-volume training maintains gains.
- Emit **both** deload mechanisms: reduced `sets_weekly` / raised `rir_weekly` **per-week** (the prescription) **and** the block-level `deload_weeks` flag (the marker). Downstream formatters read the prescription from the data and identify the deload week from the flag.
- A real deload reduces fatigue; a trimmed-but-still-hard week does not.

For full citations see https://json.fit/deload-references.md
