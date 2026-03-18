from __future__ import annotations


TOXIC_FOODS = {"grapes", "raisins", "onions", "garlic", "chocolate", "xylitol", "macadamia nuts"}


def _safe_float(value, default=0.0):
    try:
        return float(value)
    except Exception:
        return default


def _split_terms(text):
    return [x.strip() for x in str(text or "").replace(";", ",").split(",") if x.strip()]


def _safe_items(items, avoid_terms):
    safe = []
    for item in items:
        low = str(item).lower()
        if any(term in low for term in avoid_terms):
            continue
        safe.append(item)
    return safe


def generate_diet_plan(conn, pet_id: int) -> dict:
    cur = conn.cursor()
    cur.execute(
        """
        SELECT Id, Name, Species, Breed, AgeMonths, WeightKg, Allergies, Diseases
        FROM dbo.Pets
        WHERE Id = ?
        """,
        (pet_id,),
    )
    pet = cur.fetchone()
    if not pet:
        raise ValueError("Pet not found.")

    (
        _id,
        name,
        species,
        breed,
        age_months,
        weight_kg,
        allergies,
        diseases,
    ) = pet

    species_l = (species or "").lower()
    weight = _safe_float(weight_kg, 0.0)

    if species_l == "dog":
        calories = 30 * weight + 70
    elif species_l == "cat":
        calories = 40 * weight
    else:
        calories = 35 * weight

    if age_months is not None:
        try:
            age_m = int(age_months)
            if age_m < 12:
                calories *= 1.2
            elif age_m > 96:
                calories *= 0.9
        except Exception:
            pass
    calories = int(round(calories or 0))

    protein_g = int(round((calories * 0.30) / 4)) if calories else 0
    fat_g = int(round((calories * 0.25) / 9)) if calories else 0
    carbs_g = int(round((calories * 0.45) / 4)) if calories else 0
    per_meal = int(round(calories / 2)) if calories else 0

    cur.execute(
        """
        SELECT TOP 1 Status, CreatedAt
        FROM dbo.Vaccinations
        WHERE PetId = ?
        ORDER BY CreatedAt DESC
        """,
        (pet_id,),
    )
    vrow = cur.fetchone()
    vaccine_note = "No recent vaccination recorded."
    if vrow:
        status = (vrow[0] or "").lower()
        if status in ("done", "completed", "given"):
            vaccine_note = f"Last vaccination recorded on {vrow[1]}."
        else:
            vaccine_note = f"Vaccination status: {vrow[0] or 'Due'}."

    cur.execute(
        """
        SELECT TOP 1 Name, EndDate
        FROM dbo.Medications
        WHERE PetId = ?
        ORDER BY CreatedAt DESC
        """,
        (pet_id,),
    )
    mrow = cur.fetchone()
    meds_note = "No active medications recorded."
    if mrow:
        meds_note = f"Medication: {mrow[0]} (end date: {mrow[1] or 'ongoing'})."

    avoid_terms = {x.lower() for x in _split_terms(allergies)}
    avoid_terms.update(x.lower() for x in _split_terms(diseases))
    avoid_terms.update(TOXIC_FOODS)

    dog_breakfast = [
        ["Boiled chicken breast (80g)", "Cooked pumpkin (2 tbsp)"],
        ["Turkey breast (80g)", "Cooked sweet potato (2 tbsp)"],
        ["White fish (85g)", "Cooked brown rice (2 tbsp)"],
        ["Lean beef (75g)", "Steamed zucchini (2 tbsp)"],
        ["Boiled egg (1)", "Cooked quinoa (2 tbsp)"],
        ["Chicken liver (45g)", "Pumpkin puree (2 tbsp)"],
        ["Cottage cheese (60g)", "Cooked oats (2 tbsp)"],
    ]
    dog_dinner = [
        ["Cod fillet (90g)", "Steamed broccoli (2 tbsp)"],
        ["Lean turkey mince (85g)", "Cooked rice (2 tbsp)"],
        ["Chicken thigh (skinless, 85g)", "Steamed carrots (2 tbsp)"],
        ["Lamb lean cuts (75g)", "Cooked quinoa (2 tbsp)"],
        ["White fish (90g)", "Steamed green beans (2 tbsp)"],
        ["Lean beef (80g)", "Cooked pumpkin (2 tbsp)"],
        ["Chicken breast (85g)", "Boiled potato mash (small)"],
    ]
    cat_breakfast = [
        ["Boiled chicken (60g)", "Pumpkin puree (1 tbsp)"],
        ["Turkey breast (60g)", "Steamed zucchini (1 tbsp)"],
        ["White fish (65g)", "Cooked carrot mash (1 tbsp)"],
        ["Egg scramble (1 egg, no oil)", "Pumpkin puree (1 tbsp)"],
        ["Chicken thigh (65g)", "Steamed spinach (1 tbsp)"],
        ["Boiled turkey (60g)", "Cooked peas (1 tbsp)"],
        ["White fish (60g)", "Cooked squash (1 tbsp)"],
    ]
    cat_dinner = [
        ["Cod (70g)", "Cooked pumpkin (1 tbsp)"],
        ["Chicken breast (65g)", "Steamed green beans (1 tbsp)"],
        ["Turkey mince (65g)", "Cooked zucchini (1 tbsp)"],
        ["White fish (70g)", "Cooked rice (1 tbsp)"],
        ["Chicken liver (35g)", "Pumpkin puree (1 tbsp)"],
        ["Turkey breast (65g)", "Cooked carrot mash (1 tbsp)"],
        ["Chicken breast (65g)", "Steamed broccoli (1 tbsp)"],
    ]

    breakfast_options = cat_breakfast if species_l == "cat" else dog_breakfast
    dinner_options = cat_dinner if species_l == "cat" else dog_dinner

    for i in range(7):
        breakfast_options[i] = _safe_items(breakfast_options[i], avoid_terms) or ["Vet-approved breakfast portion"]
        dinner_options[i] = _safe_items(dinner_options[i], avoid_terms) or ["Vet-approved dinner portion"]

    days = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"]
    weekly_plan = []
    for i, day in enumerate(days):
        weekly_plan.append(
            {
                "day": day,
                "meals": [
                    {"name": "Breakfast", "time": "08:00", "items": breakfast_options[i]},
                    {"name": "Dinner", "time": "18:00", "items": dinner_options[i]},
                ],
            }
        )

    daily_meals = [
        {"name": "Breakfast", "time": "08:00", "items": breakfast_options[0], "portion": f"~{per_meal} kcal", "notes": ""},
        {"name": "Dinner", "time": "18:00", "items": dinner_options[0], "portion": f"~{per_meal} kcal", "notes": ""},
    ]

    recommended = []
    for items in breakfast_options + dinner_options:
        for item in items:
            token = str(item).split("(")[0].strip()
            if token and token not in recommended:
                recommended.append(token)

    plan_json = {
        "name": name,
        "species": species,
        "breed": breed,
        "calories": calories,
        "daily_totals": {"calories": calories, "protein_g": protein_g, "meals_count": 2},
        "daily_meals": daily_meals,
        "macros": {"protein_g": protein_g, "fat_g": fat_g, "carbs_g": carbs_g},
        "weekly_plan": weekly_plan,
        "recommended_foods": recommended[:10],
        "avoid_foods": sorted(list(avoid_terms)),
        "notes": [vaccine_note, meds_note],
    }

    import json as _json

    cur.execute(
        """
        INSERT INTO dbo.DietPlans (PetId, Title, Details, Calories, Allergies)
        OUTPUT INSERTED.Id
        VALUES (?, ?, ?, ?, ?)
        """,
        (pet_id, "AI Generated Plan", _json.dumps(plan_json), calories, allergies),
    )
    plan_id = cur.fetchone()[0]

    meal_rows = [
        {"title": "Breakfast", "time": "08:00", "calories": per_meal, "portion": ", ".join(breakfast_options[0])},
        {"title": "Dinner", "time": "18:00", "calories": per_meal, "portion": ", ".join(dinner_options[0])},
    ]
    for m in meal_rows:
        cur.execute(
            """
            INSERT INTO dbo.Meals (PetId, Title, MealTime, Calories, Portion)
            VALUES (?, ?, ?, ?, ?)
            """,
            (pet_id, m["title"], m["time"], m["calories"], m["portion"]),
        )

    conn.commit()

    return {
        "plan_id": plan_id,
        "pet_name": name,
        "calories": calories,
        "daily_totals": {"calories": calories, "protein_g": protein_g, "meals_count": 2},
        "daily_meals": daily_meals,
        "macros": {"protein_g": protein_g, "fat_g": fat_g, "carbs_g": carbs_g},
        "weekly_plan": weekly_plan,
        "recommended_foods": recommended[:10],
        "avoid_foods": sorted(list(avoid_terms)),
        "notes": [vaccine_note, meds_note],
    }
