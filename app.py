import os
import re
import sqlite3
from datetime import timedelta
from pathlib import Path

from flask import (
    Flask,
    g,
    jsonify,
    redirect,
    render_template,
    request,
    session,
    url_for,
)
from werkzeug.security import check_password_hash, generate_password_hash

BASE_DIR = Path(__file__).resolve().parent
DATABASE = BASE_DIR / "users.db"

app = Flask(__name__)
app.config["SECRET_KEY"] = os.environ.get("SECRET_KEY", "dev-only-change-me")
app.config["SESSION_COOKIE_HTTPONLY"] = True
app.config["SESSION_COOKIE_SAMESITE"] = "Lax"
app.config["PERMANENT_SESSION_LIFETIME"] = timedelta(days=30)

EMAIL_RE = re.compile(r"^[^\s@]+@[^\s@]+\.[^\s@]+$")


def get_db():
    if "db" not in g:
        g.db = sqlite3.connect(DATABASE)
        g.db.row_factory = sqlite3.Row
    return g.db


@app.teardown_appcontext
def close_db(error=None):
    db = g.pop("db", None)
    if db is not None:
        db.close()


def init_db():
    with sqlite3.connect(DATABASE) as db:
        db.execute(
            """
            CREATE TABLE IF NOT EXISTS users (
                id            INTEGER PRIMARY KEY AUTOINCREMENT,
                name          TEXT NOT NULL,
                email         TEXT NOT NULL UNIQUE COLLATE NOCASE,
                password_hash TEXT NOT NULL,
                created_at    TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
            )
            """
        )


init_db()


def current_user():
    user_id = session.get("user_id")
    if user_id is None:
        return None
    return get_db().execute(
        "SELECT id, name, email FROM users WHERE id = ?", (user_id,)
    ).fetchone()


@app.get("/")
def index():
    if current_user():
        return redirect(url_for("dashboard"))
    return render_template("index.html")


@app.get("/dashboard")
def dashboard():
    user = current_user()
    if user is None:
        return redirect(url_for("index"))
    return render_template("dashboard.html", user=user)


@app.post("/logout")
def logout():
    session.clear()
    return redirect(url_for("index"))


@app.post("/signup")
def signup():
    data = request.get_json(silent=True) or {}

    name = str(data.get("name", "")).strip()
    email = str(data.get("email", "")).strip().lower()
    password = str(data.get("password", ""))

    errors = {}

    if len(name) < 2:
        errors["name"] = "Enter your full name."
    if not EMAIL_RE.match(email):
        errors["email"] = "Enter a valid email address, like you@company.com."
    if len(password) < 8:
        errors["password"] = "Use at least 8 characters."
    elif len(password) > 128:
        errors["password"] = "Use 128 characters or fewer."

    if errors:
        return jsonify(errors=errors), 400

    db = get_db()

    try:
        db.execute(
            "INSERT INTO users (name, email, password_hash) VALUES (?, ?, ?)",
            (name, email, generate_password_hash(password)),
        )
        db.commit()
    except sqlite3.IntegrityError:
        return jsonify(
            errors={"email": "An account with this email already exists. Sign in instead."}
        ), 409

    return jsonify(message="Account created. Sign in to continue to your workspace."), 201


@app.post("/signin")
def signin():
    data = request.get_json(silent=True) or {}

    email = str(data.get("email", "")).strip().lower()
    password = str(data.get("password", ""))

    user = get_db().execute(
        "SELECT id, password_hash FROM users WHERE email = ?", (email,)
    ).fetchone()

    if user is None or not check_password_hash(user["password_hash"], password):
        return jsonify(errors={"password": "Incorrect email or password."}), 401

    session.clear()
    session["user_id"] = user["id"]
    session.permanent = bool(data.get("remember"))

    return jsonify(redirect=url_for("dashboard"))


if __name__ == "__main__":
    app.run(debug=True)