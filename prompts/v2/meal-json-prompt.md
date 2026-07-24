# Convert Meal Plan to JSON (v2)

## START YOUR RESPONSE WITH THIS EXACT CALLOUT

The VERY FIRST thing in your response must be this callout, formatted as a code block (triple backticks, no language identifier). Do not add anything before it. Reproduce it verbatim:

```
📦 Converting your plan into a JSON.fit file.

This is the last of three steps:
1. ✅ Draft written.
2. ✅ Quality check done.
3. Building your file now — import instructions below.
```

## FORMATTING RULES (CRITICAL)

These rules govern what you WRITE IN CHAT. The JSON schema and examples further down this file are reference material for you — the user never sees them.

Code blocks (triple backticks) in your chat response are RESERVED for the opening callout above and the closing callout at the end. Never paste JSON, schema fragments, or code samples into your visible response. The JSON goes in the file, not in chat.

Between the two callouts, write no more than three or four sentences: what the plan covers, how many entries, and confirmation that macros were carried through unchanged. Then present the file. Nothing else.

---

Please convert the meal plan you just created into a specific JSON format that can be imported into JSON.fit.

**CRITICAL: This is a DATA TRANSFER operation only. NEVER recalculate nutrition values - this causes calorie inflation bugs. Copy the EXACT calories, macros, and ingredient amounts from your reviewed meal plan.**

# MEAL PLANNING STRUCTURE

This JSON format is designed to work directly with the app's simplified meal planning system. The structure uses dates as keys for easy lookup and management.

# CRITICAL: File Output Instructions

**DO NOT output JSON to chat** — it will hit token limits for plans longer than 7 days.

**You MUST:**

1. Create a file (use Code Interpreter on ChatGPT, or computer tool on Claude)
2. **Name the file with a `.json` extension** — for example `meal-plan.json`. This matters: the extension is what lets the user's phone offer JSON.fit as an app to open it with. A file saved without `.json` cannot be imported by tapping.
3. Write the complete JSON structure to the file
4. If you reach output limits, STOP at the end of a complete day, then continue appending to the same file
5. Never stop mid-day or mid-meal
6. When finished, present the file so the user can download it


# JSON Schema Required

```
{
  "id": "string",
  "name": "string",
  "startDate": "string (YYYY-MM-DD format)",
  "endDate": "string (YYYY-MM-DD format)",
  "dailyMeals": {
    "YYYY-MM-DD": {
      "date": "string (YYYY-MM-DD format)",
      "dayName": "string",
      "meals": [
        {
          "id": "string",
          "name": "string",
          "type": "breakfast | brunch | lunch | second_lunch | early_dinner | dinner | snack | morning_snack | afternoon_snack | evening_snack | pre_workout | post_workout",
          "time": "string (HH:MM AM/PM format)",
          "calories": "number",
          "macros": {
            "protein": "number",
            "carbs": "number",
            "fat": "number",
            "fiber": "number"
          },
          "ingredients": [
            {
              "item": "string",
              "amount": "string",
              "unit": "string",
              "notes": "string"
            }
          ],
          "instructions": ["string array"],
          "tags": ["string array"],
          "isOriginal": true,
          "addedAt": "string (ISO date format)"
        }
      ]
    }
  },
  "grocery_list": {
    "total_estimated_cost_low": "number",
    "total_estimated_cost_high": "number",
    "currency": "string",
    "categories": [
      {
        "category_name": "string",
        "items": [
          {
            "item_name": "string",
            "quantity": "string",
            "unit": "string",
            "estimated_price": "number",
            "notes": "string",
            "is_purchased": false,
            "alternatives": [
              {
                "item_name": "string",
                "quantity": "string",
                "unit": "string",
                "estimated_price": "number",
                "notes": "string"
              }
            ]
          }
        ]
      }
    ]
  },
  "metadata": {
    "generatedAt": "string (ISO date format)",
    "totalCost_low": "number",
    "totalCost_high": "number",
    "duration": "number"
  }
}
```

# Curated Meal Output Format

If the reviewed meal plan contains meals referenced by `curated_meal_slug`, those meals use a shorter output format. The app fills in ingredients, instructions, and other recipe details from its internal database using the slug as a lookup key — so this prompt should NOT include ingredients, instructions, or tags for curated meals.

Curated meal entry format:

```
{
  "id": "meal_20260518_dinner",
  "name": "BBQ Pulled Pork Burger",
  "type": "dinner",
  "time": "6:30 PM",
  "calories": 1210,
  "macros": { "protein": 61, "carbs": 76, "fat": 72, "fiber": 4 },
  "curated_meal_slug": "pulled_pork",
  "plate_id": "sandwich",
  "scale_factor": 1.0,
  "isOriginal": true,
  "addedAt": "2026-05-18T18:30:00Z"
}
```

Fields used for curated meals: `id`, `name`, `type`, `time`, `calories`, `macros`, `curated_meal_slug`, `plate_id`, `scale_factor`, `isOriginal`, `addedAt`. Omit `ingredients`, `instructions`, and `tags`.

Both formats (full invented meals and curated meal references) coexist in the same `meals` array. The app detects the format based on the presence of `curated_meal_slug`.

# Adjuster Entries

The reviewed plan may contain standalone adjuster entries (whey scoop, rice side, olive oil, psyllium, etc.) used to land daily targets. They are ordinary meal entries — convert them exactly like everything else, in place, at their stated times. Never strip, merge, or relocate them.

- Adjusters that are curated references (the plan shows a `curated_meal_slug`, plate_id `standard`) use the curated meal entry format above.
- Adjusters written as invented entries use the full invented format — their one-line ingredients and instructions from the plan become single-element arrays. Copy their macros verbatim from the plan.
- Adjuster ingredients are included in the grocery list totals like any other ingredient.


# Field Requirements

## Core Meal Data

| Field | Required | Format | Notes |
|---|---|---|---|
| **id** | Yes | String | Unique identifier for the meal plan |
| **name** | Yes | String | Concise plan name from duration + goal only (e.g., "7-Day Lean Bulk", "14-Day Cut", "5-Day Maintenance"). Do NOT append calorie counts, macro splits, dates, or any parenthetical figures to the name. See the "Plan Name" rule below. |
| **startDate** | Yes | YYYY-MM-DD | Must match first day in dailyMeals |
| **endDate** | Yes | YYYY-MM-DD | Must match last day in dailyMeals |
| **dailyMeals** | Yes | Object | Date-keyed meals (see below) |


## Daily Meal Structure

| Field | Required | Format | Notes |
|---|---|---|---|
| **date** | Yes | YYYY-MM-DD | Must match the object key |
| **dayName** | Yes | String | "Monday", "Tuesday", etc. |
| **meals** | Yes | Array | All meals for this day |


## Individual Meal Structure

| Field | Required | Format | Notes |
|---|---|---|---|
| **id** | Yes | String | Unique meal identifier |
| **name** | Yes | String | Meal name |
| **type** | Yes | Enum | "breakfast", "brunch", "lunch", "second_lunch", "early_dinner", "dinner", "snack", "morning_snack", "afternoon_snack", "evening_snack", "pre_workout", "post_workout" |
| **time** | Yes | String | "7:45 AM", "12:30 PM" format |
| **calories** | Yes | Number | Total calories for this meal |
| **macros.protein** | Yes | Number | Protein in grams |
| **macros.carbs** | Yes | Number | Carbohydrates in grams |
| **macros.fat** | Yes | Number | Fat in grams |
| **macros.fiber** | Yes | Number | Fiber in grams |
| **ingredients** | Conditional | Array | Required for invented meals. Omitted for curated meals. |
| **instructions** | Conditional | Array | Required for invented meals. Omitted for curated meals. |
| **tags** | No | Array | Tags like ["high_protein", "meal_prep"]. Omitted for curated meals. |
| **curated_meal_slug** | Conditional | String | Required for curated meals only. Exact-match lookup key. |
| **plate_id** | Conditional | String | Required for curated meals only. Exact-match lookup key. |
| **scale_factor** | Conditional | Number | Required for curated meals only. Decimal (e.g. 1.0, 0.8). |
| **isOriginal** | Yes | Boolean | Always true for generated meals |
| **addedAt** | Yes | String | ISO timestamp when meal was created |


## Ingredient Structure

| Field | Required | Format | Notes |
|---|---|---|---|
| **item** | Yes | String | Ingredient name |
| **amount** | Yes | String | Quantity as text (e.g., "200", "1/2 cup") |
| **unit** | Yes | String | Unit of measurement |
| **notes** | No | String | Preparation notes, substitutions |


## Grocery List Structure

| Field | Required | Format | Notes |
|---|---|---|---|
| **total_estimated_cost_low** | Yes | Number | Lower bound of estimated cost (sum of all item prices) |
| **total_estimated_cost_high** | Yes | Number | Upper bound with 10% buffer (low × 1.10, rounded up) |
| **currency** | Yes | String | Currency symbol (e.g., "AU$", "$", "£", "€") |
| **categories** | Yes | Array | Grouped grocery items |
| **category_name** | Yes | String | Category like "Meat & Seafood" |
| **items** | Yes | Array | Items in this category |
| **item_name** | Yes | String | Product name |
| **quantity** | Yes | String | Total amount needed |
| **unit** | Yes | String | Unit of measurement |
| **estimated_price** | Yes | Number | Price in local currency |
| **notes** | No | String | Store location notes for items bought outside main grocery store |
| **is_purchased** | Yes | Boolean | Always false (user will check off) |
| **alternatives** | No | Array | 1-2 substitute options for hard-to-find items |


## Alternative Items Structure (within grocery list items)

| Field | Required | Format | Notes |
|---|---|---|---|
| **item_name** | Yes | String | Alternative product name |
| **quantity** | Yes | String | Equivalent amount needed |
| **unit** | Yes | String | Unit of measurement |
| **estimated_price** | Yes | Number | Price in local currency |
| **notes** | No | String | Conversion tips, cooking adjustments for alternatives |


## Metadata Structure

| Field | Required | Format | Notes |
|---|---|---|---|
| **generatedAt** | Yes | String | ISO timestamp when plan was created |
| **totalCost_low** | No | Number | Lower bound of estimated grocery cost |
| **totalCost_high** | No | Number | Upper bound with 10% buffer |
| **duration** | Yes | Number | Total days in the meal plan |


# CRITICAL CONVERSION RULES

## Plan Name

Name the plan from duration and goal only — e.g. "7-Day Lean Bulk", "14-Day Cut", "5-Day Maintenance". Do NOT append calorie counts, macro splits, dates, or any parenthetical figures to the name. The app displays the calorie figure separately on the plan screen, so it must not be baked into the name.

- Correct: `"7-Day Lean Bulk"`
- Wrong: `"7-Day Lean Bulk Plan (3042 kcal)"`, `"7-Day Lean Bulk — 3042 kcal"`, `"7-Day Lean Bulk 26P/39C/35F"`


## Nutrition Value Preservation (MOST IMPORTANT)

- **DO NOT RECALCULATE MACROS** - Copy exact values from the reviewed meal plan
- **DO NOT ADJUST PORTIONS** - Use exact ingredient amounts from the reviewed plan
- **DO NOT SECOND-GUESS CALORIES** - The review process already verified these are correct
- If you see 840 calories in the meal plan, the JSON must show exactly 840 calories
- Any discrepancy between ingredients and stated macros means the STATED MACROS are correct (not the ingredients)
- If ingredients seem inconsistent with macros, DO NOT "fix" them - use the reviewed macro values
- If portion sizes seem "wrong", DO NOT adjust them - use the reviewed portions
- When in doubt, preserve the reviewed plan data exactly as written

This is a transcription step, not a planning step. Do not re-optimise, re-balance, or re-check the plan against targets. Never write a search, solver, or enumeration here — the reviewed plan is final and your only job is to carry it across without altering a number.


## Curated Meal Slug Preservation

- Copy `curated_meal_slug` and `plate_id` values **verbatim** from the reviewed meal plan
- These are exact-match lookup keys for the app's internal database — do not modify, abbreviate, rephrase, or normalize them
- Invalid slugs cause import failures
- `scale_factor` is also copied verbatim as a decimal number


## Date Handling

- Use YYYY-MM-DD format consistently
- Ensure dailyMeals keys match the date field within each day
- Calculate startDate and endDate from the meal plan dates


## ID Generation

- meal plan id: use timestamp-based unique ID
- meal ids: use format "meal_YYYYMMDD_breakfast" etc.


## Grocery List Totaling

- Transfer ingredient quantities from each meal exactly as listed, then sum identical items for grocery totals
- Group by logical shopping categories
- Ensure estimated prices are realistic for the specified store/country
- Remove duplicates and consolidate similar items
- If the meal plan states the grocery total as a range, preserve both bounds: use the lower number for total_estimated_cost_low and the upper number for total_estimated_cost_high
- If the plan only states a single number, set total_estimated_cost_low to that number and total_estimated_cost_high to that number × 1.10 rounded up


## Time Formatting

- Use 12-hour format with AM/PM (e.g., "7:45 AM")
- Be consistent across all meal times


## Array vs String Handling

- ingredients: array of objects
- instructions: array of strings
- tags: array of strings


# EXAMPLE CONVERSION

If the meal plan mentions "200g chicken breast" in 3 different meals, the grocery list should show "600g" total chicken breast, not three separate 200g entries.

If the meal plan says "Cook rice according to package instructions", convert this to specific steps like:

```
"instructions": [
  "Rinse 1 cup jasmine rice until water runs clear",
  "Add rice and 1.5 cups water to pot and bring to boil",
  "Reduce heat to low, cover, and simmer for 18 minutes",
  "Let stand 5 minutes, then fluff with fork"
]
```

# FINAL STEPS

- Complete structure - include all required fields
- Validate JSON - ensure the output is valid, parseable JSON
- Cross-check structure - verify all required fields are present and JSON is valid, preserve all nutrition values exactly as provided
- Confirm the filename ends in `.json`
- Present the file, then close with the callout below

Start the conversion now.

## IF THE USER SAYS THEY CAN'T IMPORT (reference only)

This section is for LATER messages, after you have already delivered the file and the closing callout. Do not volunteer any of it in your conversion response.

If the user comes back saying the import isn't working:

- JSON.fit accepts a `.json` file two ways. Tapping the file and choosing JSON.fit from the iOS share sheet or the Android "Open with" chooser, or opening the app and using the Import screen to pick the saved file. Pasting the file contents into that same Import screen also works.
- If JSON.fit doesn't appear in the chooser, the likely causes are that the file was saved without a `.json` extension, or their installed app version predates file support. The Import screen inside the app always works — send them there.
- If the import screen reports a format error, ask them to paste the exact error text. Do not guess at the cause.
- Do not invent other routes. There is no import link, no QR code, and no share URL for an AI-generated plan. The website's share links only exist for plans already saved in someone's app.

## END YOUR RESPONSE WITH THIS EXACT CALLOUT

The VERY LAST thing in your response must be this callout, formatted as a code block (triple backticks, no language identifier). It comes AFTER the file. Do not add anything after it. Reproduce it verbatim:

```
✅ Your JSON.fit file is ready.

📲 Tap the file above and choose JSON.fit — your plan imports straight in.
📋 No JSON.fit in the list? Save the file, open JSON.fit, and tap Import.
✏️ Want changes? Just tell me what to adjust.
```

This is the end of the flow. Do not offer further steps, and do not ask the user to confirm anything.
