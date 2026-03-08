from flask import Blueprint, render_template, session, request, redirect, url_for, flash
from auth_utils import role_required
from db import get_connection, fetchall_dict, fetchone_dict

vet_bp = Blueprint("vet", __name__)


def create_owner_notification(cur, owner_id, appointment_id, ntype, message):
    cur.execute(
        """
        INSERT INTO dbo.OwnerNotifications (OwnerId, AppointmentId, Type, Message)
        VALUES (?, ?, ?, ?)
        """,
        (owner_id, appointment_id, ntype, message),
    )

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
               u.FullName AS OwnerName, u.Id AS OwnerId,
               CASE WHEN r.AppointmentId IS NULL THEN 0 ELSE 1 END AS HasReport
        FROM dbo.Appointments a
        JOIN dbo.Pets p ON p.Id = a.PetId
        JOIN dbo.Users u ON u.Id = a.OwnerId
        LEFT JOIN dbo.AppointmentReports r ON r.AppointmentId = a.Id
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

    cur.execute(
        """
        SELECT COUNT(*)
        FROM dbo.VetNotifications
        WHERE VetUserId = ? AND IsRead = 0
        """,
        (vet_id,),
    )
    notif_count = cur.fetchone()[0] or 0

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
        notif_count=notif_count,
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


@vet_bp.get("/vet/notifications")
@role_required("vet")
def vet_notifications():
    vet_id = session["user_id"]
    conn = get_connection()
    cur = conn.cursor()
    cur.execute(
        """
        SELECT n.Id, n.Type, n.Message, n.IsRead, n.CreatedAt,
               n.OwnerId, o.FullName AS OwnerName,
               n.PetId, p.Name AS PetName,
               n.AppointmentId, a.Type AS AppointmentType, a.Status AS AppointmentStatus, a.StartTime
        FROM dbo.VetNotifications n
        LEFT JOIN dbo.Users o ON o.Id = n.OwnerId
        LEFT JOIN dbo.Pets p ON p.Id = n.PetId
        LEFT JOIN dbo.Appointments a ON a.Id = n.AppointmentId
        WHERE n.VetUserId = ?
        ORDER BY n.CreatedAt DESC
        """,
        (vet_id,),
    )
    notifications = fetchall_dict(cur)
    cur.execute(
        "UPDATE dbo.VetNotifications SET IsRead = 1 WHERE VetUserId = ? AND IsRead = 0",
        (vet_id,),
    )
    conn.commit()
    conn.close()
    return render_template("vet_notifications.html", notifications=notifications)


@vet_bp.route("/vet/appointments", methods=["GET", "POST"])
@role_required("vet")
def vet_appointments():
    vet_id = session["user_id"]
    session["notif_cleared"] = True
    conn = get_connection()
    cur = conn.cursor()

    if request.method == "POST":
        appt_id = request.form.get("appt_id")
        action = request.form.get("action")
        if appt_id and action in ("accept", "reject", "start", "complete"):
            cur.execute(
                """
                SELECT a.OwnerId, p.Name, a.Type
                FROM dbo.Appointments a
                JOIN dbo.Pets p ON p.Id = a.PetId
                WHERE a.Id = ? AND a.VetUserId = ?
                """,
                (appt_id, vet_id),
            )
            info = cur.fetchone()
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
            if info:
                owner_id, pet_name, appt_type = info
                if status == "Scheduled":
                    msg = f"Appointment approved for {pet_name} ({appt_type})."
                elif status == "Declined":
                    msg = f"Appointment declined for {pet_name} ({appt_type})."
                elif status == "In Progress":
                    msg = f"Appointment started for {pet_name} ({appt_type})."
                else:
                    msg = f"Appointment completed for {pet_name} ({appt_type})."
                create_owner_notification(cur, owner_id, int(appt_id), "appointment_update", msg)
            conn.commit()
            flash("Appointment updated.", "success")
        return redirect(url_for("vet.vet_appointments"))

    q = (request.args.get("q") or "").strip().lower()
    status_filter = (request.args.get("status") or "").strip()

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
    if q:
        appts = [a for a in appts if q in (a.get("PetName") or "").lower() or q in (a.get("OwnerName") or "").lower()]
    if status_filter:
        appts = [a for a in appts if a.get("Status") == status_filter]
    from datetime import datetime
    return render_template("vet_appointments.html", appts=appts, now=datetime.now, q=q, status_filter=status_filter)


@vet_bp.route("/vet/appointments/<int:appt_id>/report", methods=["GET", "POST"])
@role_required("vet")
def vet_appointment_report(appt_id):
    vet_id = session["user_id"]
    conn = get_connection()
    cur = conn.cursor()
    cur.execute(
        """
        SELECT a.Id, a.Type, a.Status, a.StartTime, a.EndTime, a.Notes, a.VetUserId,
               p.Name AS PetName,
               o.Id AS OwnerId, o.FullName AS OwnerName,
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
    if not appt or str(appt["VetUserId"]) != str(vet_id):
        conn.close()
        flash("Appointment not found.", "error")
        return redirect(url_for("vet.vet_appointments"))

    if appt.get("Status") != "Completed":
        conn.close()
        flash("Report can be edited only after appointment is completed.", "error")
        return redirect(url_for("vet.vet_appointments"))

    if request.method == "POST":
        diagnosis = (request.form.get("diagnosis") or "").strip()
        meds = (request.form.get("medications_and_doses") or "").strip() or None
        diet = (request.form.get("diet_recommendation") or "").strip() or None
        general = (request.form.get("general_recommendation") or "").strip() or None
        if not diagnosis:
            flash("Diagnosis is required.", "error")
        else:
            cur.execute("SELECT 1 FROM dbo.AppointmentReports WHERE AppointmentId = ?", (appt_id,))
            existed = cur.fetchone() is not None
            cur.execute(
                """
                IF EXISTS (SELECT 1 FROM dbo.AppointmentReports WHERE AppointmentId = ?)
                BEGIN
                    UPDATE dbo.AppointmentReports
                    SET Diagnosis=?,
                        MedicationsAndDoses=?,
                        DietRecommendation=?,
                        GeneralRecommendation=?,
                        UpdatedAt=GETUTCDATE()
                    WHERE AppointmentId=?
                END
                ELSE
                BEGIN
                    INSERT INTO dbo.AppointmentReports
                        (AppointmentId, VetUserId, Diagnosis, MedicationsAndDoses, DietRecommendation, GeneralRecommendation)
                    VALUES (?, ?, ?, ?, ?, ?)
                END
                """,
                (appt_id, diagnosis, meds, diet, general, appt_id, appt_id, vet_id, diagnosis, meds, diet, general),
            )
            create_owner_notification(
                cur,
                appt["OwnerId"],
                appt_id,
                "report_added" if not existed else "report_updated",
                f"Medical report {'added' if not existed else 'updated'} for {appt['PetName']} ({appt['Type']}).",
            )
            conn.commit()
            flash("Report saved.", "success")
            conn.close()
            return redirect(url_for("vet.vet_appointments"))

    cur.execute(
        """
        SELECT AppointmentId, Diagnosis, MedicationsAndDoses, DietRecommendation, GeneralRecommendation
        FROM dbo.AppointmentReports
        WHERE AppointmentId = ?
        """,
        (appt_id,),
    )
    report = fetchone_dict(cur)
    conn.close()
    return render_template("vet_report_form.html", appt=appt, report=report)


@vet_bp.get("/vet/patients")
@role_required("vet")
def vet_patients():
    vet_id = session["user_id"]
    conn = get_connection()
    cur = conn.cursor()
    q = (request.args.get("q") or "").strip().lower()
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
    if q:
        patients = [p for p in patients if q in (p.get("PetName") or "").lower() or q in (p.get("OwnerName") or "").lower()]
    return render_template("vet_patients.html", patients=patients, q=q)


@vet_bp.get("/vet/patients/<int:pet_id>")
@role_required("vet")
def vet_patient_record(pet_id):
    vet_id = session["user_id"]
    conn = get_connection()
    cur = conn.cursor()
    cur.execute(
        """
        SELECT
            x.Id,
            x.Title,
            x.Notes,
            x.VisitDate,
            x.CreatedAt
        FROM (
            SELECT
                r.Id,
                r.Title,
                r.Notes,
                r.VisitDate,
                r.CreatedAt
            FROM dbo.Records r
            JOIN dbo.Pets p ON p.Id = r.PetId
            JOIN dbo.Appointments a ON a.PetId = p.Id
            WHERE r.PetId = ? AND a.VetUserId = ?

            UNION ALL

            SELECT
                (1000000000 + ar.Id) AS Id,
                CONCAT('Appointment Report - ', a.Type) AS Title,
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
            WHERE a.PetId = ? AND a.VetUserId = ?
        ) x
        ORDER BY x.CreatedAt DESC
        """,
        (pet_id, vet_id, pet_id, vet_id),
    )
    records = fetchall_dict(cur)
    conn.close()
    return render_template("vet_patient_record.html", records=records)


@vet_bp.route("/vet/chat", methods=["GET", "POST"])
@role_required("vet")
def vet_chat():
    vet_id = session["user_id"]
    session["notif_cleared"] = True
    conn = get_connection()
    cur = conn.cursor()

    cur.execute(
        """
        SELECT c.Id, c.OwnerId, c.VetUserId, c.PetId, c.CreatedAt,
               u.FullName AS OwnerName, p.Name AS PetName,
               m.Body AS LastBody, m.CreatedAt AS LastAt, m.SenderRole AS LastSenderRole
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
        (vet_id,),
    )
    chats = fetchall_dict(cur)

    chat_id = request.args.get("chat_id")

    if request.method == "POST":
        action = request.form.get("action") or "send"
        if action == "attach":
            msg = (request.form.get("message") or "").strip()
            if not msg:
                flash("Paste a link to attach.", "error")
                return redirect(url_for("vet.vet_chat", chat_id=chat_id))
            if chat_id:
                cur.execute(
                    """
                    INSERT INTO dbo.Messages (ChatId, SenderRole, SenderId, Body)
                    VALUES (?, 'vet', ?, ?)
                    """,
                    (chat_id, vet_id, f"Attachment: {msg}"),
                )
                conn.commit()
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


@vet_bp.get("/vet/analytics")
@role_required("vet")
def vet_analytics():
    vet_id = session["user_id"]
    conn = get_connection()
    cur = conn.cursor()
    cur.execute(
        """
        SELECT
            SUM(CASE WHEN Status='Completed' THEN 1 ELSE 0 END) AS Completed,
            SUM(CASE WHEN Status='Scheduled' THEN 1 ELSE 0 END) AS Scheduled,
            SUM(CASE WHEN Status='Pending' THEN 1 ELSE 0 END) AS Pending,
            SUM(CASE WHEN Status='In Progress' THEN 1 ELSE 0 END) AS InProgress,
            COUNT(*) AS Total
        FROM dbo.Appointments
        WHERE VetUserId = ?
        """,
        (vet_id,),
    )
    row = cur.fetchone()
    stats = {
        "completed": row[0] or 0,
        "scheduled": row[1] or 0,
        "pending": row[2] or 0,
        "in_progress": row[3] or 0,
        "total": row[4] or 0,
    }
    conn.close()
    return render_template("vet_analytics.html", stats=stats)
