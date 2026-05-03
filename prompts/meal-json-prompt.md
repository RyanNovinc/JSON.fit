# Convert Meal Plan to JSON

Please convert the meal plan you just created into a specific JSON format that can be imported into JSON.fit.

**CRITICAL: This is a DATA TRANSFER operation only. NEVER recalculate nutrition values - this causes calorie inflation bugs. Copy the EXACT calories, macros, and ingredient amounts from your reviewed meal plan.**

# MEAL PLANNING STRUCTURE

This JSON format is designed to work directly with the app's simplified meal planning system. The structure uses dates as keys for easy lookup and management.

# CRITICAL: File Output Instructions

**DO NOT output JSON to chat** — it will hit token limits for plans longer than 7 days.

**You MUST:**
1. Create a file (use Code Interpreter on ChatGPT, or computer tool on Claude)
2. Write the complete JSON structure to the file
3. If you reach output limits, STOP at the end of a complete day, then continue appending to the same file
4. Never stop mid-day or mid-meal
5. When finished, provide the download link

# JSON Schema Required

```json
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
  "meal_prep_sessions": [
    {
      "session_name": "string",
      "prep_time": "number",
      "cook_time": "number",
      "total_time": "number",
      "covers": "string",
      "recommended_timing": "string",
      "recommended_date": "YYYY-MM-DD",
      "equipment_needed": ["string array"],
      "instructions": ["string array"],
      "storage_guidelines": {
        "key": "string value"
      }
    }
  ],
  "metadata": {
    "generatedAt": "string (ISO date format)",
    "totalCost_low": "number",
    "totalCost_high": "number",
    "duration": "number"
  }
}
```

# Field Requirements

## Core Meal Data

| Field | Required | Format | Notes |
|-------|----------|--------|-------|
| **id** | Yes | String | Unique identifier for the meal plan |
| **name** | Yes | String | Descriptive name (e.g., "7-Day Weight Gain Plan") |
| **startDate** | Yes | YYYY-MM-DD | Must match first day in dailyMeals |
| **endDate** | Yes | YYYY-MM-DD | Must match last day in dailyMeals |
| **dailyMeals** | Yes | Object | Date-keyed meals (see below) |

## Daily Meal Structure

| Field | Required | Format | Notes |
|-------|----------|--------|-------|
| **date** | Yes | YYYY-MM-DD | Must match the object key |
| **dayName** | Yes | String | "Monday", "Tuesday", etc. |
| **meals** | Yes | Array | All meals for this day |

## Individual Meal Structure

| Field | Required | Format | Notes |
|-------|----------|--------|-------|
| **id** | Yes | String | Unique meal identifier |
| **name** | Yes | String | Meal name |
| **type** | Yes | Enum | "breakfast", "brunch", "lunch", "second_lunch", "early_dinner", "dinner", "snack", "morning_snack", "afternoon_snack", "evening_snack", "pre_workout", "post_workout" |
| **time** | Yes | String | "7:45 AM", "12:30 PM" format |
| **calories** | Yes | Number | Total calories for this meal |
| **macros.protein** | Yes | Number | Protein in grams |
| **macros.carbs** | Yes | Number | Carbohydrates in grams |
| **macros.fat** | Yes | Number | Fat in grams |
| **macros.fiber** | Yes | Number | Fiber in grams |
| **ingredients** | Yes | Array | All ingredients with amounts |
| **instructions** | Yes | Array | Step-by-step cooking instructions |
| **tags** | No | Array | Tags like ["high_protein", "meal_prep"] |
| **isOriginal** | Yes | Boolean | Always true for generated meals |
| **addedAt** | Yes | String | ISO timestamp when meal was created |

## Ingredient Structure

| Field | Required | Format | Notes |
|-------|----------|--------|-------|
| **item** | Yes | String | Ingredient name |
| **amount** | Yes | String | Quantity as text (e.g., "200", "1/2 cup") |
| **unit** | Yes | String | Unit of measurement |
| **notes** | No | String | Preparation notes, substitutions |

## Grocery List Structure

| Field | Required | Format | Notes |
|-------|----------|--------|-------|
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
|-------|----------|--------|-------|
| **item_name** | Yes | String | Alternative product name |
| **quantity** | Yes | String | Equivalent amount needed |
| **unit** | Yes | String | Unit of measurement |
| **estimated_price** | Yes | Number | Price in local currency |
| **notes** | No | String | Conversion tips, cooking adjustments for alternatives |

## Meal Prep Sessions Structure

| Field | Required | Format | Notes |
|-------|----------|--------|-------|
| **session_name** | Yes | String | e.g., "Sunday Meal Prep" |
| **prep_time** | Yes | Number | Active prep time in minutes |
| **cook_time** | Yes | Number | Passive cooking time in minutes |
| **total_time** | Yes | Number | prep_time + cook_time |
| **covers** | Yes | String | Concise description (max 6 words): "21 meals across 7 days" format |
| **recommended_timing** | Yes | String | When to do the prep |
| **recommended_date** | Yes | String | Calendar date in YYYY-MM-DD format |
| **equipment_needed** | Yes | Array | Required equipment |
| **instructions** | Yes | Array | Step-by-step prep instructions |
| **storage_guidelines** | Yes | Object | How long items last |

## Metadata Structure

| Field | Required | Format | Notes |
|-------|----------|--------|-------|
| **generatedAt** | Yes | String | ISO timestamp when plan was created |
| **totalCost_low** | No | Number | Lower bound of estimated grocery cost |
| **totalCost_high** | No | Number | Upper bound with 10% buffer |
| **duration** | Yes | Number | Total days in the meal plan |

# CRITICAL CONVERSION RULES

## Nutrition Value Preservation (MOST IMPORTANT)

- **DO NOT RECALCULATE MACROS** - Copy exact values from the reviewed meal plan
- **DO NOT ADJUST PORTIONS** - Use exact ingredient amounts from the reviewed plan
- **DO NOT SECOND-GUESS CALORIES** - The review process already verified these are correct
- If you see 840 calories in the meal plan, the JSON must show exactly 840 calories
- Any discrepancy between ingredients and stated macros means the STATED MACROS are correct (not the ingredients)
- If ingredients seem inconsistent with macros, DO NOT "fix" them - use the reviewed macro values
- If portion sizes seem "wrong", DO NOT adjust them - use the reviewed portions
- When in doubt, preserve the reviewed plan data exactly as written

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
- equipment_needed: array of strings

# EXAMPLE CONVERSION

If the meal plan mentions "200g chicken breast" in 3 different meals, the grocery list should show "600g" total chicken breast, not three separate 200g entries.

If the meal plan says "Cook rice according to package instructions", convert this to specific steps like:

```json
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

Start the conversion now.
