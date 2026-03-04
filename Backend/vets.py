from flask import Blueprint, render_template, session
from auth_utils import role_required
from db import get_connection, fetchall_dict

vet_bp = Blueprint("vet", __name__)

@vet_bp.get("/vet")
@role_required("vet")
def vet_home():
    vet_id = session["user_id"]

    conn = get_connection()
    cur = conn.cursor()
    cur.execute("""
        SELECT a.Id, a.Type, a.Status, a.StartTime, a.EndTime,
               p.Name AS PetName,
               u.FullName AS OwnerName
        FROM dbo.Appointments a
        JOIN dbo.Pets p ON p.Id = a.PetId
        JOIN dbo.Users u ON u.Id = a.OwnerId
        WHERE a.VetUserId = ?
        ORDER BY a.StartTime DESC
    """, (vet_id,))
    appts = fetchall_dict(cur)
    conn.close()

    return render_template("vet_home.html", appts=appts)