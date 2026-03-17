from __future__ import annotations

import json
import os
import re
from urllib import error as urllib_error
from urllib import request as urllib_request


WEEK_DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"]


def _extract_json(text: str) -> dict:
    raw = str(text or "").strip()
    if not raw:
        raise ValueError("Gemini returned empty content.")

    try:
        parsed = json.loads(raw)
        if isinstance(parsed, dict):
            return parsed
    except Exception:
        pass

    fenced = re.findall(r"```(?:json)?\s*([\s\S]*?)```", raw, flags=re.IGNORECASE)
    for chunk in fenced:
        chunk = chunk.strip()
        try:
            parsed = json.loads(chunk)
            if isinstance(parsed, dict):
                return parsed
        except Exception:
            continue

    start = raw.find("{")
    end = raw.rfind("}")
    if start != -1 and end != -1 and end > start:
        candidate = raw[start : end + 1]
        try:
            parsed = json.loads(candidate)
            if isinstance(parsed, dict):
                return parsed
        except Exception:
            pass

    raise ValueError("Gemini returned invalid JSON format.")


def _call_gemini(prompt: str) -> str:
    api_key = os.getenv("GEMINI_API_KEY")
    if not api_key:
        raise RuntimeError("GEMINI_API_KEY is missing.")

    configured_model = (os.getenv("GEMINI_MODEL") or "").strip().replace("models/", "")
    models = []
    for name in (
        configured_model,
        "gemini-2.0-flash",
        "gemini-2.0-flash-lite",
        "gemini-2.5-flash",
        "gemini-flash-latest",
    ):
        model = str(name or "").strip()
        if model and model not in models:
            models.append(model)

    last_error = None
    for model in models:
        url = f"https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent?key={api_key}"
        payload = {
            "contents": [{"parts": [{"text": prompt}]}],
            "generationConfig": {
                "temperature": 0.55,
                "topP": 0.9,
                "maxOutputTokens": 2800,
                "responseMimeType": "application/json",
            },
        }
        req = urllib_request.Request(
            url,
            data=json.dumps(payload).encode("utf-8"),
            headers={"Content-Type": "application/json"},
            method="POST",
        )
        try:
            with urllib_request.urlopen(req, timeout=40) as response:
                body = json.loads(response.read().decode("utf-8"))
            candidates = body.get("candidates") or []
            parts = ((candidates[0].get("content") or {}).get("parts") or []) if candidates else []
            text = "".join(p.get("text", "") for p in parts).strip()
            if text:
                return text
            last_error = f"{model}: Gemini returned no content."
        except urllib_error.HTTPError as exc:
            detail = exc.read().decode("utf-8", errors="ignore")
            last_error = f"{model}: {detail}"
            continue
        except Exception as exc:
            last_error = f"{model}: {exc}"
            continue

    raise RuntimeError(f"Gemini request failed across all models. Last error: {last_error}")


def _repair_json_with_gemini(raw_text: str) -> dict:
    repair_prompt = f"""
Convert this content into one valid JSON object only.
Keep all meaningful values. Do not add markdown or explanations.

Content:
{str(raw_text or "").strip()[:7000]}
""".strip()
    repaired = _call_gemini(repair_prompt)
    return _extract_json(repaired)


def _fetch_pet_context(cur, pet_id: int) -> dict:
    cur.execute(
        "SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS "
        "WHERE TABLE_SCHEMA='dbo' AND TABLE_NAME='Pets'"
    )
    existing_cols = {row[0] for row in cur.fetchall()}
    optional_cols = ["ActivityLevel", "FoodRestrictions", "HealthConditions"]
    optional_sql = ", ".join(f"p.{col}" for col in optional_cols if col in existing_cols)
    select_optional = f", {optional_sql}" if optional_sql else ""

    cur.execute(
        f"""
        SELECT p.Id, p.Name, p.Species, p.Breed, p.AgeMonths, p.WeightKg, p.Allergies, p.Diseases
               {select_optional}, u.FullName AS OwnerName
        FROM dbo.Pets p
        JOIN dbo.Users u ON u.Id = p.OwnerId
        WHERE p.Id = ?
        """,
        (pet_id,),
    )
    row = cur.fetchone()
    if not row:
        raise ValueError("Pet not found.")

    cols = [desc[0] for desc in cur.description]
    pet = dict(zip(cols, row))

    cur.execute(
        """
        SELECT TOP 1 ar.Diagnosis, ar.DietRecommendation, ar.GeneralRecommendation
        FROM dbo.AppointmentReports ar
        JOIN dbo.Appointments a ON a.Id = ar.AppointmentId
        WHERE a.PetId = ?
        ORDER BY ar.CreatedAt DESC
        """,
        (pet_id,),
    )
    report = cur.fetchone()
    pet["last_vet_report"] = {
        "diagnosis": report[0] if report else "",
        "diet_recommendation": report[1] if report else "",
        "general_recommendation": report[2] if report else "",
    }
    return pet


def _build_prompt(pet: dict, pantry_items: str) -> str:
    schema = {
        "summary": "short plan summary",
        "daily_totals": {"calories": 0, "protein_g": 0, "meals_count": 2, "water_ml_range": "450-700"},
        "weekly_plan": [
            {
                "day": "Monday",
                "meals": [
                    {"name": "Breakfast", "time": "08:00", "items": ["boiled chicken breast 80g", "pumpkin 2 tbsp"], "portion": "about half daily calories", "notes": "short note"},
                    {"name": "Dinner", "time": "18:00", "items": ["white fish 90g", "brown rice 2 tbsp"], "portion": "about half daily calories", "notes": "short note"},
                ],
            }
        ],
        "recommended_foods": ["specific safe foods"],
        "avoid_foods": ["allergens and toxic foods"],
        "clinical_notes": ["short medical nutrition note"],
        "safety_notes": ["short safety notes"],
    }
    compact_pet = {
        "name": pet.get("Name"),
        "species": pet.get("Species"),
        "breed": pet.get("Breed"),
        "age_months": pet.get("AgeMonths"),
        "weight_kg": float(pet.get("WeightKg") or 0),
        "activity_level": pet.get("ActivityLevel"),
        "allergies": pet.get("Allergies"),
        "food_restrictions": pet.get("FoodRestrictions"),
        "diseases": pet.get("Diseases"),
        "health_conditions": pet.get("HealthConditions"),
        "last_vet_report": pet.get("last_vet_report") or {},
    }
    pantry = (pantry_items or "").strip() or "Not provided"

    return f"""
You are a veterinary nutrition planner.
Return one valid JSON object only. No markdown.

Output schema:
{json.dumps(schema, separators=(",", ":"))}

Pet profile:
{json.dumps(compact_pet, default=str, separators=(",", ":"))}

Pantry items:
{pantry}

Rules:
- Generate exactly 7 days, Monday to Sunday.
- Exactly 2 meals/day: Breakfast and Dinner.
- Use specific ingredient names and amounts.
- No placeholders like "kcal portion" or "balanced meal".
- Keep each day meaningfully different from others.
- Must strictly avoid allergies, restrictions, and toxic foods for the species.
- Use vet diet recommendation when present.
""".strip()


def _to_weekly_plan(data: dict) -> list:
    weekly = data.get("weekly_plan")
    if isinstance(weekly, list) and weekly:
        return weekly

    weekly_alt = data.get("weekly_diet_plan")
    if isinstance(weekly_alt, dict):
        out = []
        for day in WEEK_DAYS:
            block = weekly_alt.get(day) or {}
            breakfast = block.get("breakfast") or {}
            dinner = block.get("dinner") or {}
            out.append(
                {
                    "day": day,
                    "meals": [
                        {
                            "name": "Breakfast",
                            "time": "08:00",
                            "items": breakfast.get("foods") or breakfast.get("items") or [],
                            "portion": "",
                            "notes": breakfast.get("nutrition_note") or "",
                        },
                        {
                            "name": "Dinner",
                            "time": "18:00",
                            "items": dinner.get("foods") or dinner.get("items") or [],
                            "portion": "",
                            "notes": dinner.get("nutrition_note") or "",
                        },
                    ],
                }
            )
        return out
    return []


def _normalize_plan(raw_plan: dict) -> dict:
    weekly_plan = _to_weekly_plan(raw_plan)
    if not weekly_plan:
        raise ValueError("AI plan is missing weekly meal data.")

    normalized_weekly = []
    for idx, day in enumerate(WEEK_DAYS):
        source = weekly_plan[idx] if idx < len(weekly_plan) and isinstance(weekly_plan[idx], dict) else {}
        meals = source.get("meals") if isinstance(source.get("meals"), list) else []
        breakfast = meals[0] if len(meals) > 0 and isinstance(meals[0], dict) else {}
        dinner = meals[1] if len(meals) > 1 and isinstance(meals[1], dict) else {}

        b_items = breakfast.get("items") if isinstance(breakfast.get("items"), list) else []
        d_items = dinner.get("items") if isinstance(dinner.get("items"), list) else []
        if not b_items or not d_items:
            raise ValueError("AI plan did not include complete breakfast/dinner items for all days.")

        normalized_weekly.append(
            {
                "day": day,
                "meals": [
                    {
                        "name": "Breakfast",
                        "time": str(breakfast.get("time") or "08:00"),
                        "items": [str(x).strip() for x in b_items if str(x).strip()],
                        "portion": str(breakfast.get("portion") or ""),
                        "notes": str(breakfast.get("notes") or ""),
                    },
                    {
                        "name": "Dinner",
                        "time": str(dinner.get("time") or "18:00"),
                        "items": [str(x).strip() for x in d_items if str(x).strip()],
                        "portion": str(dinner.get("portion") or ""),
                        "notes": str(dinner.get("notes") or ""),
                    },
                ],
            }
        )

    daily_totals = raw_plan.get("daily_totals") if isinstance(raw_plan.get("daily_totals"), dict) else {}
    summary = str(raw_plan.get("summary") or "AI diet chart generated from current pet profile.")
    return {
        "summary": summary,
        "daily_totals": {
            "calories": int(daily_totals.get("calories") or 0),
            "protein_g": int(daily_totals.get("protein_g") or 0),
            "meals_count": 2,
            "water_ml_range": str(daily_totals.get("water_ml_range") or ""),
        },
        "weekly_plan": normalized_weekly,
        "recommended_foods": raw_plan.get("recommended_foods") or [],
        "avoid_foods": raw_plan.get("avoid_foods") or raw_plan.get("foods_to_avoid") or [],
        "clinical_notes": raw_plan.get("clinical_notes") or [],
        "safety_notes": raw_plan.get("safety_notes") or [],
    }


def generate_weekly_diet_ai(conn, pet_id: int, pantry_items: str = "") -> dict:
    cur = conn.cursor()
    pet = _fetch_pet_context(cur, pet_id)
    prompt = _build_prompt(pet, pantry_items)
    raw = _call_gemini(prompt)
    try:
        parsed = _extract_json(raw)
    except Exception:
        parsed = _repair_json_with_gemini(raw)
    plan = _normalize_plan(parsed)

    calories = int((plan.get("daily_totals") or {}).get("calories") or 0)
    cur.execute(
        """
        INSERT INTO dbo.DietPlans (PetId, Title, Details, Calories, Allergies)
        OUTPUT INSERTED.Id
        VALUES (?, ?, ?, ?, ?)
        """,
        (
            pet_id,
            "AI Weekly Diet Plan",
            json.dumps(plan),
            calories,
            str(pet.get("Allergies") or ""),
        ),
    )
    plan_id = cur.fetchone()[0]
    conn.commit()
    plan["plan_id"] = plan_id
    return plan
