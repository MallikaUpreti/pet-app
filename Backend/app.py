import os
from flask import Flask, redirect, url_for
from dotenv import load_dotenv
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent
load_dotenv(BASE_DIR / ".env")  # ensure Backend/.env loads

from auth import auth_bp
from users import users_bp
from owner import owner_bp
from vets import vet_bp
from dashboard import dashboard_bp
from api import api_bp


app = Flask(__name__)
app.secret_key = os.getenv("FLASK_SECRET", "change-this-in-production")

app.register_blueprint(auth_bp)
app.register_blueprint(users_bp)
app.register_blueprint(owner_bp)
app.register_blueprint(vet_bp)
app.register_blueprint(dashboard_bp)
app.register_blueprint(api_bp)

@app.get("/")
def index():
    return redirect(url_for("auth.login"))

if __name__ == "__main__":
    app.run(debug=True)
