import os
import secrets
import smtplib
import threading
import time
from datetime import datetime, timedelta
from email.message import EmailMessage

from db import get_connection


_worker_started = False
_worker_lock = threading.Lock()


def _app_base_url():
    return (os.getenv("APP_BASE_URL") or "http://127.0.0.1:5000").rstrip("/")


def _email_enabled():
    return bool(os.getenv("SMTP_HOST") and os.getenv("EMAIL_FROM"))


def send_email(to_email, subject, body):
    if not _email_enabled():
        print(f"[email skipped] To: {to_email} | Subject: {subject}\n{body}")
        return False

    host = os.getenv("SMTP_HOST")
    port = int(os.getenv("SMTP_PORT", "587"))
    username = os.getenv("SMTP_USERNAME") or None
    password = os.getenv("SMTP_PASSWORD") or None
    email_from = os.getenv("EMAIL_FROM")
    use_tls = str(os.getenv("SMTP_USE_TLS", "true")).lower() != "false"

    message = EmailMessage()
    message["Subject"] = subject
    message["From"] = email_from
    message["To"] = to_email
    message.set_content(body)

    with smtplib.SMTP(host, port, timeout=20) as smtp:
        if use_tls:
            smtp.starttls()
        if username and password:
            smtp.login(username, password)
        smtp.send_message(message)
    return True


def try_send_email(to_email, subject, body):
    try:
        sent = send_email(to_email, subject, body)
        return {"sent": bool(sent), "error": "" if sent else "Email delivery is not configured on the server."}
    except Exception as exc:
        print(f"[email failed] To: {to_email} | Subject: {subject} | Error: {exc}")
        return {"sent": False, "error": str(exc)}


def issue_email_verification(cur, user_id):
    token = secrets.token_urlsafe(32)
    expires_at = datetime.utcnow() + timedelta(hours=24)
    cur.execute(
        """
        INSERT INTO dbo.EmailVerificationTokens (UserId, Token, ExpiresAt)
        VALUES (?, ?, ?)
        """,
        (user_id, token, expires_at),
    )
    return token, expires_at


def send_verification_email(email, full_name, token):
    verify_url = f"{_app_base_url()}/auth/verify-email?token={token}"
    body = (
        f"Hi {full_name},\n\n"
        "Please verify your PawCare account by opening the link below:\n"
        f"{verify_url}\n\n"
        "This link expires in 24 hours."
    )
    result = try_send_email(email, "Verify your PawCare account", body)
    return {"sent": result["sent"], "verify_url": verify_url, "error": result["error"]}


def _record_dispatch(cur, reminder_key, channel, owner_id=None, pet_id=None, medication_id=None, vaccination_id=None):
    try:
        cur.execute(
            """
            INSERT INTO dbo.ReminderDispatches
              (ReminderKey, Channel, OwnerId, PetId, MedicationId, VaccinationId)
            VALUES (?, ?, ?, ?, ?, ?)
            """,
            (reminder_key, channel, owner_id, pet_id, medication_id, vaccination_id),
        )
        return True
    except Exception:
        return False


def _create_owner_notification(cur, owner_id, notification_type, message, appointment_id=None):
    cur.execute(
        """
        INSERT INTO dbo.OwnerNotifications (OwnerId, AppointmentId, Type, Message)
        VALUES (?, ?, ?, ?)
        """,
        (owner_id, appointment_id, notification_type, message),
    )


def _send_vaccination_tomorrow_reminders(cur):
    tomorrow = (datetime.now() + timedelta(days=1)).date()
    cur.execute(
        """
        SELECT v.Id, v.PetId, v.Name, v.DueDate, p.Name AS PetName, p.OwnerId, u.Email, u.FullName
        FROM dbo.Vaccinations v
        JOIN dbo.Pets p ON p.Id = v.PetId
        JOIN dbo.Users u ON u.Id = p.OwnerId
        WHERE v.Status <> 'Given' AND v.DueDate = ?
        """,
        (tomorrow,),
    )
    for row in cur.fetchall():
        vaccination_id, pet_id, vaccine_name, due_date, pet_name, owner_id, email, owner_name = row
        base_key = f"vaccine:{vaccination_id}:{due_date}"
        message = f"{vaccine_name} for {pet_name} is due tomorrow."
        if _record_dispatch(cur, base_key, "notification", owner_id=owner_id, pet_id=pet_id, vaccination_id=vaccination_id):
            _create_owner_notification(cur, owner_id, "vaccination_due_tomorrow", message)
        if _record_dispatch(cur, base_key, "email", owner_id=owner_id, pet_id=pet_id, vaccination_id=vaccination_id):
            body = (
                f"Hi {owner_name},\n\n"
                f"This is a reminder that {vaccine_name} for {pet_name} is due tomorrow ({due_date}).\n"
                "Please review the vaccination tracker and book an appointment if needed."
            )
            send_email(email, f"Vaccine reminder for {pet_name}", body)


def _parse_time_text(value):
    text = str(value or "").strip()
    if not text:
        return None
    try:
        hour_text, minute_text = text.split(":")
        hour = int(hour_text)
        minute = int(minute_text)
        return hour, minute
    except Exception:
        return None


def _send_medication_reminders(cur):
    now = datetime.now()
    today = now.date()
    cur.execute(
        """
        SELECT m.Id, m.PetId, m.Name, m.Dosage, m.Frequency, m.ReminderTime, m.EndDate,
               p.Name AS PetName, p.OwnerId, u.Email, u.FullName
        FROM dbo.Medications m
        JOIN dbo.Pets p ON p.Id = m.PetId
        JOIN dbo.Users u ON u.Id = p.OwnerId
        WHERE (m.StartDate IS NULL OR m.StartDate <= ?)
          AND (m.EndDate IS NULL OR m.EndDate >= ?)
          AND m.ReminderTime IS NOT NULL
        """,
        (today, today),
    )
    current_minutes = now.hour * 60 + now.minute
    for row in cur.fetchall():
        medication_id, pet_id, med_name, dosage, frequency, reminder_time, end_date, pet_name, owner_id, email, owner_name = row
        parsed = _parse_time_text(reminder_time)
        if not parsed:
            continue
        reminder_minutes = parsed[0] * 60 + parsed[1]
        if not (reminder_minutes <= current_minutes < reminder_minutes + 30):
            continue

        base_key = f"medication:{medication_id}:{today.isoformat()}"
        duration_text = f"until {end_date}" if end_date else "until your vet updates it"
        message = f"{med_name} for {pet_name} is due at {reminder_time}. {dosage or ''} {frequency or ''} {duration_text}".strip()

        if _record_dispatch(cur, base_key, "notification", owner_id=owner_id, pet_id=pet_id, medication_id=medication_id):
            _create_owner_notification(cur, owner_id, "medication_reminder", message)
        if _record_dispatch(cur, base_key, "email", owner_id=owner_id, pet_id=pet_id, medication_id=medication_id):
            body = (
                f"Hi {owner_name},\n\n"
                f"It's time to give {med_name} to {pet_name} at {reminder_time}.\n"
                f"Dosage: {dosage or 'As prescribed'}\n"
                f"Frequency: {frequency or 'As prescribed'}\n"
                f"Duration: {duration_text}\n"
            )
            send_email(email, f"Medication reminder for {pet_name}", body)


def run_reminder_sweep():
    conn = get_connection()
    try:
        cur = conn.cursor()
        _send_vaccination_tomorrow_reminders(cur)
        _send_medication_reminders(cur)
        conn.commit()
    except Exception as exc:
        conn.rollback()
        print(f"[reminders] sweep failed: {exc}")
    finally:
        conn.close()


def _worker_loop():
    while True:
        run_reminder_sweep()
        time.sleep(60)


def start_reminder_worker():
    global _worker_started
    with _worker_lock:
        if _worker_started:
            return
        thread = threading.Thread(target=_worker_loop, daemon=True, name="pawcare-reminders")
        thread.start()
        _worker_started = True
