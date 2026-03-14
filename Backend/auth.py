from flask import Blueprint, render_template, request, redirect, url_for, flash, session
from werkzeug.security import generate_password_hash, check_password_hash
from db import get_connection

auth_bp = Blueprint("auth", __name__)


@auth_bp.get("/db-check")
def db_check():
    conn = get_connection()
    cur = conn.cursor()
    cur.execute("SELECT DB_NAME() AS DbName, @@SERVERNAME AS ServerName")
    row = cur.fetchone()
    conn.close()
    return {"DbName": row[0], "ServerName": row[1]}


@auth_bp.route("/signup", methods=["GET", "POST"])
def signup():
    if request.method == "GET":
        if session.get("user_id"):
            return redirect(url_for("dashboard.dashboard"))
        return render_template("signup.html")

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
        return redirect(url_for("auth.signup"))

    if role not in ("owner", "vet"):
        flash("Role must be owner or vet.", "error")
        return redirect(url_for("auth.signup"))

    password_hash = generate_password_hash(password, method="pbkdf2:sha256")

    conn = get_connection()
    cur = conn.cursor()
    try:
        # Insert user
        cur.execute(
            """
            INSERT INTO dbo.Users (Role, FullName, Email, Phone, PasswordHash)
            OUTPUT INSERTED.Id
            VALUES (?, ?, ?, ?, ?)
            """,
            (role, full_name, email, phone, password_hash),
        )
        user_id = cur.fetchone()[0]

        # Insert VetProfiles if vet
        if role == "vet":
            cur.execute(
                """
                INSERT INTO dbo.VetProfiles (UserId, ClinicName, LicenseNo, ClinicPhone, Bio)
                VALUES (?, ?, ?, ?, ?)
                """,
                (user_id, clinic_name, license_no, clinic_phone, bio),
            )

        conn.commit()
        flash("Signup successful. Now login.", "success")
        return redirect(url_for("auth.login"))
    except Exception as e:
        conn.rollback()
        print("SIGNUP ERROR:", e)
        flash(f"Signup failed: {e}", "error")
        return redirect(url_for("auth.signup"))
    finally:
        conn.close()


@auth_bp.route("/login", methods=["GET", "POST"])
def login():
    if request.method == "GET":
        if session.get("user_id"):
            return redirect(url_for("dashboard.dashboard"))
        return render_template("login.html")

    email = (request.form.get("email") or "").strip()
    password = (request.form.get("password") or "").strip()
    selected_role = (request.form.get("login_role") or "").strip()

    conn = get_connection()
    cur = conn.cursor()
    cur.execute(
        """
        SELECT TOP 1 Id, Role, FullName, PasswordHash
        FROM dbo.Users
        WHERE Email = ?
        """,
        (email,),
    )
    row = cur.fetchone()
    conn.close()

    if not row:
        flash("Invalid credentials.", "error")
        return redirect(url_for("auth.login"))

    user_id, role, full_name, pw_hash = row
    if not check_password_hash(pw_hash, password):
        flash("Invalid credentials.", "error")
        return redirect(url_for("auth.login"))

    if selected_role and selected_role != role:
        flash("Invalid role selected for this account.", "error")
        return redirect(url_for("auth.login"))

    session["user_id"] = str(user_id)
    session["role"] = role
    session["full_name"] = full_name

    flash("Logged in.", "success")
    return redirect(url_for("dashboard.dashboard"))


@auth_bp.route("/logout", methods=["GET", "POST"])
def logout():
    session.clear()
    flash("Logged out.", "success")
    return redirect(url_for("auth.login"))
