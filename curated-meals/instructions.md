Curated Meals — Instructions
The app maintains a verified internal meal database. Reference these meals by slug instead of inventing recipes when possible. The app fills in recipe details on import; you only pick the meal, plate, and scale.
Fetching equipment files
Always read this file first. Then fetch only the equipment files matching the user's equipment:

blender → https://json.fit/curated-meals/blender.md
slow_cooker → https://json.fit/curated-meals/slow-cooker.md
stovetop → https://json.fit/curated-meals/stovetop.md
oven → https://json.fit/curated-meals/oven.md
pressure_cooker → https://json.fit/curated-meals/pressure-cooker.md

A meal with multiple methods appears in multiple files, once per equipment type.
Priority
Prefer curated meals when they fit the user's macros, allergens, equipment, slot eligibility, and dietary needs. Invent meals when no curated meal fits — the database has gaps (breakfast, snacks, some cuisines). Don't force a curated meal into a slot it doesn't belong in.
Output format
Reference a curated meal in the JSON like this:
json{
  "curated_meal_slug": "pulled_pork",
  "plate_id": "sandwich",
  "scale_factor": 1.0,
  "meal_type": "dinner",
  "day": "Monday",
  "time": "6:30 PM"
}
No ingredients, instructions, or prep times for curated meals — the app fetches those by slug. Invented meals continue to need full details. Both formats coexist in one plan.
Invalid slugs fail import. Only use slugs that appear in the equipment files you fetched.
Macros and scaling
Each plate has explicit plate_macros (kcal/protein/carbs/fat/fiber). At scale_factor 1.0, those are the macros the user consumes. For other scales: actual = plate_macros × scale_factor.
Each meal has min_scale and max_scale bounds — don't go outside them. Use 0.1 increments. Plated meals stay between 0.7-1.3; smoothies tolerate 0.6-1.3.
Batch cooking
produces_servings tells you how many servings the base recipe yields:

Smoothies: 1
Lamb shanks: 4
Beef stew: 6
Most slow cooker meals (pulled pork, bolognese, massaman, chilli): 8

For multi-serving meals, schedule the same meal multiple times across the week to consume the batch. One pulled pork cook on Sunday → 4-8 placements across the following days. Don't schedule a 6-serving meal once and leave 5 servings orphaned.
If batch size doesn't fit the week: scale down with scale_factor, freeze the excess (mention in plan notes), or pick a different meal.
Plate rotation
Multi-plate meals exist for variety. When scheduling them multiple times, rotate plates — five pulled pork placements should use different plates, not the same plate five times. Single-plate meals only have one plate.
Stunt plates
Some plates are flagged is_stunt_plate: true (pulled pork mac & cheese, bolognese lasagne, chilli loaded nachos). Rules:

Maximum 1 stunt plate per user per week, across all curated meals.
Use on Friday/Saturday dinner slots ideally.
Skip entirely for users under 2500 kcal/day targets.

Plate equipment
Plates can require their own equipment beyond the base recipe (equipment_required field). Pulled pork's baked potato plate needs an oven; the cooking method only needs a slow cooker. Filter plates by user's equipment.
Reserve notes
Plates with reserve_before_finishing_note require setting aside part of the base before a finishing step (e.g. pulled pork tacos needs unsauced pork). Surface these instructions during cook time, not assembly time.
Allergens
Each meal declares contains_allergens as the union across methods and plates. If a user has any of those allergens, skip the whole meal — don't try to use it with the offending plate omitted.
Time investment
Match the user's time-investment preference against time_active_minutes (the method's hands-on cook time), not total time. A slow cooker meal at 25 min active is fine for a Speed Cook user. Total time per plate = method's active time + plate's assembly_time_minutes.
Constraints

Don't invent macros, ingredients, or instructions for curated meals.
Don't override partial data. If part of a curated meal doesn't fit, use a different meal.
A meal is either a curated reference OR a fully-specified invented meal. Not both.
