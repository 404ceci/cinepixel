from flask import Blueprint, current_app, g, jsonify, request

from ..auth import login_required
from ..errors import ApiError
from ..extensions import db
from ..models import Rating

bp = Blueprint("ratings", __name__, url_prefix="/api/ratings")

SORTS = {
    "recent": Rating.updated_at.desc(),
    "score": Rating.score.desc(),
    "title": Rating.title.asc(),
}


def _own_rating(movie_id: int) -> Rating | None:
    # Every query is scoped to the signed-in user: nobody can read or edit someone else's ratings.
    return Rating.query.filter_by(user_id=g.user.id, movie_id=movie_id).first()


def _parse_score() -> int:
    body = request.get_json(silent=True) or {}
    score = body.get("score")
    # bool is a subclass of int in Python, so it has to be rejected explicitly
    if not isinstance(score, int) or isinstance(score, bool) or not 1 <= score <= 5:
        raise ApiError("The score must be a whole number from 1 to 5.", code="invalid_score")
    return score


@bp.get("")
@login_required
def list_ratings():
    sort = request.args.get("sort", "recent")
    order = SORTS.get(sort)
    if order is None:
        raise ApiError("Invalid sort. Use recent, score or title.", code="invalid_param")
    ratings = Rating.query.filter_by(user_id=g.user.id).order_by(order, Rating.id.desc()).all()
    return jsonify([r.to_dict() for r in ratings])


@bp.get("/<int:movie_id>")
@login_required
def get_rating(movie_id: int):
    rating = _own_rating(movie_id)
    if rating is None:
        raise ApiError("You haven't rated this movie yet.", 404, "not_found")
    return jsonify(rating.to_dict())


@bp.put("/<int:movie_id>")
@login_required
def upsert_rating(movie_id: int):
    """Creates or updates the score (PUT is idempotent: same body, same result).

    Movie data comes from TMDB through the backend, not from the request body,
    so the client only sends the score and can't store a fake title or poster.
    """
    score = _parse_score()
    rating = _own_rating(movie_id)
    created = rating is None

    if created:
        movie = current_app.tmdb.movie_details(movie_id)  # 404 if the movie doesn't exist
        rating = Rating(
            user_id=g.user.id,
            movie_id=movie_id,
            title=movie.get("title") or movie.get("original_title") or "Untitled",
            poster_path=movie.get("poster_path"),
            release_date=movie.get("release_date") or None,
            score=score,
        )
        db.session.add(rating)
    else:
        rating.score = score

    db.session.commit()
    return jsonify(rating.to_dict()), 201 if created else 200


@bp.delete("/<int:movie_id>")
@login_required
def delete_rating(movie_id: int):
    rating = _own_rating(movie_id)
    if rating is None:
        raise ApiError("You haven't rated this movie yet.", 404, "not_found")
    db.session.delete(rating)
    db.session.commit()
    return "", 204
