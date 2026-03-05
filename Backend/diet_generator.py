from __future__ import annotations

from datetime import datetime


def _safe_float(value, default=0.0):
    try:
        return float(value)
    except Exception:
        return default


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

    # Base calories by species
    if species_l == "dog":
        calories = 30 * weight + 70
        meals_per_day = 2
    elif species_l == "cat":
        calories = 40 * weight
        meals_per_day = 3
    else:
        calories = 35 * weight
        meals_per_day = 2

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

    # Macros
    protein_g = int(round((calories * 0.30) / 4)) if calories else 0
    fat_g = int(round((calories * 0.25) / 9)) if calories else 0
    carbs_g = int(round((calories * 0.45) / 4)) if calories else 0

    # Recent vaccines
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
        vdate = vrow[1]
        if status in ("done", "completed", "given"):
            vaccine_note = f"Last vaccination recorded on {vdate}."
        else:
            vaccine_note = f"Vaccination status: {vrow[0] or 'Due'}."

    # Recent meds
    cur.execute(
        """
        SELECT TOP 1 Name, EndDate, CreatedAt
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

    # Recent diet plan
    cur.execute(
        """
        SELECT TOP 1 CreatedAt
        FROM dbo.DietPlans
        WHERE PetId = ?
        ORDER BY CreatedAt DESC
        """,
        (pet_id,),
    )
    drow = cur.fetchone()
    diet_note = "No diet plan on record."
    if drow:
        diet_note = f"Last diet plan created on {drow[0]}."

    meals = []
    if meals_per_day == 3:
        times = ["8:00 AM", "1:00 PM", "6:00 PM"]
    else:
        times = ["8:00 AM", "6:00 PM"]

    per_meal = int(round(calories / meals_per_day)) if meals_per_day else 0
    for idx, t in enumerate(times, start=1):
        meals.append(
            {
                "title": f"Meal {idx}",
                "time": t,
                "calories": per_meal,
                "portion": f"{per_meal} kcal portion",
            }
        )

    weekly_plan = []
    days = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"]
    for day in days:
        weekly_plan.append(
            {
                "day": day,
                "meals": [
                    {"name": "Breakfast", "items": [meals[0]["portion"]]},
                    {"name": "Lunch", "items": [meals[0]["portion"]]},
                    {"name": "Dinner", "items": [meals[-1]["portion"]]},
                ],
            }
        )

    plan_json = {
        "name": name,
        "species": species,
        "breed": breed,
        "calories": calories,
        "macros": {"protein_g": protein_g, "fat_g": fat_g, "carbs_g": carbs_g},
        "weekly_plan": weekly_plan,
        "notes": [vaccine_note, meds_note, diet_note],
    }

    # Insert diet plan
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

    # Insert meals
    for m in meals:
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
        "macros": {"protein_g": protein_g, "fat_g": fat_g, "carbs_g": carbs_g},
        "weekly_plan": weekly_plan,
        "notes": [vaccine_note, meds_note, diet_note],
    }
