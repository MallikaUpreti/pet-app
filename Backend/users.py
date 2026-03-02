from flask import Blueprint, render_template, request, redirect, url_for, flash, session
from werkzeug.security import generate_password_hash
from db import get_connection, fetchall_dict, fetchone_dict

users_bp = Blueprint("users", __name__)


def require_login():
    return bool(session.get("user_id"))


@users_bp.get("/")
def home():
    return redirect(url_for("users.list_users"))


@users_bp.route("/users", methods=["GET", "POST"])
def list_users():
    if not require_login():
        return redirect(url_for("auth.login"))

    conn = get_connection()
    cur = conn.cursor()

    # -----------------------
    # ADD USER (POST)
    # -----------------------
    if request.method == "POST":
        full_name = (request.form.get("full_name") or "").strip()
        email = (request.form.get("email") or "").strip()
        phone = (request.form.get("phone") or "").strip() or None
        role = (request.form.get("role") or "owner").strip().lower()
        password = (request.form.get("password") or "").strip()

        # Vet fields (match HTML + DB)
        clinic_name = (request.form.get("clinic_name") or "").strip() or None
        license_no = (request.form.get("license_no") or "").strip() or None
        clinic_phone = (request.form.get("clinic_phone") or "").strip() or None
        bio = (request.form.get("bio") or "").strip() or None

        if not full_name or not email or not password:
            flash("Full Name, Email, Password required.", "error")
        elif role not in ("owner", "vet"):
            flash("Role must be owner or vet.", "error")
        else:
            try:
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
                        INSERT INTO dbo.VetProfiles
                          (UserId, ClinicName, LicenseNo, ClinicPhone, Bio)
                        VALUES (?, ?, ?, ?, ?)
                        """,
                        (user_id, clinic_name, license_no, clinic_phone, bio),
                    )

                conn.commit()
                flash("User added.", "success")
            except Exception as e:
                conn.rollback()
                print("ADD USER ERROR:", e)
                flash(f"Add failed: {e}", "error")

    # -----------------------
    # LIST USERS (GET)
    # -----------------------
    cur.execute(
        """
        SELECT
          u.Id, u.Role, u.FullName, u.Email, u.Phone, u.AvatarUrl, u.CreatedAt,
          vp.ClinicName, vp.LicenseNo, vp.ClinicPhone, vp.Bio,
          vp.IsOnline, vp.EmergencyEnabled, vp.Timezone
        FROM dbo.Users u
        LEFT JOIN dbo.VetProfiles vp ON vp.UserId = u.Id
        ORDER BY u.CreatedAt DESC
        """
    )
    users = fetchall_dict(cur)
    conn.close()
    return render_template("users.html", users=users)


@users_bp.route("/users/<string:user_id>/edit", methods=["GET", "POST"])
def edit_user(user_id):
    if not require_login():
        return redirect(url_for("auth.login"))

    conn = get_connection()
    cur = conn.cursor()

    if request.method == "POST":
        full_name = (request.form.get("full_name") or "").strip()
        email = (request.form.get("email") or "").strip()
        phone = (request.form.get("phone") or "").strip() or None
        role = (request.form.get("role") or "owner").strip().lower()

        # Vet fields (match HTML + DB)
        clinic_name = (request.form.get("clinic_name") or "").strip() or None
        license_no = (request.form.get("license_no") or "").strip() or None
        clinic_phone = (request.form.get("clinic_phone") or "").strip() or None
        bio = (request.form.get("bio") or "").strip() or None

        is_online = 1 if request.form.get("is_online") == "on" else 0
        emergency_enabled = 1 if request.form.get("emergency_enabled") == "on" else 0
        timezone = (request.form.get("timezone") or "Asia/Kathmandu").strip()

        if not full_name or not email:
            flash("Full Name and Email required.", "error")
        elif role not in ("owner", "vet"):
            flash("Role must be owner or vet.", "error")
        else:
            try:
                # Update dbo.Users
                cur.execute(
                    """
                    UPDATE dbo.Users
                    SET FullName=?, Email=?, Phone=?, Role=?
                    WHERE Id=?
                    """,
                    (full_name, email, phone, role, user_id),
                )

                if role == "vet":
                    # Upsert VetProfiles
                    cur.execute("SELECT COUNT(*) FROM dbo.VetProfiles WHERE UserId=?", (user_id,))
                    exists = cur.fetchone()[0] > 0

                    if exists:
                        cur.execute(
                            """
                            UPDATE dbo.VetProfiles
                            SET ClinicName=?,
                                LicenseNo=?,
                                ClinicPhone=?,
                                Bio=?,
                                IsOnline=?,
                                EmergencyEnabled=?,
                                Timezone=?
                            WHERE UserId=?
                            """,
                            (
                                clinic_name,
                                license_no,
                                clinic_phone,
                                bio,
                                is_online,
                                emergency_enabled,
                                timezone,
                                user_id,
                            ),
                        )
                    else:
                        cur.execute(
                            """
                            INSERT INTO dbo.VetProfiles
                              (UserId, ClinicName, LicenseNo, ClinicPhone, Bio, IsOnline, EmergencyEnabled, Timezone)
                            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                            """,
                            (
                                user_id,
                                clinic_name,
                                license_no,
                                clinic_phone,
                                bio,
                                is_online,
                                emergency_enabled,
                                timezone,
                            ),
                        )
                else:
                    # Owner → remove vet profile
                    cur.execute("DELETE FROM dbo.VetProfiles WHERE UserId=?", (user_id,))

                conn.commit()
                flash("User updated.", "success")
                conn.close()
                return redirect(url_for("users.list_users"))
            except Exception as e:
                conn.rollback()
                print("EDIT USER ERROR:", e)
                flash(f"Update failed: {e}", "error")

    # Load user for edit page
    cur.execute(
        """
        SELECT
          u.Id, u.Role, u.FullName, u.Email, u.Phone, u.AvatarUrl, u.CreatedAt,
          vp.ClinicName, vp.LicenseNo, vp.ClinicPhone, vp.Bio,
          vp.IsOnline, vp.EmergencyEnabled, vp.Timezone
        FROM dbo.Users u
        LEFT JOIN dbo.VetProfiles vp ON vp.UserId = u.Id
        WHERE u.Id=?
        """,
        (user_id,),
    )
    user = fetchone_dict(cur)
    conn.close()

    if not user:
        flash("User not found.", "error")
        return redirect(url_for("users.list_users"))

    return render_template("edit_user.html", user=user)


@users_bp.post("/users/<string:user_id>/delete")
def delete_user(user_id):
    if not require_login():
        return redirect(url_for("auth.login"))

    conn = get_connection()
    cur = conn.cursor()
    try:
        cur.execute("DELETE FROM dbo.VetProfiles WHERE UserId=?", (user_id,))
        cur.execute("DELETE FROM dbo.Users WHERE Id=?", (user_id,))
        conn.commit()
        flash("User deleted.", "success")
    except Exception as e:
        conn.rollback()
        print("DELETE USER ERROR:", e)
        flash(f"Delete failed: {e}", "error")
    finally:
        conn.close()

    return redirect(url_for("users.list_users"))