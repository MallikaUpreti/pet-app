from flask import Blueprint, render_template, session, request, redirect, url_for, flash, Response, stream_with_context
import json
import time
from auth_utils import role_required
from db import get_connection, fetchall_dict, fetchone_dict
from diet_generator import generate_diet_plan

owner_bp = Blueprint("owner", __name__)

@owner_bp.route("/owner", methods=["GET", "POST"])
@role_required("owner")
def owner_home():
    owner_id = session["user_id"]

    conn = get_connection()
    cur = conn.cursor()
    if request.method == "POST":
        name = (request.form.get("name") or "").strip()
        species = (request.form.get("species") or "").strip()
        breed = (request.form.get("breed") or "").strip() or None
        age_months = (request.form.get("age_months") or "").strip() or None
        weight_kg = (request.form.get("weight_kg") or "").strip() or None
        allergies = (request.form.get("allergies") or "").strip() or None
        diseases = (request.form.get("diseases") or "").strip() or None
        photo_url = (request.form.get("photo_url") or "").strip() or None

        if not name or not species:
            flash("Pet name and species are required.", "error")
        else:
            try:
                cur.execute(
                    """
                    INSERT INTO dbo.Pets
                      (OwnerId, Name, Species, Breed, AgeMonths, WeightKg, Allergies, Diseases, PhotoUrl)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
                    """,
                    (
                        owner_id,
                        name,
                        species,
                        breed,
                        int(age_months) if age_months else None,
                        float(weight_kg) if weight_kg else None,
                        allergies,
                        diseases,
                        photo_url,
                    ),
                )
                conn.commit()
                flash("Pet added.", "success")
                return redirect(url_for("owner.owner_home"))
            except Exception as e:
                conn.rollback()
                flash(f"Failed to add pet: {e}", "error")
    cur.execute("""
        SELECT Id, Name, Species, Breed, AgeMonths, WeightKg, Allergies, Diseases, PhotoUrl, CreatedAt
        FROM dbo.Pets
        WHERE OwnerId = ?
        ORDER BY CreatedAt DESC
    """, (owner_id,))
    pets = fetchall_dict(cur)

    cur.execute(
        """
        SELECT a.Id, a.Type, a.Status, a.StartTime, a.EndTime, a.Notes,
               u.FullName AS VetName
        FROM dbo.Appointments a
        JOIN dbo.Users u ON u.Id = a.VetUserId
        WHERE a.OwnerId = ?
        ORDER BY a.StartTime DESC
        """,
        (owner_id,),
    )
    appts = fetchall_dict(cur)

    # Dashboard metrics
    from datetime import datetime, timedelta
    now = datetime.now()
    upcoming = []
    for a in appts:
        start = a.get("StartTime")
        if start and hasattr(start, "year"):
            if start >= now and a.get("Status") in ("Scheduled", "Pending", "In Progress"):
                upcoming.append(a)

    def weight_score(species, weight_kg):
        if not weight_kg:
            return 60
        avg = {
            "dog": 20.0,
            "cat": 4.5,
            "bird": 0.5,
            "rabbit": 2.0,
            "other": 10.0,
        }.get((species or "").lower(), 10.0)
        ratio = float(weight_kg) / avg if avg else 1.0
        if 0.8 <= ratio <= 1.2:
            return 100
        if 0.65 <= ratio <= 1.35:
            return 70
        return 40

    pet_scores = {}
    for pet in pets:
        pet_id = pet["Id"]
        # Vaccines
        cur.execute(
            """
            SELECT TOP 1 CreatedAt, Status
            FROM dbo.Vaccinations
            WHERE PetId = ?
            ORDER BY CreatedAt DESC
            """,
            (pet_id,),
        )
        vrow = cur.fetchone()
        vaccine_score = 0
        if vrow:
            vdate = vrow[0]
            vstatus = (vrow[1] or "").lower()
            if vstatus in ("done", "completed", "given"):
                days = (now - vdate).days if hasattr(vdate, "day") else 999
                vaccine_score = 100 if days <= 365 else 40
            else:
                vaccine_score = 20

        # Meds
        cur.execute(
            """
            SELECT TOP 1 EndDate, CreatedAt
            FROM dbo.Medications
            WHERE PetId = ?
            ORDER BY CreatedAt DESC
            """,
            (pet_id,),
        )
        mrow = cur.fetchone()
        meds_score = 90
        if mrow:
            end_date = mrow[0]
            if end_date and hasattr(end_date, "day") and end_date < now.date():
                meds_score = 70
            else:
                meds_score = 100

        # Diet
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
        diet_score = 50
        if drow and drow[0]:
            days = (now - drow[0]).days if hasattr(drow[0], "day") else 999
            diet_score = 100 if days <= 60 else 70

        w_score = weight_score(pet.get("Species"), pet.get("WeightKg"))
        total = round(0.15 * w_score + 0.35 * vaccine_score + 0.30 * meds_score + 0.20 * diet_score)
        pet_scores[pet_id] = total

    health_score = round(sum(pet_scores.values()) / len(pet_scores)) if pet_scores else 0
    conn.close()

    return render_template(
        "owner_home.html",
        pets=pets,
        appts=appts,
        upcoming=upcoming,
        health_score=health_score,
        pet_scores=pet_scores,
        now=now,
    )


@owner_bp.route("/owner/vets", methods=["GET", "POST"])
@role_required("owner")
def owner_vets():
    owner_id = session["user_id"]
    conn = get_connection()
    cur = conn.cursor()

    if request.method == "POST":
        vet_user_id = request.form.get("vet_user_id")
        pet_id = request.form.get("pet_id") or session.get("active_pet_id")
        message = (request.form.get("message") or "").strip() or None
        if not vet_user_id:
            flash("Select a vet.", "error")
        else:
            if pet_id:
                session["active_pet_id"] = int(pet_id)
            cur.execute(
                """
                INSERT INTO dbo.ChatRequests (OwnerId, VetUserId, PetId, Message, Status)
                VALUES (?, ?, ?, ?, 'Pending')
                """,
                (owner_id, vet_user_id, pet_id, message),
            )
            conn.commit()
            flash("Chat request sent.", "success")
    cur.execute(
        """
        SELECT u.Id, u.FullName, u.Email, u.Phone,
               v.ClinicName, v.LicenseNo, v.ClinicPhone, v.Bio, v.IsOnline
        FROM dbo.Users u
        LEFT JOIN dbo.VetProfiles v ON v.UserId = u.Id
        WHERE u.Role = 'vet' AND v.IsOnline = 1
        ORDER BY u.FullName
        """
    )
    vets = fetchall_dict(cur)
    conn.close()
    return render_template("owner_vets.html", vets=vets, active_pet_id=session.get("active_pet_id"))


@owner_bp.route("/owner/appointments", methods=["GET", "POST"])
@role_required("owner")
def owner_appointments():
    owner_id = session["user_id"]
    conn = get_connection()
    cur = conn.cursor()

    active_pet_id = session.get("active_pet_id")

    if request.method == "POST":
        pet_id = request.form.get("pet_id")
        vet_user_id = request.form.get("vet_user_id")
        appt_type = (request.form.get("type") or "Consultation").strip()
        start_time = request.form.get("start_time")
        notes = (request.form.get("notes") or "").strip() or None

        if not pet_id or not vet_user_id or not start_time:
            flash("Pet, vet, and start time are required.", "error")
        else:
            try:
                from datetime import datetime
                try:
                    start_dt = datetime.fromisoformat(start_time)
                except ValueError:
                    try:
                        start_dt = datetime.strptime(start_time, "%Y-%m-%dT%H:%M")
                    except ValueError:
                        flash("Invalid start time format. Please reselect.", "error")
                        return redirect(url_for("owner.owner_appointments"))

                # verify pet belongs to owner
                cur.execute("SELECT OwnerId FROM dbo.Pets WHERE Id = ?", (pet_id,))
                row = cur.fetchone()
                try:
                    owner_id_int = int(owner_id)
                except Exception:
                    owner_id_int = owner_id
                if not row or row[0] != owner_id_int:
                    flash("Selected pet is not yours.", "error")
                    return redirect(url_for("owner.owner_appointments"))

                cur.execute(
                    """
                    INSERT INTO dbo.Appointments
                      (OwnerId, VetUserId, PetId, Type, Status, StartTime, Notes)
                    VALUES (?, ?, ?, ?, 'Pending', ?, ?)
                    """,
                    (owner_id, vet_user_id, pet_id, appt_type, start_dt, notes),
                )
                conn.commit()
                session["active_pet_id"] = int(pet_id)
                flash("Appointment booked.", "success")
                return redirect(url_for("owner.owner_appointments"))
            except Exception as e:
                conn.rollback()
                flash(f"Failed to book: {e}", "error")

    if active_pet_id:
        cur.execute(
            """
            SELECT a.Id, a.Type, a.Status, a.StartTime, a.EndTime, a.Notes,
                   p.Name AS PetName, u.FullName AS VetName
            FROM dbo.Appointments a
            JOIN dbo.Pets p ON p.Id = a.PetId
            JOIN dbo.Users u ON u.Id = a.VetUserId
            WHERE a.OwnerId = ? AND a.PetId = ?
            ORDER BY a.StartTime DESC
            """,
            (owner_id, active_pet_id),
        )
    else:
        cur.execute(
            """
            SELECT a.Id, a.Type, a.Status, a.StartTime, a.EndTime, a.Notes,
                   p.Name AS PetName, u.FullName AS VetName
            FROM dbo.Appointments a
            JOIN dbo.Pets p ON p.Id = a.PetId
            JOIN dbo.Users u ON u.Id = a.VetUserId
            WHERE a.OwnerId = ?
            ORDER BY a.StartTime DESC
            """,
            (owner_id,),
        )
    appts = fetchall_dict(cur)

    cur.execute(
        """
        SELECT Id, Name FROM dbo.Pets WHERE OwnerId = ? ORDER BY Name
        """,
        (owner_id,),
    )
    pets = fetchall_dict(cur)
    if pets:
        if active_pet_id:
            if not any(str(p["Id"]) == str(active_pet_id) for p in pets):
                active_pet_id = None
        if not active_pet_id:
            session["active_pet_id"] = pets[0]["Id"]
            active_pet_id = session["active_pet_id"]

    cur.execute(
        """
        SELECT u.Id, u.FullName, v.ClinicName
        FROM dbo.Users u
        LEFT JOIN dbo.VetProfiles v ON v.UserId = u.Id
        WHERE u.Role='vet'
        ORDER BY u.FullName
        """
    )
    vets = fetchall_dict(cur)

    conn.close()
    from datetime import datetime, timedelta
    now = datetime.now()
    week = [now + timedelta(days=i) for i in range(7)]
    return render_template(
        "owner_appointments.html",
        appts=appts,
        pets=pets,
        vets=vets,
        now=now,
        today=now,
        week=week,
        active_pet_id=active_pet_id,
    )


@owner_bp.get("/owner/appointments/<int:appt_id>")
@role_required("owner")
def owner_appt_detail(appt_id):
    owner_id = session["user_id"]
    conn = get_connection()
    cur = conn.cursor()
    cur.execute(
        """
        SELECT a.Id, a.Type, a.Status, a.StartTime, a.EndTime, a.Notes,
               p.Name AS PetName, u.FullName AS VetName, a.OwnerId
        FROM dbo.Appointments a
        JOIN dbo.Pets p ON p.Id = a.PetId
        JOIN dbo.Users u ON u.Id = a.VetUserId
        WHERE a.Id = ?
        """,
        (appt_id,),
    )
    appt = fetchone_dict(cur)
    conn.close()
    if not appt or str(appt["OwnerId"]) != str(owner_id):
        flash("Appointment not found.", "error")
        return redirect(url_for("owner.owner_appointments"))
    return render_template("appointment_detail.html", appt=appt)


@owner_bp.route("/owner/appointments/<int:appt_id>/reschedule", methods=["GET", "POST"])
@role_required("owner")
def owner_reschedule(appt_id):
    owner_id = session["user_id"]
    conn = get_connection()
    cur = conn.cursor()
    cur.execute(
        """
        SELECT a.Id, a.StartTime, p.Name AS PetName, u.FullName AS VetName, a.OwnerId
        FROM dbo.Appointments a
        JOIN dbo.Pets p ON p.Id = a.PetId
        JOIN dbo.Users u ON u.Id = a.VetUserId
        WHERE a.Id = ?
        """,
        (appt_id,),
    )
    appt = fetchone_dict(cur)
    if not appt or str(appt["OwnerId"]) != str(owner_id):
        conn.close()
        flash("Appointment not found.", "error")
        return redirect(url_for("owner.owner_appointments"))

    if request.method == "POST":
        start_time = request.form.get("start_time")
        from datetime import datetime
        try:
            start_dt = datetime.fromisoformat(start_time)
        except Exception:
            flash("Invalid date/time.", "error")
            conn.close()
            return redirect(url_for("owner.owner_reschedule", appt_id=appt_id))
        cur.execute("UPDATE dbo.Appointments SET StartTime=? WHERE Id=?", (start_dt, appt_id))
        conn.commit()
        conn.close()
        flash("Appointment rescheduled.", "success")
        return redirect(url_for("owner.owner_appointments"))

    conn.close()
    return render_template("appointment_reschedule.html", appt=appt)


@owner_bp.route("/owner/diet", methods=["GET", "POST"])
@role_required("owner")
def owner_diet():
    owner_id = session["user_id"]
    conn = get_connection()
    cur = conn.cursor()

    cur.execute("SELECT Id, Name, Species FROM dbo.Pets WHERE OwnerId = ? ORDER BY Name", (owner_id,))
    pets = fetchall_dict(cur)
    if not pets:
        conn.close()
        flash("Add a pet first to create diet plans.", "error")
        return redirect(url_for("owner.owner_home"))

    pet_id = request.args.get("pet_id") or session.get("active_pet_id") or str(pets[0]["Id"])
    selected_pet = next((p for p in pets if str(p["Id"]) == str(pet_id)), pets[0])
    session["active_pet_id"] = selected_pet["Id"]

    if request.method == "POST":
        action = request.form.get("action") or "save_diet"

        if action == "generate":
            try:
                generate_diet_plan(conn, selected_pet["Id"])
                flash("Generated a diet plan from your pet data.", "success")
            except Exception as e:
                conn.rollback()
                flash(f"Failed to generate diet plan: {e}", "error")
            return redirect(url_for("owner.owner_diet", pet_id=selected_pet["Id"]))

        if action == "edit_plan":
            plan_id = request.form.get("plan_id")
            details = request.form.get("details")
            if plan_id and details:
                cur.execute(
                    """
                    UPDATE dbo.DietPlans
                    SET Details = ?, UpdatedAt = GETUTCDATE()
                    WHERE Id = ? AND PetId = ?
                    """,
                    (details, plan_id, selected_pet["Id"]),
                )
                conn.commit()
                flash("Diet plan updated.", "success")
                return redirect(url_for("owner.owner_diet", pet_id=selected_pet["Id"]))

        if action == "add_meal":
            meal_title = (request.form.get("meal_title") or "").strip()
            meal_time = (request.form.get("meal_time") or "").strip() or None
            meal_calories = (request.form.get("meal_calories") or "").strip() or None
            meal_portion = (request.form.get("meal_portion") or "").strip() or None
            if not meal_title:
                flash("Meal title required.", "error")
            else:
                cur.execute(
                    """
                    INSERT INTO dbo.Meals (PetId, Title, MealTime, Calories, Portion)
                    VALUES (?, ?, ?, ?, ?)
                    """,
                    (
                        selected_pet["Id"],
                        meal_title,
                        meal_time,
                        int(meal_calories) if meal_calories else None,
                        meal_portion,
                    ),
                )
                conn.commit()
                flash("Meal added.", "success")
                return redirect(url_for("owner.owner_diet", pet_id=selected_pet["Id"]))

        if action == "mark_fed":
            meal_id = request.form.get("meal_id")
            if meal_id:
                cur.execute("INSERT INTO dbo.MealLogs (MealId) VALUES (?)", (meal_id,))
                conn.commit()
                flash("Marked as fed.", "success")
                return redirect(url_for("owner.owner_diet", pet_id=selected_pet["Id"]))

        # default save diet
        title = (request.form.get("title") or "").strip()
        details = (request.form.get("details") or "").strip()
        calories = (request.form.get("calories") or "").strip() or None
        allergies = (request.form.get("allergies") or "").strip() or None
        if not title or not details:
            flash("Diet title and details required.", "error")
        else:
            cur.execute(
                """
                INSERT INTO dbo.DietPlans (PetId, Title, Details, Calories, Allergies)
                VALUES (?, ?, ?, ?, ?)
                """,
                (selected_pet["Id"], title, details, int(calories) if calories else None, allergies),
            )
            conn.commit()
            flash("Diet plan saved.", "success")
            return redirect(url_for("owner.owner_diet", pet_id=selected_pet["Id"]))

    cur.execute(
        """
        SELECT TOP 1 Id, Title, Details, Calories, Allergies, CreatedAt
        FROM dbo.DietPlans
        WHERE PetId = ?
        ORDER BY CreatedAt DESC
        """,
        (selected_pet["Id"],),
    )
    latest = fetchone_dict(cur)
    plan_json = None
    if latest and latest.get("Details"):
        try:
            import json as _json
            plan_json = _json.loads(latest["Details"])
        except Exception:
            plan_json = None
    meals = []
    conn.close()
    return render_template(
        "owner_diet.html",
        pets=pets,
        selected_pet=selected_pet,
        latest=latest,
        plan_json=plan_json,
    )


@owner_bp.route("/owner/chat", methods=["GET", "POST"])
@role_required("owner")
def owner_chat():
    owner_id = session["user_id"]
    conn = get_connection()
    cur = conn.cursor()

    cur.execute(
        """
        SELECT c.Id, c.VetUserId, c.PetId, c.CreatedAt,
               u.FullName AS VetName,
               p.Name AS PetName,
               m.Body AS LastBody,
               m.CreatedAt AS LastAt
        FROM dbo.Chats c
        JOIN dbo.Users u ON u.Id = c.VetUserId
        LEFT JOIN dbo.Pets p ON p.Id = c.PetId
        OUTER APPLY (
            SELECT TOP 1 Body, CreatedAt
            FROM dbo.Messages
            WHERE ChatId = c.Id
            ORDER BY CreatedAt DESC
        ) m
        WHERE c.OwnerId = ?
        ORDER BY c.CreatedAt DESC
        """,
        (owner_id,),
    )
    chats = fetchall_dict(cur)
    active_chat_id = request.args.get("chat_id")
    if active_chat_id is not None:
        try:
            active_chat_id = int(active_chat_id)
        except Exception:
            active_chat_id = None

    if request.method == "POST":
        action = request.form.get("action") or "send"
        if action == "attach":
            flash("Attachment upload coming soon.", "success")
            return redirect(url_for("owner.owner_chat", chat_id=active_chat_id))
        msg = (request.form.get("message") or "").strip()
        chat_id = request.form.get("chat_id")
        if not msg:
            flash("Type a message first.", "error")
        elif not chat_id:
            flash("No active chat yet.", "error")
        else:
            cur.execute(
                """
                INSERT INTO dbo.Messages (ChatId, SenderRole, SenderId, Body)
                VALUES (?, 'owner', ?, ?)
                """,
                (chat_id, owner_id, msg),
            )
            conn.commit()
            flash("Message sent.", "success")
            return redirect(url_for("owner.owner_chat", chat_id=chat_id))

    messages = []
    if active_chat_id:
        cur.execute(
            """
            SELECT SenderRole, Body, CreatedAt
            FROM dbo.Messages
            WHERE ChatId = ?
            ORDER BY CreatedAt ASC
            """,
            (active_chat_id,),
        )
        messages = fetchall_dict(cur)

    cur.execute(
        """
        SELECT TOP 1 Status, CreatedAt
        FROM dbo.ChatRequests
        WHERE OwnerId = ?
        ORDER BY CreatedAt DESC
        """,
        (owner_id,),
    )
    request_status = fetchone_dict(cur)
    conn.close()
    return render_template(
        "owner_chat.html",
        chats=chats,
        active_chat_id=active_chat_id,
        messages=messages,
        request_status=request_status,
    )


@owner_bp.get("/owner/chats/<int:chat_id>/stream")
@role_required("owner")
def owner_chat_stream(chat_id):
    owner_id = session["user_id"]

    def event_stream():
        last_id = request.args.get("last_id", "0")
        try:
            last_id = int(last_id)
        except Exception:
            last_id = 0

        while True:
            conn = get_connection()
            cur = conn.cursor()
            cur.execute("SELECT OwnerId FROM dbo.Chats WHERE Id = ?", (chat_id,))
            row = cur.fetchone()
            if not row or str(row[0]) != str(owner_id):
                conn.close()
                yield "event: error\ndata: unauthorized\n\n"
                break

            cur.execute(
                """
                SELECT Id, SenderRole, Body, CreatedAt
                FROM dbo.Messages
                WHERE ChatId = ? AND Id > ?
                ORDER BY Id ASC
                """,
                (chat_id, last_id),
            )
            rows = cur.fetchall()
            conn.close()

            for r in rows:
                last_id = r[0]
                payload = {
                    "id": r[0],
                    "sender_role": r[1],
                    "body": r[2],
                    "created_at": r[3].isoformat() if hasattr(r[3], "isoformat") else r[3],
                }
                yield f"id: {last_id}\ndata: {json.dumps(payload)}\n\n"

            time.sleep(2)

    return Response(stream_with_context(event_stream()), mimetype="text/event-stream")


@owner_bp.route("/owner/profile", methods=["GET", "POST"])
@role_required("owner")
def owner_profile():
    owner_id = session["user_id"]
    conn = get_connection()
    cur = conn.cursor()

    if request.method == "POST":
        toggle = request.form.get("toggle")
        if toggle:
            flash(f"{toggle.replace('_',' ').title()} toggled.", "success")
        else:
            full_name = (request.form.get("full_name") or "").strip()
            phone = (request.form.get("phone") or "").strip() or None
            if full_name:
                cur.execute("UPDATE dbo.Users SET FullName=?, Phone=? WHERE Id=?", (full_name, phone, owner_id))
                conn.commit()
                session["full_name"] = full_name
                flash("Profile updated.", "success")

    cur.execute("SELECT Email, Phone FROM dbo.Users WHERE Id = ?", (owner_id,))
    user = fetchone_dict(cur) or {"Email": "-", "Phone": "-"}

    cur.execute("SELECT COUNT(*) FROM dbo.Pets WHERE OwnerId = ?", (owner_id,))
    pets_count = cur.fetchone()[0]

    cur.execute("SELECT COUNT(*) FROM dbo.Appointments WHERE OwnerId = ?", (owner_id,))
    appts_count = cur.fetchone()[0]

    cur.execute(
        """
        SELECT COUNT(*) FROM dbo.Records r
        JOIN dbo.Pets p ON p.Id = r.PetId
        WHERE p.OwnerId = ?
        """,
        (owner_id,),
    )
    records_count = cur.fetchone()[0]

    cur.execute(
        """
        SELECT Id, Name, Species, Breed, AgeMonths, WeightKg, Allergies, Diseases, PhotoUrl
        FROM dbo.Pets
        WHERE OwnerId = ?
        ORDER BY Name
        """,
        (owner_id,),
    )
    pets = fetchall_dict(cur)
    selected_pet_id = request.args.get("pet_id")
    selected_pet = None
    if pets:
        if selected_pet_id:
            selected_pet = next((p for p in pets if str(p["Id"]) == str(selected_pet_id)), None)
        if not selected_pet:
            selected_pet = pets[0]
        session["active_pet_id"] = selected_pet["Id"]

    conn.close()
    counts = {"pets": pets_count, "appts": appts_count, "records": records_count}
    return render_template("owner_profile.html", user=user, counts=counts, pets=pets, selected_pet=selected_pet)


@owner_bp.route("/owner/health-log", methods=["GET", "POST"])
@role_required("owner")
def owner_health_log():
    owner_id = session["user_id"]
    conn = get_connection()
    cur = conn.cursor()

    cur.execute("SELECT Id, Name FROM dbo.Pets WHERE OwnerId = ? ORDER BY Name", (owner_id,))
    pets = fetchall_dict(cur)
    active_pet_id = session.get("active_pet_id")
    selected_pet = None
    if pets:
        if active_pet_id:
            selected_pet = next((p for p in pets if str(p["Id"]) == str(active_pet_id)), None)
        if not selected_pet:
            selected_pet = pets[0]
            session["active_pet_id"] = selected_pet["Id"]

    if request.method == "POST":
        pet_id = request.form.get("pet_id")
        mood = (request.form.get("mood") or "").strip() or None
        appetite = (request.form.get("appetite") or "").strip() or None
        notes = (request.form.get("notes") or "").strip() or None
        if not pet_id:
            flash("Select a pet.", "error")
        else:
            session["active_pet_id"] = int(pet_id)
            cur.execute(
                """
                INSERT INTO dbo.HealthLogs (PetId, OwnerId, Mood, Appetite, Notes)
                VALUES (?, ?, ?, ?, ?)
                """,
                (pet_id, owner_id, mood, appetite, notes),
            )
            conn.commit()
            flash("Health log saved.", "success")
            return redirect(url_for("owner.owner_health_log"))

    cur.execute(
        """
        SELECT h.Id, h.Mood, h.Appetite, h.Notes, h.CreatedAt, p.Name AS PetName
        FROM dbo.HealthLogs h
        JOIN dbo.Pets p ON p.Id = h.PetId
        WHERE h.OwnerId = ?
        ORDER BY h.CreatedAt DESC
        """,
        (owner_id,),
    )
    logs = fetchall_dict(cur)
    conn.close()
    return render_template(
        "owner_health_log.html",
        pets=pets,
        logs=logs,
        selected_pet=selected_pet,
    )


@owner_bp.route("/owner/pets/<int:pet_id>", methods=["GET", "POST"])
@role_required("owner")
def owner_pet_detail(pet_id):
    owner_id = session["user_id"]
    conn = get_connection()
    cur = conn.cursor()

    cur.execute(
        """
        SELECT Id, OwnerId, Name, Species, Breed, AgeMonths, WeightKg, Allergies, Diseases, PhotoUrl, CreatedAt
        FROM dbo.Pets
        WHERE Id = ? AND OwnerId = ?
        """,
        (pet_id, owner_id),
    )
    pet = fetchone_dict(cur)
    if not pet:
        conn.close()
        flash("Pet not found.", "error")
        return redirect(url_for("owner.owner_home"))

    if request.method == "POST":
        form_type = request.form.get("form")
        try:
            if form_type == "diet":
                title = (request.form.get("title") or "").strip()
                details = (request.form.get("details") or "").strip()
                calories = (request.form.get("calories") or "").strip() or None
                allergies = (request.form.get("allergies") or "").strip() or None
                if not title or not details:
                    flash("Diet title and details required.", "error")
                else:
                    cur.execute(
                        """
                        INSERT INTO dbo.DietPlans (PetId, Title, Details, Calories, Allergies)
                        VALUES (?, ?, ?, ?, ?)
                        """,
                        (
                            pet_id,
                            title,
                            details,
                            int(calories) if calories else None,
                            allergies,
                        ),
                    )
                    conn.commit()
                    flash("Diet plan added.", "success")
                    return redirect(url_for("owner.owner_pet_detail", pet_id=pet_id))

            elif form_type == "med":
                name = (request.form.get("name") or "").strip()
                dosage = (request.form.get("dosage") or "").strip() or None
                frequency = (request.form.get("frequency") or "").strip() or None
                notes = (request.form.get("notes") or "").strip() or None
                if not name:
                    flash("Medication name required.", "error")
                else:
                    cur.execute(
                        """
                        INSERT INTO dbo.Medications (PetId, Name, Dosage, Frequency, Notes)
                        VALUES (?, ?, ?, ?, ?)
                        """,
                        (pet_id, name, dosage, frequency, notes),
                    )
                    conn.commit()
                    flash("Medication added.", "success")
                    return redirect(url_for("owner.owner_pet_detail", pet_id=pet_id))

            elif form_type == "vaccine":
                name = (request.form.get("name") or "").strip()
                due_date = (request.form.get("due_date") or "").strip() or None
                status = (request.form.get("status") or "Due").strip()
                notes = (request.form.get("notes") or "").strip() or None
                if not name:
                    flash("Vaccine name required.", "error")
                else:
                    cur.execute(
                        """
                        INSERT INTO dbo.Vaccinations (PetId, Name, DueDate, Status, Notes)
                        VALUES (?, ?, ?, ?, ?)
                        """,
                        (pet_id, name, due_date, status, notes),
                    )
                    conn.commit()
                    flash("Vaccine added.", "success")
                    return redirect(url_for("owner.owner_pet_detail", pet_id=pet_id))

            elif form_type == "record":
                title = (request.form.get("title") or "").strip()
                visit_date = (request.form.get("visit_date") or "").strip() or None
                file_url = (request.form.get("file_url") or "").strip() or None
                notes = (request.form.get("notes") or "").strip() or None
                if not title:
                    flash("Record title required.", "error")
                else:
                    cur.execute(
                        """
                        INSERT INTO dbo.Records (PetId, Title, FileUrl, Notes, VisitDate)
                        VALUES (?, ?, ?, ?, ?)
                        """,
                        (pet_id, title, file_url, notes, visit_date),
                    )
                    conn.commit()
                    flash("Record added.", "success")
                    return redirect(url_for("owner.owner_pet_detail", pet_id=pet_id))
        except Exception as e:
            conn.rollback()
            flash(f"Save failed: {e}", "error")

    # Load related data
    cur.execute(
        """
        SELECT Id, Title, Details, Calories, Allergies, CreatedAt
        FROM dbo.DietPlans
        WHERE PetId = ?
        ORDER BY CreatedAt DESC
        """,
        (pet_id,),
    )
    diets = fetchall_dict(cur)

    cur.execute(
        """
        SELECT Id, Name, Dosage, Frequency, Notes, CreatedAt
        FROM dbo.Medications
        WHERE PetId = ?
        ORDER BY CreatedAt DESC
        """,
        (pet_id,),
    )
    meds = fetchall_dict(cur)

    cur.execute(
        """
        SELECT Id, Name, DueDate, Status, Notes, CreatedAt
        FROM dbo.Vaccinations
        WHERE PetId = ?
        ORDER BY CreatedAt DESC
        """,
        (pet_id,),
    )
    vaccines = fetchall_dict(cur)

    cur.execute(
        """
        SELECT Id, Title, FileUrl, Notes, VisitDate, CreatedAt
        FROM dbo.Records
        WHERE PetId = ?
        ORDER BY CreatedAt DESC
        """,
        (pet_id,),
    )
    records = fetchall_dict(cur)

    cur.execute(
        """
        SELECT Id, Name, Species FROM dbo.Pets WHERE OwnerId = ? ORDER BY Name
        """,
        (owner_id,),
    )
    pet_list = fetchall_dict(cur)

    conn.close()
    return render_template(
        "pet_detail.html",
        pet=pet,
        pet_list=pet_list,
        diets=diets,
        meds=meds,
        vaccines=vaccines,
        records=records,
    )
