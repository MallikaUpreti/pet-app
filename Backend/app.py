import os
from flask import Flask, redirect, url_for
from dotenv import load_dotenv
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent
load_dotenv(BASE_DIR / ".env")  # ensure Backend/.env loads

from auth import auth_bp
from users import users_bp
from vets import vets_bp

app = Flask(__name__)
app.secret_key = os.getenv("FLASK_SECRET", "change-this-in-production")

app.register_blueprint(auth_bp)
app.register_blueprint(users_bp)
app.register_blueprint(vets_bp)

@app.get("/")
def index():
    return redirect(url_for("users.home"))

if __name__ == "__main__":
    app.run(debug=True)