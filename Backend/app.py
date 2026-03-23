import os
from flask import Flask, redirect, send_from_directory, session, url_for
from flask_cors import CORS
from dotenv import load_dotenv
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent
WEB_DIST_DIR = BASE_DIR.parent / "web" / "dist"
load_dotenv(BASE_DIR / ".env")  # ensure Backend/.env loads

from auth import auth_bp
from users import users_bp
from owner import owner_bp
from vets import vet_bp
from dashboard import dashboard_bp
from api import api_bp
from db import ensure_schema
from reminders import start_reminder_worker


app = Flask(__name__)
app.secret_key = os.getenv("FLASK_SECRET", "change-this-in-production")
CORS(app, resources={r"/api/*": {"origins": "*"}})

try:
    ensure_schema()
except Exception as exc:
    print(f"Schema setup failed: {exc}")

if os.environ.get("WERKZEUG_RUN_MAIN") == "true" or os.environ.get("FLASK_DEBUG", "").lower() not in {"1", "true"}:
    try:
        start_reminder_worker()
    except Exception as exc:
        print(f"Reminder worker failed to start: {exc}")

app.register_blueprint(auth_bp)
app.register_blueprint(users_bp)
app.register_blueprint(owner_bp)
app.register_blueprint(vet_bp)
app.register_blueprint(dashboard_bp)
app.register_blueprint(api_bp)


def serve_react_app():
    index_file = WEB_DIST_DIR / "index.html"
    assets_dir = WEB_DIST_DIR / "assets"
    has_assets = assets_dir.exists() and any(assets_dir.iterdir())
    if index_file.exists() and has_assets:
        return send_from_directory(WEB_DIST_DIR, "index.html")
    if session.get("user_id"):
        return redirect(url_for("dashboard.dashboard"))
    return redirect(url_for("auth.login"))


@app.get("/assets/<path:filename>")
def react_assets(filename):
    assets_dir = WEB_DIST_DIR / "assets"
    if assets_dir.exists():
        return send_from_directory(assets_dir, filename)
    return ("Not found", 404)


@app.get("/")
def index():
    return serve_react_app()


@app.get("/auth/<path:path>")
@app.get("/owner/<path:path>")
@app.get("/vet/<path:path>")
@app.get("/quiz")
def react_spa(path=None):
    return serve_react_app()

if __name__ == "__main__":
    app.run(debug=True)
