"""JWT authentication helpers.

Flow: the client signs in once, receives a signed token and sends it back on
every request as `Authorization: Bearer <token>`. The server keeps no session
state; it only verifies the signature and the expiry.
"""

from __future__ import annotations

from datetime import datetime, timedelta, timezone
from functools import wraps

import jwt
from flask import current_app, g, request

from .errors import ApiError
from .extensions import db
from .models import User

ALGORITHM = "HS256"


def create_token(user: User) -> str:
    now = datetime.now(timezone.utc)
    payload = {
        "sub": str(user.id),
        "iat": now,
        "exp": now + timedelta(hours=current_app.config["JWT_EXPIRES_HOURS"]),
    }
    return jwt.encode(payload, current_app.config["SECRET_KEY"], algorithm=ALGORITHM)


def _user_from_header() -> User | None:
    """Returns the user for a valid token, None when no token was sent.

    An invalid or expired token is an error (401) rather than "anonymous",
    so the client knows it has to sign in again.
    """
    header = request.headers.get("Authorization", "")
    if not header.startswith("Bearer "):
        return None
    token = header.removeprefix("Bearer ").strip()
    try:
        payload = jwt.decode(token, current_app.config["SECRET_KEY"], algorithms=[ALGORITHM])
    except jwt.ExpiredSignatureError:
        raise ApiError("Your session has expired. Please sign in again.", 401, "token_expired")
    except jwt.InvalidTokenError:
        raise ApiError("Invalid session. Please sign in again.", 401, "invalid_token")

    user = db.session.get(User, int(payload["sub"]))
    if user is None:
        raise ApiError("This account no longer exists.", 401, "invalid_token")
    return user


def current_user_optional() -> User | None:
    """For public routes that show extra data to signed-in users."""
    if "user" not in g:
        g.user = _user_from_header()
    return g.user


def login_required(view):
    @wraps(view)
    def wrapper(*args, **kwargs):
        if current_user_optional() is None:
            raise ApiError("Sign in to continue.", 401, "auth_required")
        return view(*args, **kwargs)

    return wrapper
