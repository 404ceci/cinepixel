from datetime import datetime, timezone

from .extensions import db


def _now() -> datetime:
    return datetime.now(timezone.utc)


class User(db.Model):
    __tablename__ = "users"

    id = db.Column(db.Integer, primary_key=True)
    email = db.Column(db.String(254), nullable=False, unique=True, index=True)
    # Only the salted hash is stored (werkzeug's scrypt), never the password itself.
    password_hash = db.Column(db.String(255), nullable=False)
    created_at = db.Column(db.DateTime(timezone=True), nullable=False, default=_now)

    ratings = db.relationship("Rating", back_populates="user", cascade="all, delete-orphan")

    def to_dict(self) -> dict:
        return {"id": self.id, "email": self.email}


class Rating(db.Model):
    """A 1–5 score a user gave to a TMDB movie.

    Title, poster and release date are stored next to the score on purpose
    (denormalization): the "My ratings" page is built from the database alone,
    without one TMDB request per movie.
    """

    __tablename__ = "ratings"
    __table_args__ = (
        db.UniqueConstraint("user_id", "movie_id", name="uq_ratings_user_movie"),
        db.CheckConstraint("score BETWEEN 1 AND 5", name="ck_ratings_score_range"),
    )

    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(
        db.Integer, db.ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    movie_id = db.Column(db.Integer, nullable=False, index=True)
    score = db.Column(db.SmallInteger, nullable=False)
    title = db.Column(db.String(255), nullable=False)
    poster_path = db.Column(db.String(255), nullable=True)
    release_date = db.Column(db.String(10), nullable=True)
    created_at = db.Column(db.DateTime(timezone=True), nullable=False, default=_now)
    updated_at = db.Column(
        db.DateTime(timezone=True), nullable=False, default=_now, onupdate=_now
    )

    user = db.relationship("User", back_populates="ratings")

    def to_dict(self) -> dict:
        return {
            "movie_id": self.movie_id,
            "score": self.score,
            "title": self.title,
            "poster_path": self.poster_path,
            "release_date": self.release_date,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "updated_at": self.updated_at.isoformat() if self.updated_at else None,
        }
