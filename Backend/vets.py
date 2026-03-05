from flask import Blueprint, render_template, session, request, redirect, url_for, flash
from auth_utils import role_required
from db import get_connection, fetchall_dict, fetchone_dict

vet_bp = Blueprint("vet", __name__)

@vet_bp.route("/vet", methods=["GET", "POST"])
@role_required("vet")
def vet_home():
    vet_id = session["user_id"]

    conn = get_connection()
    cur = conn.cursor()
    if request.method == "POST":
        is_online = 1 if request.form.get("is_online") == "on" else 0
        cur.execute(
            "UPDATE dbo.VetProfiles SET IsOnline=? WHERE UserId=?",
            (is_online, vet_id),
        )
        conn.commit()
        flash("Availability updated.", "success")

    cur.execute("""
        SELECT a.Id, a.Type, a.Status, a.StartTime, a.EndTime,
               p.Name AS PetName,
               u.FullName AS OwnerName, u.Id AS OwnerId
        FROM dbo.Appointments a
        JOIN dbo.Pets p ON p.Id = a.PetId
        JOIN dbo.Users u ON u.Id = a.OwnerId
        WHERE a.VetUserId = ?
        ORDER BY a.StartTime DESC
    """, (vet_id,))
    appts = fetchall_dict(cur)

    cur.execute(
        """
        SELECT COUNT(DISTINCT p.Id)
        FROM dbo.Appointments a
        JOIN dbo.Pets p ON p.Id = a.PetId
        WHERE a.VetUserId = ?
        """,
        (vet_id,),
    )
    patients_count = cur.fetchone()[0] or 0

    cur.execute("SELECT IsOnline FROM dbo.VetProfiles WHERE UserId=?", (vet_id,))
    row = cur.fetchone()
    is_online = bool(row[0]) if row else False
    conn.close()

    from datetime import datetime
    now = datetime.now()
    today_appts = []
    for a in appts:
        start = a.get("StartTime")
        if start and hasattr(start, "year"):
            if start.date() == now.date():
                today_appts.append(a)
    completed_today = len([a for a in today_appts if a.get("Status") == "Completed"])
    remaining_today = len([a for a in today_appts if a.get("Status") != "Completed"])

    return render_template(
        "vet_home.html",
        appts=today_appts,
        is_online=is_online,
        patients_count=patients_count,
        completed_today=completed_today,
        remaining_today=remaining_today,
    )


@vet_bp.route("/vet/requests", methods=["GET", "POST"])
@role_required("vet")
def vet_requests():
    vet_id = session["user_id"]
    conn = get_connection()
    cur = conn.cursor()

    if request.method == "POST":
        req_id = request.form.get("request_id")
        action = request.form.get("action")
        if action == "accept":
            cur.execute(
                "SELECT OwnerId, PetId FROM dbo.ChatRequests WHERE Id=? AND VetUserId=? AND Status='Pending'",
                (req_id, vet_id),
            )
            row = cur.fetchone()
            if row:
                owner_id = row[0]
                pet_id = row[1]
                cur.execute(
                    "INSERT INTO dbo.Chats (OwnerId, VetUserId, PetId) VALUES (?, ?, ?)",
                    (owner_id, vet_id, pet_id),
                )
                cur.execute("UPDATE dbo.ChatRequests SET Status='Accepted' WHERE Id=?", (req_id,))
                conn.commit()
                flash("Chat request accepted.", "success")
        elif action == "decline":
            cur.execute(
                "UPDATE dbo.ChatRequests SET Status='Declined' WHERE Id=? AND VetUserId=?",
                (req_id, vet_id),
            )
            conn.commit()
            flash("Chat request declined.", "success")

    return redirect(url_for("vet.vet_requests"))

    cur.execute(
        """
        SELECT r.Id, r.Message, r.Status, r.CreatedAt,
               u.FullName AS OwnerName
        FROM dbo.ChatRequests r
        JOIN dbo.Users u ON u.Id = r.OwnerId
        WHERE r.VetUserId = ? AND r.Status = 'Pending'
        ORDER BY r.CreatedAt DESC
        """,
        (vet_id,),
    )
    requests = fetchall_dict(cur)
    conn.close()
    return render_template("vet_requests.html", requests=requests)


@vet_bp.route("/vet/appointments", methods=["GET", "POST"])
@role_required("vet")
def vet_appointments():
    vet_id = session["user_id"]
    conn = get_connection()
    cur = conn.cursor()

    if request.method == "POST":
        appt_id = request.form.get("appt_id")
        action = request.form.get("action")
        if appt_id and action in ("accept", "reject", "start", "complete"):
            if action == "accept":
                status = "Scheduled"
            elif action == "reject":
                status = "Declined"
            elif action == "complete":
                status = "Completed"
            else:
                status = "In Progress"
            cur.execute(
                "UPDATE dbo.Appointments SET Status=? WHERE Id=? AND VetUserId=?",
                (status, appt_id, vet_id),
            )
            conn.commit()
            flash("Appointment updated.", "success")
        return redirect(url_for("vet.vet_appointments"))

    cur.execute("""
        SELECT a.Id, a.Type, a.Status, a.StartTime, a.EndTime,
               p.Name AS PetName,
               u.FullName AS OwnerName, u.Id AS OwnerId
        FROM dbo.Appointments a
        JOIN dbo.Pets p ON p.Id = a.PetId
        JOIN dbo.Users u ON u.Id = a.OwnerId
        WHERE a.VetUserId = ?
        ORDER BY a.StartTime DESC
    """, (vet_id,))
    appts = fetchall_dict(cur)
    conn.close()
    from datetime import datetime
    return render_template("vet_appointments.html", appts=appts, now=datetime.now)


@vet_bp.get("/vet/patients")
@role_required("vet")
def vet_patients():
    vet_id = session["user_id"]
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
        (vet_id, vet_id, vet_id),
    )
    patients = fetchall_dict(cur)
    conn.close()
    return render_template("vet_patients.html", patients=patients)


@vet_bp.route("/vet/chat", methods=["GET", "POST"])
@role_required("vet")
def vet_chat():
    vet_id = session["user_id"]
    conn = get_connection()
    cur = conn.cursor()

    cur.execute(
        """
        SELECT c.Id, c.OwnerId, c.VetUserId, c.PetId, c.CreatedAt,
               u.FullName AS OwnerName, p.Name AS PetName
        FROM dbo.Chats c
        JOIN dbo.Users u ON u.Id = c.OwnerId
        LEFT JOIN dbo.Pets p ON p.Id = c.PetId
        WHERE c.VetUserId = ?
        ORDER BY c.CreatedAt DESC
        """,
        (vet_id,),
    )
    chats = fetchall_dict(cur)

    chat_id = request.args.get("chat_id")

    if request.method == "POST":
        action = request.form.get("action") or "send"
        if action == "attach":
            flash("Attachment upload coming soon.", "success")
            return redirect(url_for("vet.vet_chat", chat_id=chat_id))
        msg = (request.form.get("message") or "").strip()
        if msg and chat_id:
            cur.execute(
                """
                INSERT INTO dbo.Messages (ChatId, SenderRole, SenderId, Body)
                VALUES (?, 'vet', ?, ?)
                """,
                (chat_id, vet_id, msg),
            )
            conn.commit()
        return redirect(url_for("vet.vet_chat", chat_id=chat_id))

    messages = []
    if chat_id:
        cur.execute(
            """
            SELECT Id, SenderRole, Body, CreatedAt
            FROM dbo.Messages
            WHERE ChatId = ?
            ORDER BY CreatedAt ASC
            """,
            (chat_id,),
        )
        messages = fetchall_dict(cur)

    conn.close()
    return render_template("vet_chat.html", chats=chats, active_chat_id=chat_id, messages=messages)


@vet_bp.route("/vet/profile", methods=["GET", "POST"])
@role_required("vet")
def vet_profile():
    vet_id = session["user_id"]
    conn = get_connection()
    cur = conn.cursor()

    if request.method == "POST":
        full_name = (request.form.get("full_name") or "").strip()
        phone = (request.form.get("phone") or "").strip() or None
        clinic = (request.form.get("clinic_name") or "").strip() or None
        license_no = (request.form.get("license_no") or "").strip() or None
        clinic_phone = (request.form.get("clinic_phone") or "").strip() or None
        bio = (request.form.get("bio") or "").strip() or None
        is_online = 1 if request.form.get("is_online") == "on" else 0
        if full_name:
            cur.execute("UPDATE dbo.Users SET FullName=?, Phone=? WHERE Id=?", (full_name, phone, vet_id))
        cur.execute(
            """
            IF EXISTS (SELECT 1 FROM dbo.VetProfiles WHERE UserId = ?)
                UPDATE dbo.VetProfiles
                SET ClinicName=?, LicenseNo=?, ClinicPhone=?, Bio=?, IsOnline=?
                WHERE UserId = ?
            ELSE
                INSERT INTO dbo.VetProfiles (UserId, ClinicName, LicenseNo, ClinicPhone, Bio, IsOnline)
                VALUES (?, ?, ?, ?, ?, ?)
            """,
            (vet_id, clinic, license_no, clinic_phone, bio, is_online, vet_id, vet_id, clinic, license_no, clinic_phone, bio, is_online),
        )
        conn.commit()
        flash("Profile updated.", "success")
        return redirect(url_for("vet.vet_profile"))

    cur.execute(
        """
        SELECT u.FullName, u.Email, u.Phone,
               v.ClinicName, v.LicenseNo, v.ClinicPhone, v.Bio, v.IsOnline
        FROM dbo.Users u
        LEFT JOIN dbo.VetProfiles v ON v.UserId = u.Id
        WHERE u.Id = ?
        """,
        (vet_id,),
    )
    profile = fetchone_dict(cur) or {}
    conn.close()
    return render_template("vet_profile.html", profile=profile)
