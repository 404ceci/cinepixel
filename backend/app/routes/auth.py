import re

from flask import Blueprint, g, jsonify, request
from sqlalchemy.exc import IntegrityError
from werkzeug.security import check_password_hash, generate_password_hash

from ..auth import create_token, login_required
from ..errors import ApiError
from ..extensions import db
from ..models import User

bp = Blueprint("auth", __name__, url_prefix="/api/auth")

EMAIL_RE = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")
MIN_PASSWORD = 8


def _credentials() -> tuple[str, str]:
    body = request.get_json(silent=True) or {}
    email = str(body.get("email") or "").strip().lower()
    password = str(body.get("password") or "")
    if not EMAIL_RE.match(email) or len(email) > 254:
        raise ApiError("Enter a valid email address.", code="invalid_email")
    return email, password


def _session(user: User, status: int = 200):
    return jsonify({"token": create_token(user), "user": user.to_dict()}), status


@bp.post("/register")
def register():
    email, password = _credentials()
    if len(password) < MIN_PASSWORD:
        raise ApiError(
            f"Use at least {MIN_PASSWORD} characters for your password.", code="weak_password"
        )

    user = User(email=email, password_hash=generate_password_hash(password))
    db.session.add(user)
    try:
        db.session.commit()
    except IntegrityError:
        # The unique constraint is the source of truth, even under concurrent sign-ups.
        db.session.rollback()
        raise ApiError("An account with this email already exists.", 409, "email_taken")
    return _session(user, 201)


@bp.post("/login")
def login():
    email, password = _credentials()
    user = User.query.filter_by(email=email).first()
    # Same message for unknown email and wrong password: doesn't reveal which emails exist.
    if user is None or not check_password_hash(user.password_hash, password):
        raise ApiError("Incorrect email or password.", 401, "invalid_credentials")
    return _session(user)


@bp.get("/me")
@login_required
def me():
    return jsonify(g.user.to_dict())
