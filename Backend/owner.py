from flask import Blueprint, render_template, session
from auth_utils import role_required
from db import get_connection, fetchall_dict

owner_bp = Blueprint("owner", __name__)

@owner_bp.get("/owner")
@role_required("owner")
def owner_home():
    owner_id = session["user_id"]

    conn = get_connection()
    cur = conn.cursor()
    cur.execute("""
        SELECT Id, Name, Species, Breed, AgeMonths, WeightKg, Allergies, Diseases, PhotoUrl, CreatedAt
        FROM dbo.Pets
        WHERE OwnerId = ?
        ORDER BY CreatedAt DESC
    """, (owner_id,))
    pets = fetchall_dict(cur)
    conn.close()

    return render_template("owner_home.html", pets=pets)