from flask import Blueprint, jsonify
from db import get_connection, fetchall_dict

vets_bp = Blueprint("vets", __name__)

@vets_bp.get("/vets/emergency")
def emergency_vets():
    conn = get_connection()
    cur = conn.cursor()
    cur.execute(
        """
        SELECT
          u.Id, u.FullName, u.Email, u.Phone,
          vp.VetLicenseId, vp.Specialization, vp.IsOnline, vp.EmergencyEnabled, vp.LicenseVerified
        FROM dbo.Users u
        JOIN dbo.VetProfiles vp ON vp.UserId = u.Id
        WHERE u.Role='vet'
          AND vp.IsOnline=1
          AND vp.EmergencyEnabled=1
          AND vp.LicenseVerified=1
        ORDER BY u.FullName
        """
    )
    vets = fetchall_dict(cur)
    conn.close()
    return jsonify({"vets": vets})