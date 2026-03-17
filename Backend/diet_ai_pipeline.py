from __future__ import annotations

import json
import os
import re
from urllib import error as urllib_error
from urllib import request as urllib_request


WEEK_DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"]


class DietPlanFormatError(ValueError):
    def __init__(self, message, raw_model_output=None, parsed_model_output=None):
        super().__init__(message)
        self.raw_model_output = raw_model_output
        self.parsed_model_output = parsed_model_output


def _safe_json_load(text):
    try:
        parsed = json.loads(text)
        if isinstance(parsed, dict):
            return parsed
        if isinstance(parsed, list) and parsed and isinstance(parsed[0], dict):
            return parsed[0]
    except Exception:
        return None
    return None


def _cleanup_json_like(text):
    cleaned = str(text or "")
    cleaned = cleaned.replace("\u201c", '"').replace("\u201d", '"').replace("\u2018", "'").replace("\u2019", "'")
    cleaned = cleaned.replace("\ufeff", "").strip()
    cleaned = re.sub(r",\s*([}\]])", r"\1", cleaned)
    return cleaned


def _extract_json(text):
    raw = str(text or "").strip()
    if not raw:
        raise ValueError("Gemini returned empty content.")

    parsed = _safe_json_load(raw)
    if parsed:
        return parsed

    fenced = re.findall(r"```(?:json)?\s*([\s\S]*?)```", raw, flags=re.IGNORECASE)
    for chunk in fenced:
        parsed = _safe_json_load(chunk.strip()) or _safe_json_load(_cleanup_json_like(chunk))
        if parsed:
            return parsed

    # Try extracting any valid JSON object substring via brace matching.
    starts = [idx for idx, ch in enumerate(raw) if ch == "{"]
    for start in starts:
        depth = 0
        in_string = False
        escape = False
        for i in range(start, len(raw)):
            ch = raw[i]
            if in_string:
                if escape:
                    escape = False
                elif ch == "\\":
                    escape = True
                elif ch == '"':
                    in_string = False
                continue
            if ch == '"':
                in_string = True
            elif ch == "{":
                depth += 1
            elif ch == "}":
                depth -= 1
                if depth == 0:
                    candidate = raw[start : i + 1]
                    parsed = _safe_json_load(candidate) or _safe_json_load(_cleanup_json_like(candidate))
                    if parsed:
                        return parsed
                    break

    parsed = _safe_json_load(_cleanup_json_like(raw))
    if parsed:
        return parsed

    raise ValueError("Gemini returned invalid JSON format.")


def _call_gemini(prompt):
    api_key = os.getenv("GEMINI_API_KEY")
    if not api_key:
        raise RuntimeError("GEMINI_API_KEY is missing.")

    configured = str(os.getenv("GEMINI_MODEL") or "").strip().replace("models/", "")
    models = []
    for name in (
        configured,
        "gemini-2.0-flash-lite",
        "gemini-2.0-flash",
        "gemini-3-flash",
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
                "temperature": 0.5,
                "topP": 0.9,
                "maxOutputTokens": 2600,
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
            with urllib_request.urlopen(req, timeout=75) as response:
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


def _repair_json_with_gemini(raw_text):
    prompt = f"""
Convert this into one valid JSON object only.
Do not add explanation or markdown fences.

{str(raw_text or "").strip()[:7000]}
""".strip()
    return _extract_json(_call_gemini(prompt))


def _regenerate_json_with_gemini(prompt):
    strict_prompt = f"""
Return one strict JSON object only.
No markdown fences. No commentary. No trailing commas.

{prompt}
""".strip()
    return _extract_json(_call_gemini(strict_prompt))


def _fill_weekly_plan_with_gemini(parsed_plan, pet, pantry_items):
    compact_pet = {
        "name": pet.get("Name"),
        "species": pet.get("Species"),
        "breed": pet.get("Breed"),
        "age_months": pet.get("AgeMonths"),
        "weight_kg": float(pet.get("WeightKg") or 0),
        "allergies": pet.get("Allergies"),
        "food_restrictions": pet.get("FoodRestrictions"),
        "diseases": pet.get("Diseases"),
        "health_conditions": pet.get("HealthConditions"),
        "last_vet_report": pet.get("last_vet_report"),
    }
    pantry = (pantry_items or "").strip() or "Not provided"
    prompt = f"""
You are filling missing weekly meal data for a veterinary diet plan.
Return one strict JSON object only with this shape:
{{
  "weekly_plan": [
    {{
      "day": "Monday",
      "meals": [
        {{"name":"Breakfast","time":"08:00","items":["food with amount"],"portion":"...","notes":"..."}},
        {{"name":"Dinner","time":"18:00","items":["food with amount"],"portion":"...","notes":"..."}}
      ]
    }}
  ]
}}

Rules:
- Exactly 7 days from Monday to Sunday.
- Exactly 2 meals/day: Breakfast and Dinner.
- Use real food names with quantities.
- Vary meals across days.
- Avoid allergens/restrictions/toxic foods.

Pet profile:
{json.dumps(compact_pet, default=str, separators=(",", ":"))}
Pantry items:
{pantry}
Existing partial plan:
{json.dumps(parsed_plan, default=str, separators=(",", ":"))}
""".strip()
    return _extract_json(_call_gemini(prompt))


def _fetch_pet_context(cur, pet_id):
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
        SELECT p.Id, p.OwnerId, p.Name, p.Species, p.Breed, p.AgeMonths, p.WeightKg, p.Allergies, p.Diseases
               {select_optional}
        FROM dbo.Pets p
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


def _build_prompt(pet, pantry_items):
    schema = {
        "summary": "short overview",
        "daily_totals": {"calories": 0, "protein_g": 0, "meals_count": 2, "water_ml_range": "450-700 ml"},
        "weekly_plan": [
            {
                "day": "Monday",
                "meals": [
                    {"name": "Breakfast", "time": "08:00", "items": ["boiled chicken 80g", "pumpkin 2 tbsp"], "portion": "half day calories", "notes": "short note"},
                    {"name": "Dinner", "time": "18:00", "items": ["white fish 90g", "brown rice 2 tbsp"], "portion": "half day calories", "notes": "short note"},
                ],
            }
        ],
        "recommended_foods": ["specific safe foods"],
        "avoid_foods": ["allergens and toxic foods"],
        "clinical_notes": ["short notes"],
        "safety_notes": ["short notes"],
    }
    profile = {
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
        "last_vet_report": pet.get("last_vet_report"),
    }
    pantry = (pantry_items or "").strip() or "Not provided"
    return f"""
You are a veterinary nutrition planner.
Return JSON only.

Output schema:
{json.dumps(schema, separators=(",", ":"))}

Pet profile:
{json.dumps(profile, default=str, separators=(",", ":"))}

Pantry items:
{pantry}

Rules:
- Exactly 7 days (Monday-Sunday).
- Exactly 2 meals per day: Breakfast and Dinner.
- Use real food names and amounts (no placeholders).
- Ensure day-wise variation.
- Strictly avoid allergens/restrictions/toxic foods.
""".strip()


def _items_list(value):
    if isinstance(value, list):
        return [str(x).strip() for x in value if str(x).strip()]
    if isinstance(value, str):
        return [x.strip() for x in value.replace(";", ",").split(",") if x.strip()]
    if isinstance(value, dict):
        return _items_list(value.get("foods") or value.get("items") or [])
    return []


def _find_meal(meals, preferred, fallback_idx):
    preferred = preferred.lower()
    if isinstance(meals, list):
        for meal in meals:
            if isinstance(meal, dict) and preferred in str(meal.get("name") or "").lower():
                return meal
        if len(meals) > fallback_idx and isinstance(meals[fallback_idx], dict):
            return meals[fallback_idx]
    return {}


def _normalize_day(day_name, day_block):
    day_block = day_block if isinstance(day_block, dict) else {}
    meals = day_block.get("meals")
    if isinstance(meals, dict):
        meals = [
            {"name": "Breakfast", **(meals.get("breakfast") or {})},
            {"name": "Dinner", **(meals.get("dinner") or {})},
        ]
    elif not isinstance(meals, list):
        meals = []

    breakfast = _find_meal(meals, "breakfast", 0) or day_block.get("breakfast") or {}
    dinner = _find_meal(meals, "dinner", 1) or day_block.get("dinner") or {}
    return {
        "day": day_name,
        "meals": [
            {
                "name": "Breakfast",
                "time": str(breakfast.get("time") or "08:00"),
                "items": _items_list(breakfast.get("items") if isinstance(breakfast, dict) else breakfast),
                "portion": str(breakfast.get("portion") or ""),
                "notes": str(breakfast.get("notes") or breakfast.get("nutrition_note") or ""),
            },
            {
                "name": "Dinner",
                "time": str(dinner.get("time") or "18:00"),
                "items": _items_list(dinner.get("items") if isinstance(dinner, dict) else dinner),
                "portion": str(dinner.get("portion") or ""),
                "notes": str(dinner.get("notes") or dinner.get("nutrition_note") or ""),
            },
        ],
    }


def _extract_weekly_plan(parsed):
    # Top-level day keys
    lowered = {str(k).strip().lower(): v for k, v in parsed.items()}
    if any(day.lower() in lowered for day in WEEK_DAYS):
        return [_normalize_day(day, lowered.get(day.lower()) or lowered.get(day[:3].lower()) or {}) for day in WEEK_DAYS]

    # Common containers
    for key in ("weekly_plan", "weekly_diet_plan", "week_plan", "week", "diet_plan", "plan"):
        value = parsed.get(key)
        if isinstance(value, list) and value:
            out = []
            for idx, row in enumerate(value[:7]):
                day_name = str((row or {}).get("day") or WEEK_DAYS[min(idx, 6)]).strip() or WEEK_DAYS[min(idx, 6)]
                out.append(_normalize_day(day_name, row or {}))
            if out:
                return out
        if isinstance(value, dict) and value:
            index = {str(k).strip().lower(): v for k, v in value.items()}
            return [_normalize_day(day, index.get(day.lower()) or index.get(day[:3].lower()) or {}) for day in WEEK_DAYS]

    # Fallback derive from daily meals
    daily_meals = parsed.get("daily_meals")
    if isinstance(daily_meals, list) and len(daily_meals) >= 2:
        breakfast = _find_meal(daily_meals, "breakfast", 0)
        dinner = _find_meal(daily_meals, "dinner", 1)
        if _items_list(breakfast.get("items")) and _items_list(dinner.get("items")):
            return [
                {
                    "day": day,
                    "meals": [
                        {
                            "name": "Breakfast",
                            "time": str(breakfast.get("time") or "08:00"),
                            "items": _items_list(breakfast.get("items")),
                            "portion": str(breakfast.get("portion") or ""),
                            "notes": str(breakfast.get("notes") or ""),
                        },
                        {
                            "name": "Dinner",
                            "time": str(dinner.get("time") or "18:00"),
                            "items": _items_list(dinner.get("items")),
                            "portion": str(dinner.get("portion") or ""),
                            "notes": str(dinner.get("notes") or ""),
                        },
                    ],
                }
                for day in WEEK_DAYS
            ]
    return []


def _normalize_plan(parsed, raw):
    weekly = _extract_weekly_plan(parsed)
    if not weekly:
        raise DietPlanFormatError("AI plan is missing weekly meal data.", raw_model_output=raw, parsed_model_output=parsed)

    normalized = []
    first_breakfast = []
    first_dinner = []
    for day_block in weekly:
        meals = day_block.get("meals") if isinstance(day_block, dict) else []
        if not isinstance(meals, list) or len(meals) < 2:
            continue
        b = meals[0]
        d = meals[1]
        b_items = _items_list(b.get("items"))
        d_items = _items_list(d.get("items"))
        if b_items and not first_breakfast:
            first_breakfast = b_items
        if d_items and not first_dinner:
            first_dinner = d_items
        normalized.append((day_block.get("day"), b, d))

    if not normalized:
        raise DietPlanFormatError("AI plan did not include complete breakfast/dinner items.", raw_model_output=raw, parsed_model_output=parsed)

    weekly_plan = []
    for idx, day in enumerate(WEEK_DAYS):
        source = normalized[idx] if idx < len(normalized) else normalized[-1]
        _, b, d = source
        b_items = _items_list(b.get("items")) or first_breakfast
        d_items = _items_list(d.get("items")) or first_dinner
        if not b_items or not d_items:
            raise DietPlanFormatError("AI plan meals are incomplete after normalization.", raw_model_output=raw, parsed_model_output=parsed)
        weekly_plan.append(
            {
                "day": day,
                "meals": [
                    {
                        "name": "Breakfast",
                        "time": str(b.get("time") or "08:00"),
                        "items": b_items,
                        "portion": str(b.get("portion") or ""),
                        "notes": str(b.get("notes") or ""),
                    },
                    {
                        "name": "Dinner",
                        "time": str(d.get("time") or "18:00"),
                        "items": d_items,
                        "portion": str(d.get("portion") or ""),
                        "notes": str(d.get("notes") or ""),
                    },
                ],
            }
        )

    daily_totals = parsed.get("daily_totals") if isinstance(parsed.get("daily_totals"), dict) else {}
    summary = str(parsed.get("summary") or "Weekly AI diet chart generated.")
    daily_meals = weekly_plan[0]["meals"]
    protein_value = int(daily_totals.get("protein_g") or 0)
    calories_value = int(daily_totals.get("calories") or 0)
    nutrition_breakdown = parsed.get("nutrition_breakdown") if isinstance(parsed.get("nutrition_breakdown"), list) else []
    if not nutrition_breakdown:
        nutrition_breakdown = [
            {"label": "Calories", "value": calories_value},
            {"label": "Protein", "value": protein_value},
        ]
    return {
        "summary": summary,
        "daily_totals": {
            "calories": calories_value,
            "protein_g": protein_value,
            "meals_count": 2,
            "water_ml_range": str(daily_totals.get("water_ml_range") or ""),
        },
        "daily_meals": daily_meals,
        "weekly_plan": weekly_plan,
        "nutrition_breakdown": nutrition_breakdown,
        "recommended_foods": parsed.get("recommended_foods") or [],
        "avoid_foods": parsed.get("avoid_foods") or parsed.get("foods_to_avoid") or [],
        "clinical_notes": parsed.get("clinical_notes") or [],
        "safety_notes": parsed.get("safety_notes") or [],
    }


def generate_weekly_diet_ai(conn, pet_id, pantry_items="", include_raw=False):
    cur = conn.cursor()
    pet = _fetch_pet_context(cur, pet_id)
    prompt = _build_prompt(pet, pantry_items)
    raw = _call_gemini(prompt)
    try:
        parsed = _extract_json(raw)
    except Exception:
        try:
            parsed = _repair_json_with_gemini(raw)
        except Exception:
            parsed = _regenerate_json_with_gemini(prompt)

    try:
        plan = _normalize_plan(parsed, raw)
    except DietPlanFormatError as exc:
        if "weekly meal data" not in str(exc).lower():
            raise
        patch = _fill_weekly_plan_with_gemini(parsed, pet, pantry_items)
        merged = dict(parsed)
        if isinstance(patch, dict):
            if isinstance(patch.get("weekly_plan"), (list, dict)):
                merged["weekly_plan"] = patch.get("weekly_plan")
            if isinstance(patch.get("weekly_diet_plan"), dict):
                merged["weekly_diet_plan"] = patch.get("weekly_diet_plan")
        plan = _normalize_plan(merged, raw)

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

    if include_raw:
        return {
            "plan": plan,
            "raw_model_output": raw,
            "parsed_model_output": parsed,
        }
    return plan
