from datetime import datetime, timedelta
import secrets
import json
import time

from flask import Blueprint, jsonify, request, Response, stream_with_context
from werkzeug.security import generate_password_hash, check_password_hash

from db import get_connection, fetchall_dict, fetchone_dict
from diet_generator import generate_diet_plan

api_bp = Blueprint("api", __name__, url_prefix="/api")

CORE_VACCINES = {
    "dog": ["Rabies", "DHPPiL", "Corona vaccine"],
    "cat": ["Rabies", "Tricat tri vaccine"],
}
ALLOWED_PET_SPECIES = {"dog": "Dog", "cat": "Cat"}


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


def get_appointment_with_access(cur, appt_id, user):
    cur.execute(
        """
        SELECT a.Id, a.OwnerId, a.VetUserId, a.PetId, a.Type, a.Status, a.StartTime, a.EndTime, a.Notes,
               p.Name AS PetName,
               o.FullName AS OwnerName,
               v.FullName AS VetName
        FROM dbo.Appointments a
        JOIN dbo.Pets p ON p.Id = a.PetId
        JOIN dbo.Users o ON o.Id = a.OwnerId
        JOIN dbo.Users v ON v.Id = a.VetUserId
        WHERE a.Id = ?
        """,
        (appt_id,),
    )
    appt = fetchone_dict(cur)
    if not appt:
        return None, json_error("Appointment not found.", 404)
    if user["role"] == "owner" and appt["OwnerId"] != user["id"]:
        return None, json_error("Forbidden", 403)
    if user["role"] == "vet" and appt["VetUserId"] != user["id"]:
        return None, json_error("Forbidden", 403)
    return appt, None

def ensure_owner_settings(conn, owner_id):
    cur = conn.cursor()
    cur.execute("SELECT OwnerId FROM dbo.OwnerSettings WHERE OwnerId = ?", (owner_id,))
    if not cur.fetchone():
        cur.execute(
            "INSERT INTO dbo.OwnerSettings (OwnerId, NotificationsEnabled, DietRemindersEnabled) VALUES (?, 1, 1)",
            (owner_id,),
        )


def create_owner_notification(cur, owner_id, appointment_id, ntype, message):
    cur.execute(
        """
        INSERT INTO dbo.OwnerNotifications (OwnerId, AppointmentId, Type, Message)
        VALUES (?, ?, ?, ?)
        """,
        (owner_id, appointment_id, ntype, message),
    )


def create_vet_notification(cur, vet_user_id, owner_id, pet_id, appointment_id, ntype, message):
    cur.execute(
        """
        INSERT INTO dbo.VetNotifications (VetUserId, OwnerId, PetId, AppointmentId, Type, Message)
        VALUES (?, ?, ?, ?, ?, ?)
        """,
        (vet_user_id, owner_id, pet_id, appointment_id, ntype, message),
    )


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
    selected_role = (data.get("role") or "").strip()
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
        if selected_role and selected_role != role:
            return json_error("Invalid role for this account.", 401)

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


@api_bp.put("/me")
def api_update_me():
    user, err = require_auth()
    if err:
        return err
    data = parse_json()
    full_name = (data.get("full_name") or "").strip() or user["full_name"]
    phone = (data.get("phone") or "").strip() or None
    conn = get_connection()
    cur = conn.cursor()
    try:
        cur.execute(
            "UPDATE dbo.Users SET FullName=?, Phone=? WHERE Id=?",
            (full_name, phone, user["id"]),
        )
        conn.commit()
        return jsonify({"ok": True})
    except Exception as e:
        conn.rollback()
        return json_error(f"Update failed: {e}", 500)
    finally:
        conn.close()


@api_bp.get("/vet/profile")
def api_get_vet_profile():
    user, err = require_auth()
    if err:
        return err
    if user["role"] != "vet":
        return json_error("Only vets can access this.", 403)
    conn = get_connection()
    cur = conn.cursor()
    cur.execute(
        """
        SELECT u.FullName, u.Email, u.Phone,
               v.ClinicName, v.LicenseNo, v.ClinicPhone, v.Bio, v.IsOnline
        FROM dbo.Users u
        LEFT JOIN dbo.VetProfiles v ON v.UserId = u.Id
        WHERE u.Id = ?
        """,
        (user["id"],),
    )
    row = fetchone_dict(cur) or {}
    conn.close()
    return jsonify(row)


@api_bp.put("/vet/profile")
def api_update_vet_profile():
    user, err = require_auth()
    if err:
        return err
    if user["role"] != "vet":
        return json_error("Only vets can update this.", 403)
    data = parse_json()
    full_name = (data.get("full_name") or "").strip() or None
    phone = (data.get("phone") or "").strip() or None
    clinic_name = (data.get("clinic_name") or "").strip() or None
    license_no = (data.get("license_no") or "").strip() or None
    clinic_phone = (data.get("clinic_phone") or "").strip() or None
    bio = (data.get("bio") or "").strip() or None
    is_online = data.get("is_online")

    conn = get_connection()
    cur = conn.cursor()
    try:
        if full_name or phone:
            cur.execute(
                """
                UPDATE dbo.Users
                SET FullName = COALESCE(?, FullName),
                    Phone = COALESCE(?, Phone)
                WHERE Id = ?
                """,
                (full_name, phone, user["id"]),
            )

        cur.execute(
            """
            IF EXISTS (SELECT 1 FROM dbo.VetProfiles WHERE UserId = ?)
                UPDATE dbo.VetProfiles
                SET ClinicName = COALESCE(?, ClinicName),
                    LicenseNo = COALESCE(?, LicenseNo),
                    ClinicPhone = COALESCE(?, ClinicPhone),
                    Bio = COALESCE(?, Bio),
                    IsOnline = COALESCE(?, IsOnline)
                WHERE UserId = ?
            ELSE
                INSERT INTO dbo.VetProfiles (UserId, ClinicName, LicenseNo, ClinicPhone, Bio, IsOnline)
                VALUES (?, ?, ?, ?, ?, COALESCE(?, 0))
            """,
            (
                user["id"],
                clinic_name,
                license_no,
                clinic_phone,
                bio,
                is_online,
                user["id"],
                user["id"],
                clinic_name,
                license_no,
                clinic_phone,
                bio,
                is_online,
            ),
        )
        conn.commit()
        return jsonify({"ok": True})
    except Exception as e:
        conn.rollback()
        return json_error(f"Update vet profile failed: {e}", 500)
    finally:
        conn.close()


# -------- Vets --------

@api_bp.get("/vets")
def api_list_vets():
    conn = get_connection()
    cur = conn.cursor()
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
    species_raw = (data.get("species") or "").strip().lower()
    species = ALLOWED_PET_SPECIES.get(species_raw)
    breed = (data.get("breed") or "").strip() or None
    age_months = data.get("age_months")
    weight_kg = data.get("weight_kg")
    allergies = (data.get("allergies") or "").strip() or None
    diseases = (data.get("diseases") or "").strip() or None
    photo_url = (data.get("photo_url") or "").strip() or None

    if not name or not species:
        return json_error("Name and species (Dog/Cat) are required.")

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


@api_bp.delete("/pets/<int:pet_id>")
def api_delete_pet(pet_id):
    user, err = require_auth()
    if err:
        return err
    if user["role"] != "owner":
        return json_error("Only owners can delete pets.", 403)

    conn = get_connection()
    cur = conn.cursor()
    try:
        cur.execute("SELECT OwnerId FROM dbo.Pets WHERE Id = ?", (pet_id,))
        row = cur.fetchone()
        if not row or row[0] != user["id"]:
            return json_error("Pet not found.", 404)

        # Delete in FK-safe order.
        cur.execute(
            """
            DELETE m
            FROM dbo.Messages m
            JOIN dbo.Chats c ON c.Id = m.ChatId
            WHERE c.PetId = ?
            """,
            (pet_id,),
        )
        cur.execute("DELETE FROM dbo.ChatRequests WHERE PetId = ?", (pet_id,))
        cur.execute("DELETE FROM dbo.Chats WHERE PetId = ?", (pet_id,))

        cur.execute("SELECT Id FROM dbo.Appointments WHERE PetId = ?", (pet_id,))
        appt_ids = [r[0] for r in cur.fetchall()]
        for appt_id in appt_ids:
            cur.execute("DELETE FROM dbo.OwnerNotifications WHERE AppointmentId = ?", (appt_id,))
            cur.execute("DELETE FROM dbo.VetNotifications WHERE AppointmentId = ?", (appt_id,))
            cur.execute("DELETE FROM dbo.AppointmentReports WHERE AppointmentId = ?", (appt_id,))
        cur.execute("DELETE FROM dbo.Appointments WHERE PetId = ?", (pet_id,))

        cur.execute("DELETE FROM dbo.VetNotifications WHERE PetId = ?", (pet_id,))

        cur.execute("DELETE FROM dbo.Records WHERE PetId = ?", (pet_id,))
        cur.execute("DELETE FROM dbo.Vaccinations WHERE PetId = ?", (pet_id,))
        cur.execute("DELETE FROM dbo.Medications WHERE PetId = ?", (pet_id,))
        cur.execute("DELETE FROM dbo.HealthLogs WHERE PetId = ?", (pet_id,))

        cur.execute("SELECT Id FROM dbo.Meals WHERE PetId = ?", (pet_id,))
        meal_ids = [r[0] for r in cur.fetchall()]
        for meal_id in meal_ids:
            cur.execute("DELETE FROM dbo.MealLogs WHERE MealId = ?", (meal_id,))
        cur.execute("DELETE FROM dbo.Meals WHERE PetId = ?", (pet_id,))

        cur.execute("DELETE FROM dbo.DietPlans WHERE PetId = ?", (pet_id,))
        cur.execute("DELETE FROM dbo.Pets WHERE Id = ? AND OwnerId = ?", (pet_id, user["id"]))
        conn.commit()
        return jsonify({"ok": True})
    except Exception as e:
        conn.rollback()
        return json_error(f"Delete pet failed: {e}", 500)
    finally:
        conn.close()


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
                   a.PetId,
                   a.OwnerId,
                   p.Name AS PetName,
                   u.FullName AS VetName,
                   CASE WHEN r.AppointmentId IS NULL THEN 0 ELSE 1 END AS HasReport
            FROM dbo.Appointments a
            JOIN dbo.Pets p ON p.Id = a.PetId
            JOIN dbo.Users u ON u.Id = a.VetUserId
            LEFT JOIN dbo.AppointmentReports r ON r.AppointmentId = a.Id
            WHERE a.OwnerId = ?
            ORDER BY a.StartTime DESC
            """,
            (user["id"],),
        )
    else:
        cur.execute(
            """
            SELECT a.Id, a.Type, a.Status, a.StartTime, a.EndTime, a.Notes,
                   a.PetId,
                   a.OwnerId,
                   p.Name AS PetName,
                   o.FullName AS OwnerName,
                   CASE WHEN r.AppointmentId IS NULL THEN 0 ELSE 1 END AS HasReport
            FROM dbo.Appointments a
            JOIN dbo.Pets p ON p.Id = a.PetId
            JOIN dbo.Users o ON o.Id = a.OwnerId
            LEFT JOIN dbo.AppointmentReports r ON r.AppointmentId = a.Id
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
    appointment_kind = (data.get("appointment_kind") or "").strip().lower()
    vaccine_name = (data.get("vaccine_name") or "").strip()
    start_time = data.get("start_time")
    end_time = data.get("end_time")
    notes = (data.get("notes") or "").strip() or None

    if not pet_id or not vet_user_id or not start_time:
        return json_error("pet_id, vet_user_id, and start_time are required.")

    conn = get_connection()
    cur = conn.cursor()
    try:
        # verify pet belongs to owner
        cur.execute("SELECT OwnerId, Species, Name FROM dbo.Pets WHERE Id = ?", (pet_id,))
        row = cur.fetchone()
        if not row or row[0] != user["id"]:
            return json_error("Pet not found.", 404)
        pet_species = (row[1] or "").strip().lower()
        pet_name = row[2] or "pet"

        if appointment_kind == "vaccination":
            allowed = CORE_VACCINES.get(pet_species, [])
            if not vaccine_name:
                return json_error("vaccine_name is required for vaccination appointment.")
            if vaccine_name not in allowed:
                return json_error("Selected vaccine is not valid for this pet species.")
            appt_type = f"Vaccination: {vaccine_name}"
        elif appointment_kind == "general_checkup":
            appt_type = "General Checkup"
        elif not appt_type:
            appt_type = "General Checkup"

        cur.execute(
            """
            INSERT INTO dbo.Appointments
              (OwnerId, VetUserId, PetId, Type, Status, StartTime, EndTime, Notes)
            OUTPUT INSERTED.Id
            VALUES (?, ?, ?, ?, 'Pending', ?, ?, ?)
            """,
            (user["id"], vet_user_id, pet_id, appt_type, start_time, end_time, notes),
        )
        appt_id = cur.fetchone()[0]
        create_vet_notification(
            cur,
            vet_user_id,
            user["id"],
            pet_id,
            appt_id,
            "appointment_new",
            f"New appointment request for {pet_name} ({appt_type}).",
        )
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
            SELECT a.OwnerId, a.VetUserId, a.Status, p.Name, a.Type
            FROM dbo.Appointments a
            JOIN dbo.Pets p ON p.Id = a.PetId
            WHERE a.Id = ?
            """,
            (appt_id,),
        )
        row = cur.fetchone()
        if not row:
            return json_error("Appointment not found.", 404)

        owner_id, vet_id, old_status, pet_name, appt_type = row
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
        if user["role"] == "vet":
            if status and status != old_status:
                if status == "Scheduled":
                    msg = f"Appointment approved for {pet_name} ({appt_type})."
                elif status == "Declined":
                    msg = f"Appointment declined for {pet_name} ({appt_type})."
                elif status == "In Progress":
                    msg = f"Appointment started for {pet_name} ({appt_type})."
                elif status == "Completed":
                    msg = f"Appointment completed for {pet_name} ({appt_type})."
                else:
                    msg = f"Appointment updated for {pet_name} ({appt_type})."
                create_owner_notification(cur, owner_id, appt_id, "appointment_update", msg)
            elif start_time or end_time or notes:
                msg = f"Appointment details updated for {pet_name} ({appt_type})."
                create_owner_notification(cur, owner_id, appt_id, "appointment_change", msg)
        elif user["role"] == "owner":
            if start_time or end_time or notes:
                msg = f"Owner updated appointment details for {pet_name} ({appt_type})."
                create_vet_notification(cur, vet_id, owner_id, None, appt_id, "appointment_change", msg)
        conn.commit()
        return jsonify({"ok": True})
    except Exception as e:
        conn.rollback()
        return json_error(f"Update appointment failed: {e}", 500)
    finally:
        conn.close()


@api_bp.get("/appointments/<int:appt_id>/report")
def api_get_appointment_report(appt_id):
    user, err = require_auth()
    if err:
        return err

    conn = get_connection()
    cur = conn.cursor()
    try:
        appt, appt_err = get_appointment_with_access(cur, appt_id, user)
        if appt_err:
            return appt_err

        cur.execute(
            """
            SELECT AppointmentId, VetUserId, Diagnosis, MedicationsAndDoses, DietRecommendation,
                   GeneralRecommendation, CreatedAt, UpdatedAt
            FROM dbo.AppointmentReports
            WHERE AppointmentId = ?
            """,
            (appt_id,),
        )
        report = fetchone_dict(cur)
        return jsonify({"appointment": appt, "report": report})
    except Exception as e:
        return json_error(f"Fetch report failed: {e}", 500)
    finally:
        conn.close()


@api_bp.put("/appointments/<int:appt_id>/report")
def api_upsert_appointment_report(appt_id):
    user, err = require_auth()
    if err:
        return err
    if user["role"] != "vet":
        return json_error("Only vets can edit reports.", 403)

    data = parse_json()
    diagnosis = (data.get("diagnosis") or "").strip()
    meds = (data.get("medications_and_doses") or "").strip() or None
    diet = (data.get("diet_recommendation") or "").strip() or None
    general = (data.get("general_recommendation") or "").strip() or None

    if not diagnosis:
        return json_error("Diagnosis is required.")

    conn = get_connection()
    cur = conn.cursor()
    try:
        appt, appt_err = get_appointment_with_access(cur, appt_id, user)
        if appt_err:
            return appt_err
        if appt["Status"] != "Completed":
            return json_error("Report can be added only after appointment is completed.", 400)

        cur.execute("SELECT 1 FROM dbo.AppointmentReports WHERE AppointmentId = ?", (appt_id,))
        existed = cur.fetchone() is not None

        cur.execute(
            """
            IF EXISTS (SELECT 1 FROM dbo.AppointmentReports WHERE AppointmentId = ?)
            BEGIN
                UPDATE dbo.AppointmentReports
                SET Diagnosis = ?,
                    MedicationsAndDoses = ?,
                    DietRecommendation = ?,
                    GeneralRecommendation = ?,
                    UpdatedAt = GETUTCDATE()
                WHERE AppointmentId = ?
            END
            ELSE
            BEGIN
                INSERT INTO dbo.AppointmentReports
                    (AppointmentId, VetUserId, Diagnosis, MedicationsAndDoses, DietRecommendation, GeneralRecommendation)
                VALUES (?, ?, ?, ?, ?, ?)
            END
            """,
            (
                appt_id,
                diagnosis,
                meds,
                diet,
                general,
                appt_id,
                appt_id,
                user["id"],
                diagnosis,
                meds,
                diet,
                general,
            ),
        )
        create_owner_notification(
            cur,
            appt["OwnerId"],
            appt_id,
            "report_added" if not existed else "report_updated",
            f"Medical report {'added' if not existed else 'updated'} for {appt['PetName']} ({appt['Type']}).",
        )
        conn.commit()
        return jsonify({"ok": True})
    except Exception as e:
        conn.rollback()
        return json_error(f"Save report failed: {e}", 500)
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


@api_bp.post("/pets/<int:pet_id>/diet-plans/generate")
def api_generate_diet_plan(pet_id):
    user, err = require_auth()
    if err:
        return err
    if user["role"] != "owner":
        return json_error("Only owners can generate diet plans.", 403)
    conn = get_connection()
    cur = conn.cursor()
    cur.execute("SELECT OwnerId FROM dbo.Pets WHERE Id = ?", (pet_id,))
    row = cur.fetchone()
    if not row or row[0] != user["id"]:
        conn.close()
        return json_error("Pet not found.", 404)
    try:
        plan = generate_diet_plan(conn, pet_id)
        return jsonify(plan)
    except Exception as e:
        conn.rollback()
        return json_error(f"Generate diet plan failed: {e}", 500)
    finally:
        conn.close()


@api_bp.put("/diet-plans/<int:plan_id>")
def api_update_diet_plan(plan_id):
    user, err = require_auth()
    if err:
        return err
    data = parse_json()
    details = data.get("details")
    title = data.get("title")
    calories = data.get("calories")
    allergies = data.get("allergies")
    conn = get_connection()
    cur = conn.cursor()
    try:
        cur.execute(
            """
            SELECT p.OwnerId
            FROM dbo.DietPlans d
            JOIN dbo.Pets p ON p.Id = d.PetId
            WHERE d.Id = ?
            """,
            (plan_id,),
        )
        row = cur.fetchone()
        if not row or row[0] != user["id"]:
            return json_error("Not found.", 404)
        cur.execute(
            """
            UPDATE dbo.DietPlans
            SET Title = COALESCE(?, Title),
                Details = COALESCE(?, Details),
                Calories = COALESCE(?, Calories),
                Allergies = COALESCE(?, Allergies),
                UpdatedAt = GETUTCDATE()
            WHERE Id = ?
            """,
            (title, details, calories, allergies, plan_id),
        )
        conn.commit()
        return jsonify({"ok": True})
    except Exception as e:
        conn.rollback()
        return json_error(f"Update diet plan failed: {e}", 500)
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
        SELECT
            x.Id,
            x.PetId,
            x.Title,
            x.FileUrl,
            x.Notes,
            x.VisitDate,
            x.CreatedAt
        FROM (
            SELECT
                r.Id,
                r.PetId,
                r.Title,
                r.FileUrl,
                r.Notes,
                r.VisitDate,
                r.CreatedAt
            FROM dbo.Records r
            WHERE r.PetId = ?

            UNION ALL

            SELECT
                (1000000000 + ar.Id) AS Id,
                a.PetId,
                CONCAT('Appointment Report - ', a.Type) AS Title,
                NULL AS FileUrl,
                CONCAT(
                    'Doctor: ', v.FullName, CHAR(10),
                    'User: ', o.FullName, CHAR(10),
                    'Pet: ', p.Name, CHAR(10),
                    'Appointment Type: ', a.Type, CHAR(10),
                    'Status: ', a.Status, CHAR(10),
                    'Start: ', CONVERT(NVARCHAR(19), a.StartTime, 120), CHAR(10),
                    'End: ', COALESCE(CONVERT(NVARCHAR(19), a.EndTime, 120), '-'), CHAR(10),
                    'Diagnosis: ', ar.Diagnosis, CHAR(10),
                    'Medication and doses: ', COALESCE(ar.MedicationsAndDoses, '-'), CHAR(10),
                    'Diet recommendation: ', COALESCE(ar.DietRecommendation, '-'), CHAR(10),
                    'General recommendation: ', COALESCE(ar.GeneralRecommendation, '-')
                ) AS Notes,
                CAST(a.StartTime AS DATE) AS VisitDate,
                ar.CreatedAt
            FROM dbo.AppointmentReports ar
            JOIN dbo.Appointments a ON a.Id = ar.AppointmentId
            JOIN dbo.Pets p ON p.Id = a.PetId
            JOIN dbo.Users o ON o.Id = a.OwnerId
            JOIN dbo.Users v ON v.Id = a.VetUserId
            WHERE a.PetId = ?
        ) x
        ORDER BY x.CreatedAt DESC
        """,
        (pet_id, pet_id),
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


# -------- Health Logs --------

@api_bp.get("/pets/<int:pet_id>/health-logs")
def api_list_health_logs(pet_id):
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
        SELECT Id, PetId, Mood, Appetite, Notes, CreatedAt
        FROM dbo.HealthLogs
        WHERE PetId = ?
        ORDER BY CreatedAt DESC
        """,
        (pet_id,),
    )
    items = fetchall_dict(cur)
    conn.close()
    return jsonify(items)


@api_bp.post("/pets/<int:pet_id>/health-logs")
def api_create_health_log(pet_id):
    user, err = require_auth()
    if err:
        return err
    if user["role"] != "owner":
        return json_error("Only owners can add logs.", 403)
    data = parse_json()
    mood = (data.get("mood") or "").strip() or None
    appetite = (data.get("appetite") or "").strip() or None
    notes = (data.get("notes") or "").strip() or None
    conn = get_connection()
    cur = conn.cursor()
    try:
        cur.execute("SELECT OwnerId FROM dbo.Pets WHERE Id = ?", (pet_id,))
        row = cur.fetchone()
        if not row or row[0] != user["id"]:
            return json_error("Pet not found.", 404)
        cur.execute(
            """
            INSERT INTO dbo.HealthLogs (PetId, OwnerId, Mood, Appetite, Notes)
            OUTPUT INSERTED.Id
            VALUES (?, ?, ?, ?, ?)
            """,
            (pet_id, user["id"], mood, appetite, notes),
        )
        item_id = cur.fetchone()[0]
        conn.commit()
        return jsonify({"id": item_id})
    except Exception as e:
        conn.rollback()
        return json_error(f"Create log failed: {e}", 500)
    finally:
        conn.close()


# -------- Meals --------

@api_bp.get("/pets/<int:pet_id>/meals")
def api_list_meals(pet_id):
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
        SELECT Id, PetId, Title, MealTime, Calories, Portion, CreatedAt
        FROM dbo.Meals
        WHERE PetId = ?
        ORDER BY CreatedAt DESC
        """,
        (pet_id,),
    )
    items = fetchall_dict(cur)
    conn.close()
    return jsonify(items)


@api_bp.post("/pets/<int:pet_id>/meals")
def api_create_meal(pet_id):
    user, err = require_auth()
    if err:
        return err
    if user["role"] != "owner":
        return json_error("Only owners can add meals.", 403)
    data = parse_json()
    title = (data.get("title") or "").strip()
    meal_time = (data.get("meal_time") or "").strip() or None
    calories = data.get("calories")
    portion = (data.get("portion") or "").strip() or None
    if not title:
        return json_error("Meal title required.")
    conn = get_connection()
    cur = conn.cursor()
    try:
        cur.execute("SELECT OwnerId FROM dbo.Pets WHERE Id = ?", (pet_id,))
        row = cur.fetchone()
        if not row or row[0] != user["id"]:
            return json_error("Pet not found.", 404)
        cur.execute(
            """
            INSERT INTO dbo.Meals (PetId, Title, MealTime, Calories, Portion)
            OUTPUT INSERTED.Id
            VALUES (?, ?, ?, ?, ?)
            """,
            (pet_id, title, meal_time, calories, portion),
        )
        meal_id = cur.fetchone()[0]
        conn.commit()
        return jsonify({"id": meal_id})
    except Exception as e:
        conn.rollback()
        return json_error(f"Create meal failed: {e}", 500)
    finally:
        conn.close()


@api_bp.post("/meals/<int:meal_id>/fed")
def api_mark_fed(meal_id):
    user, err = require_auth()
    if err:
        return err
    conn = get_connection()
    cur = conn.cursor()
    try:
        cur.execute(
            """
            SELECT p.OwnerId
            FROM dbo.Meals m
            JOIN dbo.Pets p ON p.Id = m.PetId
            WHERE m.Id = ?
            """,
            (meal_id,),
        )
        row = cur.fetchone()
        if not row or row[0] != user["id"]:
            return json_error("Meal not found.", 404)
        cur.execute("INSERT INTO dbo.MealLogs (MealId) VALUES (?)", (meal_id,))
        conn.commit()
        return jsonify({"ok": True})
    except Exception as e:
        conn.rollback()
        return json_error(f"Mark fed failed: {e}", 500)
    finally:
        conn.close()


# -------- Settings --------

@api_bp.get("/settings")
def api_get_settings():
    user, err = require_auth()
    if err:
        return err
    if user["role"] != "owner":
        return json_error("Only owners have settings.", 403)
    conn = get_connection()
    try:
        ensure_owner_settings(conn, user["id"])
        conn.commit()
        cur = conn.cursor()
        cur.execute(
            "SELECT NotificationsEnabled, DietRemindersEnabled FROM dbo.OwnerSettings WHERE OwnerId = ?",
            (user["id"],),
        )
        row = cur.fetchone()
        return jsonify(
            {
                "notifications": bool(row[0]) if row else True,
                "diet_reminders": bool(row[1]) if row else True,
            }
        )
    finally:
        conn.close()


@api_bp.put("/settings")
def api_update_settings():
    user, err = require_auth()
    if err:
        return err
    if user["role"] != "owner":
        return json_error("Only owners have settings.", 403)
    data = parse_json()
    notifications = 1 if data.get("notifications", True) else 0
    diet_reminders = 1 if data.get("diet_reminders", True) else 0
    conn = get_connection()
    try:
        ensure_owner_settings(conn, user["id"])
        cur = conn.cursor()
        cur.execute(
            """
            UPDATE dbo.OwnerSettings
            SET NotificationsEnabled=?, DietRemindersEnabled=?
            WHERE OwnerId=?
            """,
            (notifications, diet_reminders, user["id"]),
        )
        conn.commit()
        return jsonify({"ok": True})
    except Exception as e:
        conn.rollback()
        return json_error(f"Update settings failed: {e}", 500)
    finally:
        conn.close()


# -------- Chat Requests + Messages --------

@api_bp.get("/chat/requests")
def api_list_chat_requests():
    user, err = require_auth()
    if err:
        return err
    conn = get_connection()
    cur = conn.cursor()
    if user["role"] == "owner":
        cur.execute(
            """
            SELECT r.Id, r.OwnerId, r.VetUserId, r.PetId, r.Message, r.Status, r.CreatedAt,
                   u.FullName AS VetName
            FROM dbo.ChatRequests r
            JOIN dbo.Users u ON u.Id = r.VetUserId
            WHERE r.OwnerId = ?
            ORDER BY r.CreatedAt DESC
            """,
            (user["id"],),
        )
    else:
        cur.execute(
            """
            SELECT r.Id, r.OwnerId, r.VetUserId, r.PetId, r.Message, r.Status, r.CreatedAt,
                   u.FullName AS OwnerName
            FROM dbo.ChatRequests r
            JOIN dbo.Users u ON u.Id = r.OwnerId
            WHERE r.VetUserId = ? AND r.Status = 'Pending'
            ORDER BY r.CreatedAt DESC
            """,
            (user["id"],),
        )
    rows = fetchall_dict(cur)
    conn.close()
    return jsonify(rows)


@api_bp.post("/chat/requests")
def api_create_chat_request():
    user, err = require_auth()
    if err:
        return err
    if user["role"] != "owner":
        return json_error("Only owners can request chat.", 403)
    data = parse_json()
    vet_user_id = data.get("vet_user_id")
    pet_id = data.get("pet_id")
    message = (data.get("message") or "").strip() or None
    if not vet_user_id:
        return json_error("vet_user_id required.")
    if not pet_id:
        return json_error("pet_id required.")
    conn = get_connection()
    cur = conn.cursor()
    try:
        cur.execute("SELECT Name FROM dbo.Pets WHERE Id = ? AND OwnerId = ?", (pet_id, user["id"]))
        prow = cur.fetchone()
        if not prow:
            return json_error("Selected pet is not yours.", 403)
        pet_name = prow[0]

        cur.execute(
            """
            SELECT TOP 1 Id
            FROM dbo.Chats
            WHERE OwnerId = ? AND VetUserId = ? AND PetId = ?
            ORDER BY Id DESC
            """,
            (user["id"], vet_user_id, pet_id),
        )
        chat = cur.fetchone()
        if chat:
            return jsonify({"chat_id": chat[0], "existing": True})

        cur.execute(
            """
            SELECT TOP 1 Id
            FROM dbo.ChatRequests
            WHERE OwnerId = ? AND VetUserId = ? AND PetId = ? AND Status = 'Pending'
            ORDER BY Id DESC
            """,
            (user["id"], vet_user_id, pet_id),
        )
        pending = cur.fetchone()
        if pending:
            return jsonify({"id": pending[0], "pending": True})

        cur.execute(
            """
            INSERT INTO dbo.ChatRequests (OwnerId, VetUserId, PetId, Message, Status)
            OUTPUT INSERTED.Id
            VALUES (?, ?, ?, ?, 'Pending')
            """,
            (user["id"], vet_user_id, pet_id, message),
        )
        req_id = cur.fetchone()[0]
        create_vet_notification(
            cur,
            vet_user_id,
            user["id"],
            pet_id,
            None,
            "chat_request",
            f"New chat request from {user['full_name']} for {pet_name}.",
        )
        conn.commit()
        return jsonify({"id": req_id})
    except Exception as e:
        conn.rollback()
        return json_error(f"Chat request failed: {e}", 500)
    finally:
        conn.close()


@api_bp.post("/chat/requests/<int:req_id>/accept")
def api_accept_chat_request(req_id):
    user, err = require_auth()
    if err:
        return err
    if user["role"] != "vet":
        return json_error("Only vets can accept.", 403)
    conn = get_connection()
    cur = conn.cursor()
    try:
        cur.execute(
            """
            SELECT OwnerId, VetUserId, PetId FROM dbo.ChatRequests WHERE Id = ? AND Status = 'Pending'
            """,
            (req_id,),
        )
        row = cur.fetchone()
        if not row or row[1] != user["id"]:
            return json_error("Request not found.", 404)
        owner_id = row[0]
        pet_id = row[2]
        cur.execute(
            """
            SELECT TOP 1 Id
            FROM dbo.Chats
            WHERE OwnerId = ? AND VetUserId = ? AND PetId = ?
            ORDER BY Id DESC
            """,
            (owner_id, user["id"], pet_id),
        )
        existing = cur.fetchone()
        if existing:
            chat_id = existing[0]
        else:
            cur.execute(
                "INSERT INTO dbo.Chats (OwnerId, VetUserId, PetId) OUTPUT INSERTED.Id VALUES (?, ?, ?)",
                (owner_id, user["id"], pet_id),
            )
            chat_id = cur.fetchone()[0]
        cur.execute("UPDATE dbo.ChatRequests SET Status='Accepted' WHERE Id=?", (req_id,))
        conn.commit()
        return jsonify({"chat_id": chat_id})
    except Exception as e:
        conn.rollback()
        return json_error(f"Accept failed: {e}", 500)
    finally:
        conn.close()


@api_bp.post("/chat/requests/<int:req_id>/decline")
def api_decline_chat_request(req_id):
    user, err = require_auth()
    if err:
        return err
    if user["role"] != "vet":
        return json_error("Only vets can decline.", 403)
    conn = get_connection()
    cur = conn.cursor()
    cur.execute(
        """
        UPDATE dbo.ChatRequests SET Status='Declined'
        WHERE Id=? AND VetUserId=?
        """,
        (req_id, user["id"]),
    )
    conn.commit()
    conn.close()
    return jsonify({"ok": True})


@api_bp.get("/chats")
def api_list_chats():
    user, err = require_auth()
    if err:
        return err
    conn = get_connection()
    cur = conn.cursor()
    if user["role"] == "owner":
        cur.execute(
            """
            SELECT c.Id, c.OwnerId, c.VetUserId, c.PetId, c.CreatedAt,
                   u.FullName AS VetName,
                   p.Name AS PetName,
                   m.Body AS LastBody,
                   m.CreatedAt AS LastAt,
                   m.SenderRole AS LastSenderRole
            FROM dbo.Chats c
            JOIN dbo.Users u ON u.Id = c.VetUserId
            LEFT JOIN dbo.Pets p ON p.Id = c.PetId
            OUTER APPLY (
                SELECT TOP 1 Body, CreatedAt, SenderRole
                FROM dbo.Messages
                WHERE ChatId = c.Id
                ORDER BY CreatedAt DESC
            ) m
            WHERE c.OwnerId = ?
            ORDER BY c.CreatedAt DESC
            """,
            (user["id"],),
        )
    else:
        cur.execute(
            """
            SELECT c.Id, c.OwnerId, c.VetUserId, c.PetId, c.CreatedAt,
                   u.FullName AS OwnerName,
                   p.Name AS PetName,
                   m.Body AS LastBody,
                   m.CreatedAt AS LastAt,
                   m.SenderRole AS LastSenderRole
            FROM dbo.Chats c
            JOIN dbo.Users u ON u.Id = c.OwnerId
            LEFT JOIN dbo.Pets p ON p.Id = c.PetId
            OUTER APPLY (
                SELECT TOP 1 Body, CreatedAt, SenderRole
                FROM dbo.Messages
                WHERE ChatId = c.Id
                ORDER BY CreatedAt DESC
            ) m
            WHERE c.VetUserId = ?
            ORDER BY c.CreatedAt DESC
            """,
            (user["id"],),
        )
    rows = fetchall_dict(cur)
    conn.close()
    return jsonify(rows)


@api_bp.get("/chats/<int:chat_id>/messages")
def api_list_messages(chat_id):
    user, err = require_auth()
    if err:
        return err
    conn = get_connection()
    cur = conn.cursor()
    cur.execute(
        """
        SELECT c.OwnerId, c.VetUserId
        FROM dbo.Chats c
        WHERE c.Id = ?
        """,
        (chat_id,),
    )
    row = cur.fetchone()
    if not row or user["id"] not in (row[0], row[1]):
        conn.close()
        return json_error("Chat not found.", 404)
    cur.execute(
        """
        SELECT Id, ChatId, SenderRole, SenderId, Body, CreatedAt
        FROM dbo.Messages
        WHERE ChatId = ?
        ORDER BY CreatedAt ASC
        """,
        (chat_id,),
    )
    msgs = fetchall_dict(cur)
    conn.close()
    return jsonify(msgs)


@api_bp.post("/chats/<int:chat_id>/messages")
def api_send_message(chat_id):
    user, err = require_auth()
    if err:
        return err
    data = parse_json()
    body = (data.get("body") or "").strip()
    if not body:
        return json_error("Message required.")
    conn = get_connection()
    cur = conn.cursor()
    cur.execute(
        "SELECT OwnerId, VetUserId, PetId FROM dbo.Chats WHERE Id = ?",
        (chat_id,),
    )
    row = cur.fetchone()
    if not row or user["id"] not in (row[0], row[1]):
        conn.close()
        return json_error("Chat not found.", 404)
    owner_id, vet_id, pet_id = row[0], row[1], row[2]
    cur.execute(
        """
        INSERT INTO dbo.Messages (ChatId, SenderRole, SenderId, Body)
        OUTPUT INSERTED.Id
        VALUES (?, ?, ?, ?)
        """,
        (chat_id, user["role"], user["id"], body),
    )
    msg_id = cur.fetchone()[0]
    if user["role"] == "owner":
        pet_name = None
        if pet_id:
            cur.execute("SELECT Name FROM dbo.Pets WHERE Id = ?", (pet_id,))
            prow = cur.fetchone()
            pet_name = prow[0] if prow else None
        notif_msg = f"New message from {user['full_name']}"
        if pet_name:
            notif_msg += f" ({pet_name})"
        notif_msg += "."
        create_vet_notification(cur, int(vet_id), int(owner_id), pet_id, None, "chat_message", notif_msg)
    else:
        pet_name = None
        if pet_id:
            cur.execute("SELECT Name FROM dbo.Pets WHERE Id = ?", (pet_id,))
            prow = cur.fetchone()
            pet_name = prow[0] if prow else None
        notif_msg = f"New message from Dr. {user['full_name']}"
        if pet_name:
            notif_msg += f" about {pet_name}"
        notif_msg += "."
        create_owner_notification(cur, int(owner_id), None, "chat_message", notif_msg)
    conn.commit()
    conn.close()
    return jsonify({"id": msg_id})


# -------- Vet Patients --------

@api_bp.get("/vet/patients")
def api_vet_patients():
    user, err = require_auth()
    if err:
        return err
    if user["role"] != "vet":
        return json_error("Only vets can access this.", 403)
    conn = get_connection()
    cur = conn.cursor()
    cur.execute(
        """
        SELECT DISTINCT
            p.Id AS PetId,
            p.Name AS PetName,
            p.Species,
            p.Breed,
            p.AgeMonths,
            p.WeightKg,
            o.Id AS OwnerId,
            o.FullName AS OwnerName,
            (SELECT TOP 1 StartTime
             FROM dbo.Appointments a2
             WHERE a2.PetId = p.Id AND a2.VetUserId = ?
             ORDER BY a2.StartTime DESC) AS LastVisit,
            (SELECT TOP 1 StartTime
             FROM dbo.Appointments a3
             WHERE a3.PetId = p.Id AND a3.VetUserId = ? AND a3.StartTime > GETDATE()
             ORDER BY a3.StartTime ASC) AS NextVisit
        FROM dbo.Appointments a
        JOIN dbo.Pets p ON p.Id = a.PetId
        JOIN dbo.Users o ON o.Id = p.OwnerId
        WHERE a.VetUserId = ?
        ORDER BY p.Name
        """,
        (user["id"], user["id"], user["id"]),
    )
    rows = fetchall_dict(cur)
    conn.close()
    return jsonify(rows)


@api_bp.get("/chats/<int:chat_id>/stream")
def api_stream_messages(chat_id):
    user, err = require_auth()
    if err:
        return err

    def event_stream():
        last_id = request.args.get("last_id", "0")
        try:
            last_id = int(last_id)
        except Exception:
            last_id = 0

        while True:
            conn = get_connection()
            cur = conn.cursor()
            cur.execute(
                "SELECT OwnerId, VetUserId FROM dbo.Chats WHERE Id = ?",
                (chat_id,),
            )
            row = cur.fetchone()
            if not row or user["id"] not in (row[0], row[1]):
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
