from datetime import datetime
import sqlite3
from pathlib import Path

from flask import Flask, render_template, request, redirect, url_for, flash


# -------------------------------
# Database Configuration
# -------------------------------

BASE_DIR = Path(__file__).resolve().parent
DB_PATH = BASE_DIR / "pet_app.db"


def get_connection():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn


def init_db():
    conn = get_connection()
    cur = conn.cursor()
    cur.execute(
        """
        CREATE TABLE IF NOT EXISTS user (
            user_id INTEGER PRIMARY KEY AUTOINCREMENT,
            full_name TEXT NOT NULL,
            email TEXT NOT NULL UNIQUE,
            phone TEXT,
            address TEXT,
            created_at TEXT NOT NULL
        )
        """
    )
    conn.commit()
    conn.close()


def seed_initial_users():
    conn = get_connection()
    cur = conn.cursor()
    cur.execute("SELECT COUNT(*) FROM user")
    count = cur.fetchone()[0]

    if count == 0:
        now = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        users = [
            ("Mallika Upreti", "mallika@gmail.com", "9841234567", "Kathmandu, Nepal", now),
            ("Sita Sharma", "sita@gmail.com", "9800000000", "Lalitpur, Nepal", now),
            ("Ram Thapa", "ram@gmail.com", "9811111111", "Bhaktapur, Nepal", now),
        ]

        cur.executemany(
            """
            INSERT INTO user (full_name, email, phone, address, created_at)
            VALUES (?, ?, ?, ?, ?)
            """,
            users,
        )
        conn.commit()

    conn.close()


# -------------------------------
# Flask App Setup
# -------------------------------

app = Flask(__name__)
app.secret_key = "change-this-in-production"

# Initialize database when app starts (modern way)
with app.app_context():
    init_db()
    seed_initial_users()


# -------------------------------
# Routes
# -------------------------------

@app.route("/")
def index():
    return redirect(url_for("list_users"))


@app.route("/users", methods=["GET", "POST"])
def list_users():
    conn = get_connection()
    cur = conn.cursor()

    if request.method == "POST":
        full_name = request.form.get("full_name", "").strip()
        email = request.form.get("email", "").strip()
        phone = request.form.get("phone", "").strip()
        address = request.form.get("address", "").strip()

        if not full_name or not email:
            flash("Full Name and Email are required.", "error")
        else:
            try:
                cur.execute(
                    """
                    INSERT INTO user (full_name, email, phone, address, created_at)
                    VALUES (?, ?, ?, ?, ?)
                    """,
                    (
                        full_name,
                        email,
                        phone,
                        address,
                        datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
                    ),
                )
                conn.commit()
                flash("User added successfully.", "success")
            except sqlite3.IntegrityError:
                flash("Email must be unique. This email is already used.", "error")

    cur.execute(
        """
        SELECT user_id, full_name, email, phone, address, created_at
        FROM user
        ORDER BY user_id
        """
    )

    users = cur.fetchall()
    conn.close()

    return render_template("users.html", users=users)


@app.route("/users/<int:user_id>/edit", methods=["GET", "POST"])
def edit_user(user_id):
    conn = get_connection()
    cur = conn.cursor()

    if request.method == "POST":
        full_name = request.form.get("full_name", "").strip()
        email = request.form.get("email", "").strip()
        phone = request.form.get("phone", "").strip()
        address = request.form.get("address", "").strip()

        if not full_name or not email:
            flash("Full Name and Email are required.", "error")
        else:
            try:
                cur.execute(
                    """
                    UPDATE user
                    SET full_name = ?, email = ?, phone = ?, address = ?
                    WHERE user_id = ?
                    """,
                    (full_name, email, phone, address, user_id),
                )
                conn.commit()
                flash("User updated successfully.", "success")
                conn.close()
                return redirect(url_for("list_users"))
            except sqlite3.IntegrityError:
                flash("Email must be unique. This email is already used.", "error")

    cur.execute(
        """
        SELECT user_id, full_name, email, phone, address, created_at
        FROM user
        WHERE user_id = ?
        """,
        (user_id,),
    )

    user = cur.fetchone()
    conn.close()

    if user is None:
        flash("User not found.", "error")
        return redirect(url_for("list_users"))

    return render_template("edit_user.html", user=user)


@app.route("/users/<int:user_id>/delete", methods=["POST"])
def delete_user(user_id):
    conn = get_connection()
    cur = conn.cursor()

    cur.execute("DELETE FROM user WHERE user_id = ?", (user_id,))
    conn.commit()
    conn.close()

    flash("User deleted successfully.", "success")
    return redirect(url_for("list_users"))


# -------------------------------
# Run App
# -------------------------------

if __name__ == "__main__":
    app.run(debug=True)