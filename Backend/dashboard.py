from flask import Blueprint, session, redirect, url_for
from auth_utils import login_required

dashboard_bp = Blueprint("dashboard", __name__)

@dashboard_bp.get("/dashboard")
@login_required
def dashboard():
    role = session.get("role")
    if role == "owner":
        return redirect(url_for("owner.owner_home"))
    if role == "vet":
        return redirect(url_for("vet.vet_home"))
    return redirect(url_for("auth.login"))