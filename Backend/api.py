from datetime import datetime, timedelta
import secrets

from flask import Blueprint, jsonify, request
from werkzeug.security import generate_password_hash, check_password_hash

from db import get_connection, fetchall_dict, fetchone_dict

api_bp = Blueprint("api", __name__, url_prefix="/api")


# -------- Helpers --------

def json_error(message, status=400):
    return jsonify({"error": message}), status


def parse_json():
    return request.get_json(silent=True) or {}


def issue_token(conn, user_id):
    token = secrets.token_urlsafe(32)
    expires_at = datetime.utcnow() + timedelta(days=30)
    cur = conn.cursor()
    cur.execute(
        """
        INSERT INTO dbo.AuthTokens (UserId, Token, ExpiresAt)
        VALUES (?, ?, ?)
        """,
        (user_id, token, expires_at),
    )
    return token, expires_at


def get_auth_user():
    auth = request.headers.get("Authorization", "")
    if not auth.startswith("Bearer "):
        return None
    token = auth[7:].strip()
    if not token:
        return None

    conn = get_connection()
    cur = conn.cursor()
    cur.execute(
        """
        SELECT u.Id, u.Role, u.FullName, u.Email
        FROM dbo.AuthTokens t
        JOIN dbo.Users u ON u.Id = t.UserId
        WHERE t.Token = ? AND t.ExpiresAt > GETUTCDATE()
        """,
        (token,),
    )
    row = cur.fetchone()
    conn.close()
    if not row:
        return None
    return {
        "id": row[0],
        "role": row[1],
        "full_name": row[2],
        "email": row[3],
    }


def require_auth():
    user = get_auth_user()
    if not user:
        return None, json_error("Unauthorized", 401)
    return user, None


def require_role(user, *roles):
    if user["role"] not in roles:
        return json_error("Forbidden", 403)
    return None


# -------- Auth --------

@api_bp.post("/auth/signup")
def api_signup():
    data = parse_json()
    full_name = (data.get("full_name") or "").strip()
    email = (data.get("email") or "").strip()
    phone = (data.get("phone") or "").strip() or None
    role = (data.get("role") or "owner").strip().lower()
    password = (data.get("password") or "").strip()

    clinic_name = (data.get("clinic_name") or "").strip() or None
    license_no = (data.get("license_no") or "").strip() or None
    clinic_phone = (data.get("clinic_phone") or "").strip() or None
    bio = (data.get("bio") or "").strip() or None

    if not full_name or not email or not password:
        return json_error("Full name, email, and password are required.")
    if role not in ("owner", "vet"):
        return json_error("Role must be owner or vet.")

    conn = get_connection()
    cur = conn.cursor()
    try:
        # Check existing email
        cur.execute("SELECT TOP 1 Id FROM dbo.Users WHERE Email = ?", (email,))
        if cur.fetchone():
            return json_error("Email already exists.", 409)

        pw_hash = generate_password_hash(password)
        cur.execute(
            """
            INSERT INTO dbo.Users (Role, FullName, Email, Phone, PasswordHash)
            OUTPUT INSERTED.Id
            VALUES (?, ?, ?, ?, ?)
            """,
            (role, full_name, email, phone, pw_hash),
        )
        user_id = cur.fetchone()[0]

        if role == "vet":
            cur.execute(
                """
                INSERT INTO dbo.VetProfiles (UserId, ClinicName, LicenseNo, ClinicPhone, Bio)
                VALUES (?, ?, ?, ?, ?)
                """,
                (user_id, clinic_name, license_no, clinic_phone, bio),
            )

        token, expires_at = issue_token(conn, user_id)
        conn.commit()
        return jsonify(
            {
                "user_id": user_id,
                "role": role,
                "full_name": full_name,
                "token": token,
                "expires_at": expires_at.isoformat() + "Z",
            }
        )
    except Exception as e:
        conn.rollback()
        return json_error(f"Signup failed: {e}", 500)
    finally:
        conn.close()


@api_bp.post("/auth/login")
def api_login():
    data = parse_json()
    email = (data.get("email") or "").strip()
    password = (data.get("password") or "").strip()
    if not email or not password:
        return json_error("Email and password required.")

    conn = get_connection()
    cur = conn.cursor()
    try:
        cur.execute(
            """
            SELECT TOP 1 Id, Role, FullName, PasswordHash
            FROM dbo.Users
            WHERE Email = ?
            """,
            (email,),
        )
        row = cur.fetchone()
        if not row:
            return json_error("Invalid credentials.", 401)

        user_id, role, full_name, pw_hash = row
        if not check_password_hash(pw_hash, password):
            return json_error("Invalid credentials.", 401)

        token, expires_at = issue_token(conn, user_id)
        conn.commit()
        return jsonify(
            {
                "user_id": user_id,
                "role": role,
                "full_name": full_name,
                "token": token,
                "expires_at": expires_at.isoformat() + "Z",
            }
        )
    except Exception as e:
        conn.rollback()
        return json_error(f"Login failed: {e}", 500)
    finally:
        conn.close()


@api_bp.get("/me")
def api_me():
    user, err = require_auth()
    if err:
        return err
    return jsonify(user)


# -------- Vets --------

@api_bp.get("/vets")
def api_list_vets():
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
    return jsonify(vets)


# -------- Pets --------

@api_bp.get("/pets")
def api_list_pets():
    user, err = require_auth()
    if err:
        return err

    owner_id = request.args.get("owner_id")
    conn = get_connection()
    cur = conn.cursor()

    if user["role"] == "owner":
        cur.execute(
            """
            SELECT Id, OwnerId, Name, Species, Breed, AgeMonths, WeightKg,
                   Allergies, Diseases, PhotoUrl, CreatedAt
            FROM dbo.Pets
            WHERE OwnerId = ?
            ORDER BY CreatedAt DESC
            """,
            (user["id"],),
        )
    else:
        if owner_id:
            cur.execute(
                """
                SELECT Id, OwnerId, Name, Species, Breed, AgeMonths, WeightKg,
                       Allergies, Diseases, PhotoUrl, CreatedAt
                FROM dbo.Pets
                WHERE OwnerId = ?
                ORDER BY CreatedAt DESC
                """,
                (owner_id,),
            )
        else:
            cur.execute(
                """
                SELECT Id, OwnerId, Name, Species, Breed, AgeMonths, WeightKg,
                       Allergies, Diseases, PhotoUrl, CreatedAt
                FROM dbo.Pets
                ORDER BY CreatedAt DESC
                """
            )

    pets = fetchall_dict(cur)
    conn.close()
    return jsonify(pets)


@api_bp.post("/pets")
def api_create_pet():
    user, err = require_auth()
    if err:
        return err
    if user["role"] != "owner":
        return json_error("Only owners can add pets.", 403)

    data = parse_json()
    name = (data.get("name") or "").strip()
    species = (data.get("species") or "").strip()
    breed = (data.get("breed") or "").strip() or None
    age_months = data.get("age_months")
    weight_kg = data.get("weight_kg")
    allergies = (data.get("allergies") or "").strip() or None
    diseases = (data.get("diseases") or "").strip() or None
    photo_url = (data.get("photo_url") or "").strip() or None

    if not name or not species:
        return json_error("Name and species are required.")

    conn = get_connection()
    cur = conn.cursor()
    try:
        cur.execute(
            """
            INSERT INTO dbo.Pets
              (OwnerId, Name, Species, Breed, AgeMonths, WeightKg, Allergies, Diseases, PhotoUrl)
            OUTPUT INSERTED.Id
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (user["id"], name, species, breed, age_months, weight_kg, allergies, diseases, photo_url),
        )
        pet_id = cur.fetchone()[0]
        conn.commit()
        return jsonify({"id": pet_id})
    except Exception as e:
        conn.rollback()
        return json_error(f"Create pet failed: {e}", 500)
    finally:
        conn.close()


@api_bp.get("/pets/<int:pet_id>")
def api_get_pet(pet_id):
    user, err = require_auth()
    if err:
        return err

    conn = get_connection()
    cur = conn.cursor()
    cur.execute(
        """
        SELECT Id, OwnerId, Name, Species, Breed, AgeMonths, WeightKg,
               Allergies, Diseases, PhotoUrl, CreatedAt
        FROM dbo.Pets
        WHERE Id = ?
        """,
        (pet_id,),
    )
    pet = fetchone_dict(cur)
    conn.close()

    if not pet:
        return json_error("Pet not found.", 404)
    if user["role"] == "owner" and pet["OwnerId"] != user["id"]:
        return json_error("Forbidden", 403)

    return jsonify(pet)


# -------- Appointments --------

@api_bp.get("/appointments")
def api_list_appointments():
    user, err = require_auth()
    if err:
        return err

    conn = get_connection()
    cur = conn.cursor()

    if user["role"] == "owner":
        cur.execute(
            """
            SELECT a.Id, a.Type, a.Status, a.StartTime, a.EndTime, a.Notes,
                   p.Name AS PetName,
                   u.FullName AS VetName
            FROM dbo.Appointments a
            JOIN dbo.Pets p ON p.Id = a.PetId
            JOIN dbo.Users u ON u.Id = a.VetUserId
            WHERE a.OwnerId = ?
            ORDER BY a.StartTime DESC
            """,
            (user["id"],),
        )
    else:
        cur.execute(
            """
            SELECT a.Id, a.Type, a.Status, a.StartTime, a.EndTime, a.Notes,
                   p.Name AS PetName,
                   o.FullName AS OwnerName
            FROM dbo.Appointments a
            JOIN dbo.Pets p ON p.Id = a.PetId
            JOIN dbo.Users o ON o.Id = a.OwnerId
            WHERE a.VetUserId = ?
            ORDER BY a.StartTime DESC
            """,
            (user["id"],),
        )

    appts = fetchall_dict(cur)
    conn.close()
    return jsonify(appts)


@api_bp.post("/appointments")
def api_create_appointment():
    user, err = require_auth()
    if err:
        return err
    if user["role"] != "owner":
        return json_error("Only owners can book appointments.", 403)

    data = parse_json()
    pet_id = data.get("pet_id")
    vet_user_id = data.get("vet_user_id")
    appt_type = (data.get("type") or "Consultation").strip()
    start_time = data.get("start_time")
    end_time = data.get("end_time")
    notes = (data.get("notes") or "").strip() or None

    if not pet_id or not vet_user_id or not start_time:
        return json_error("pet_id, vet_user_id, and start_time are required.")

    conn = get_connection()
    cur = conn.cursor()
    try:
        # verify pet belongs to owner
        cur.execute("SELECT OwnerId FROM dbo.Pets WHERE Id = ?", (pet_id,))
        row = cur.fetchone()
        if not row or row[0] != user["id"]:
            return json_error("Pet not found.", 404)

        cur.execute(
            """
            INSERT INTO dbo.Appointments
              (OwnerId, VetUserId, PetId, Type, Status, StartTime, EndTime, Notes)
            OUTPUT INSERTED.Id
            VALUES (?, ?, ?, ?, 'Scheduled', ?, ?, ?)
            """,
            (user["id"], vet_user_id, pet_id, appt_type, start_time, end_time, notes),
        )
        appt_id = cur.fetchone()[0]
        conn.commit()
        return jsonify({"id": appt_id})
    except Exception as e:
        conn.rollback()
        return json_error(f"Create appointment failed: {e}", 500)
    finally:
        conn.close()


@api_bp.patch("/appointments/<int:appt_id>")
def api_update_appointment(appt_id):
    user, err = require_auth()
    if err:
        return err

    data = parse_json()
    status = (data.get("status") or "").strip() or None
    start_time = data.get("start_time")
    end_time = data.get("end_time")
    notes = (data.get("notes") or "").strip() or None

    conn = get_connection()
    cur = conn.cursor()
    try:
        cur.execute(
            """
            SELECT OwnerId, VetUserId FROM dbo.Appointments WHERE Id = ?
            """,
            (appt_id,),
        )
        row = cur.fetchone()
        if not row:
            return json_error("Appointment not found.", 404)

        owner_id, vet_id = row
        if user["role"] == "owner" and owner_id != user["id"]:
            return json_error("Forbidden", 403)
        if user["role"] == "vet" and vet_id != user["id"]:
            return json_error("Forbidden", 403)

        cur.execute(
            """
            UPDATE dbo.Appointments
            SET Status = COALESCE(?, Status),
                StartTime = COALESCE(?, StartTime),
                EndTime = COALESCE(?, EndTime),
                Notes = COALESCE(?, Notes)
            WHERE Id = ?
            """,
            (status, start_time, end_time, notes, appt_id),
        )
        conn.commit()
        return jsonify({"ok": True})
    except Exception as e:
        conn.rollback()
        return json_error(f"Update appointment failed: {e}", 500)
    finally:
        conn.close()


# -------- Diet Plans --------

@api_bp.get("/pets/<int:pet_id>/diet-plans")
def api_list_diet_plans(pet_id):
    user, err = require_auth()
    if err:
        return err

    conn = get_connection()
    cur = conn.cursor()

    # Check access for owners
    if user["role"] == "owner":
        cur.execute("SELECT OwnerId FROM dbo.Pets WHERE Id = ?", (pet_id,))
        row = cur.fetchone()
        if not row or row[0] != user["id"]:
            conn.close()
            return json_error("Pet not found.", 404)

    cur.execute(
        """
        SELECT Id, PetId, VetUserId, Title, Details, Calories, Allergies, CreatedAt, UpdatedAt
        FROM dbo.DietPlans
        WHERE PetId = ?
        ORDER BY CreatedAt DESC
        """,
        (pet_id,),
    )
    plans = fetchall_dict(cur)
    conn.close()
    return jsonify(plans)


@api_bp.post("/pets/<int:pet_id>/diet-plans")
def api_create_diet_plan(pet_id):
    user, err = require_auth()
    if err:
        return err

    data = parse_json()
    title = (data.get("title") or "").strip()
    details = (data.get("details") or "").strip()
    calories = data.get("calories")
    allergies = (data.get("allergies") or "").strip() or None

    if not title or not details:
        return json_error("Title and details are required.")

    conn = get_connection()
    cur = conn.cursor()
    try:
        if user["role"] == "owner":
            cur.execute("SELECT OwnerId FROM dbo.Pets WHERE Id = ?", (pet_id,))
            row = cur.fetchone()
            if not row or row[0] != user["id"]:
                return json_error("Pet not found.", 404)

        cur.execute(
            """
            INSERT INTO dbo.DietPlans
              (PetId, VetUserId, Title, Details, Calories, Allergies)
            OUTPUT INSERTED.Id
            VALUES (?, ?, ?, ?, ?, ?)
            """,
            (pet_id, user["id"] if user["role"] == "vet" else None, title, details, calories, allergies),
        )
        plan_id = cur.fetchone()[0]
        conn.commit()
        return jsonify({"id": plan_id})
    except Exception as e:
        conn.rollback()
        return json_error(f"Create diet plan failed: {e}", 500)
    finally:
        conn.close()


# -------- Medications --------

@api_bp.get("/pets/<int:pet_id>/medications")
def api_list_medications(pet_id):
    user, err = require_auth()
    if err:
        return err

    conn = get_connection()
    cur = conn.cursor()

    if user["role"] == "owner":
        cur.execute("SELECT OwnerId FROM dbo.Pets WHERE Id = ?", (pet_id,))
        row = cur.fetchone()
        if not row or row[0] != user["id"]:
            conn.close()
            return json_error("Pet not found.", 404)

    cur.execute(
        """
        SELECT Id, PetId, Name, Dosage, Frequency, StartDate, EndDate, Notes, CreatedAt
        FROM dbo.Medications
        WHERE PetId = ?
        ORDER BY CreatedAt DESC
        """,
        (pet_id,),
    )
    meds = fetchall_dict(cur)
    conn.close()
    return jsonify(meds)


@api_bp.post("/pets/<int:pet_id>/medications")
def api_create_medication(pet_id):
    user, err = require_auth()
    if err:
        return err

    data = parse_json()
    name = (data.get("name") or "").strip()
    dosage = (data.get("dosage") or "").strip() or None
    frequency = (data.get("frequency") or "").strip() or None
    start_date = data.get("start_date")
    end_date = data.get("end_date")
    notes = (data.get("notes") or "").strip() or None

    if not name:
        return json_error("Medication name is required.")

    conn = get_connection()
    cur = conn.cursor()
    try:
        if user["role"] == "owner":
            cur.execute("SELECT OwnerId FROM dbo.Pets WHERE Id = ?", (pet_id,))
            row = cur.fetchone()
            if not row or row[0] != user["id"]:
                return json_error("Pet not found.", 404)

        cur.execute(
            """
            INSERT INTO dbo.Medications
              (PetId, Name, Dosage, Frequency, StartDate, EndDate, Notes)
            OUTPUT INSERTED.Id
            VALUES (?, ?, ?, ?, ?, ?, ?)
            """,
            (pet_id, name, dosage, frequency, start_date, end_date, notes),
        )
        med_id = cur.fetchone()[0]
        conn.commit()
        return jsonify({"id": med_id})
    except Exception as e:
        conn.rollback()
        return json_error(f"Create medication failed: {e}", 500)
    finally:
        conn.close()


# -------- Vaccinations --------

@api_bp.get("/pets/<int:pet_id>/vaccinations")
def api_list_vaccinations(pet_id):
    user, err = require_auth()
    if err:
        return err

    conn = get_connection()
    cur = conn.cursor()

    if user["role"] == "owner":
        cur.execute("SELECT OwnerId FROM dbo.Pets WHERE Id = ?", (pet_id,))
        row = cur.fetchone()
        if not row or row[0] != user["id"]:
            conn.close()
            return json_error("Pet not found.", 404)

    cur.execute(
        """
        SELECT Id, PetId, Name, DueDate, Status, Notes, CreatedAt
        FROM dbo.Vaccinations
        WHERE PetId = ?
        ORDER BY CreatedAt DESC
        """,
        (pet_id,),
    )
    items = fetchall_dict(cur)
    conn.close()
    return jsonify(items)


@api_bp.post("/pets/<int:pet_id>/vaccinations")
def api_create_vaccination(pet_id):
    user, err = require_auth()
    if err:
        return err

    data = parse_json()
    name = (data.get("name") or "").strip()
    due_date = data.get("due_date")
    status = (data.get("status") or "Due").strip()
    notes = (data.get("notes") or "").strip() or None

    if not name:
        return json_error("Vaccination name is required.")

    conn = get_connection()
    cur = conn.cursor()
    try:
        if user["role"] == "owner":
            cur.execute("SELECT OwnerId FROM dbo.Pets WHERE Id = ?", (pet_id,))
            row = cur.fetchone()
            if not row or row[0] != user["id"]:
                return json_error("Pet not found.", 404)

        cur.execute(
            """
            INSERT INTO dbo.Vaccinations
              (PetId, Name, DueDate, Status, Notes)
            OUTPUT INSERTED.Id
            VALUES (?, ?, ?, ?, ?)
            """,
            (pet_id, name, due_date, status, notes),
        )
        v_id = cur.fetchone()[0]
        conn.commit()
        return jsonify({"id": v_id})
    except Exception as e:
        conn.rollback()
        return json_error(f"Create vaccination failed: {e}", 500)
    finally:
        conn.close()


# -------- Records --------

@api_bp.get("/pets/<int:pet_id>/records")
def api_list_records(pet_id):
    user, err = require_auth()
    if err:
        return err

    conn = get_connection()
    cur = conn.cursor()

    if user["role"] == "owner":
        cur.execute("SELECT OwnerId FROM dbo.Pets WHERE Id = ?", (pet_id,))
        row = cur.fetchone()
        if not row or row[0] != user["id"]:
            conn.close()
            return json_error("Pet not found.", 404)

    cur.execute(
        """
        SELECT Id, PetId, Title, FileUrl, Notes, VisitDate, CreatedAt
        FROM dbo.Records
        WHERE PetId = ?
        ORDER BY CreatedAt DESC
        """,
        (pet_id,),
    )
    items = fetchall_dict(cur)
    conn.close()
    return jsonify(items)


@api_bp.post("/pets/<int:pet_id>/records")
def api_create_record(pet_id):
    user, err = require_auth()
    if err:
        return err

    data = parse_json()
    title = (data.get("title") or "").strip()
    file_url = (data.get("file_url") or "").strip() or None
    notes = (data.get("notes") or "").strip() or None
    visit_date = data.get("visit_date")

    if not title:
        return json_error("Record title is required.")

    conn = get_connection()
    cur = conn.cursor()
    try:
        if user["role"] == "owner":
            cur.execute("SELECT OwnerId FROM dbo.Pets WHERE Id = ?", (pet_id,))
            row = cur.fetchone()
            if not row or row[0] != user["id"]:
                return json_error("Pet not found.", 404)

        cur.execute(
            """
            INSERT INTO dbo.Records
              (PetId, Title, FileUrl, Notes, VisitDate)
            OUTPUT INSERTED.Id
            VALUES (?, ?, ?, ?, ?)
            """,
            (pet_id, title, file_url, notes, visit_date),
        )
        rec_id = cur.fetchone()[0]
        conn.commit()
        return jsonify({"id": rec_id})
    except Exception as e:
        conn.rollback()
        return json_error(f"Create record failed: {e}", 500)
    finally:
        conn.close()
