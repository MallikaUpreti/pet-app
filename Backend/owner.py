from flask import Blueprint, render_template, session, request, redirect, url_for, flash
from auth_utils import role_required
from db import get_connection, fetchall_dict, fetchone_dict

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
    conn.close()

    return render_template("owner_home.html", pets=pets)


@owner_bp.get("/owner/vets")
@role_required("owner")
def owner_vets():
    conn = get_connection()
    cur = conn.cursor()
    cur.execute(
        """
        SELECT u.Id, u.FullName, u.Email, u.Phone,
               v.ClinicName, v.LicenseNo, v.ClinicPhone, v.Bio
        FROM dbo.Users u
        LEFT JOIN dbo.VetProfiles v ON v.UserId = u.Id
        WHERE u.Role = 'vet'
        ORDER BY u.FullName
        """
    )
    vets = fetchall_dict(cur)
    conn.close()
    return render_template("owner_vets.html", vets=vets)


@owner_bp.route("/owner/appointments", methods=["GET", "POST"])
@role_required("owner")
def owner_appointments():
    owner_id = session["user_id"]
    conn = get_connection()
    cur = conn.cursor()

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
                    VALUES (?, ?, ?, ?, 'Scheduled', ?, ?)
                    """,
                    (owner_id, vet_user_id, pet_id, appt_type, start_dt, notes),
                )
                conn.commit()
                flash("Appointment booked.", "success")
                return redirect(url_for("owner.owner_appointments"))
            except Exception as e:
                conn.rollback()
                flash(f"Failed to book: {e}", "error")

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
    return render_template("owner_appointments.html", appts=appts, pets=pets, vets=vets)


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
