from flask import Blueprint, current_app, jsonify, request

from ..auth import current_user_optional
from ..errors import ApiError
from ..models import Rating

bp = Blueprint("movies", __name__, url_prefix="/api")

TMDB_MAX_PAGE = 500  # TMDB never returns pages beyond 500
CAST_LIMIT = 12


def _int_arg(name: str, default: int | None = None, lo: int | None = None, hi: int | None = None):
    raw = request.args.get(name)
    if raw in (None, ""):
        return default
    try:
        value = int(raw)
    except ValueError:
        raise ApiError(f"'{name}' must be a whole number.", code="invalid_param")
    if (lo is not None and value < lo) or (hi is not None and value > hi):
        raise ApiError(f"'{name}' is out of the allowed range.", code="invalid_param")
    return value


def _scores_for(movie_ids: list[int]) -> dict[int, int]:
    """The signed-in user's scores for a page of movies, in a single query."""
    user = current_user_optional()
    if user is None or not movie_ids:
        return {}
    rows = Rating.query.filter(Rating.user_id == user.id, Rating.movie_id.in_(movie_ids)).all()
    return {r.movie_id: r.score for r in rows}


def _summary(movie: dict, scores: dict[int, int]) -> dict:
    return {
        "id": movie["id"],
        "title": movie.get("title") or movie.get("original_title") or "Untitled",
        "poster_path": movie.get("poster_path"),
        "release_date": movie.get("release_date") or None,
        "vote_average": movie.get("vote_average"),
        "user_score": scores.get(movie["id"]),
    }


@bp.get("/health")
def health():
    return jsonify({"status": "ok", "tmdb_cache": current_app.tmdb.cache_stats()})


@bp.get("/genres")
def genres():
    return jsonify(current_app.tmdb.genres())


@bp.get("/movies")
def list_movies():
    """Text search (search) or filter-based browsing (discover).

    - with `query`: TMDB /search/movie — supports the year filter;
    - without `query`: TMDB /discover/movie — popular movies, filterable by genre and year.
    """
    tmdb = current_app.tmdb
    query = (request.args.get("query") or "").strip()
    page = _int_arg("page", 1, lo=1, hi=TMDB_MAX_PAGE)
    year = _int_arg("year", None, lo=1870, hi=2100)
    genre = _int_arg("genre", None, lo=1)

    if query:
        data = tmdb.search_movies(query, page=page, year=year)
    else:
        data = tmdb.discover_movies(page=page, genre=genre, year=year)

    results = data.get("results", [])
    scores = _scores_for([m["id"] for m in results])

    return jsonify(
        {
            "page": data.get("page", page),
            "total_pages": min(data.get("total_pages", 1), TMDB_MAX_PAGE),
            "total_results": data.get("total_results", len(results)),
            "mode": "search" if query else "discover",
            "results": [_summary(m, scores) for m in results],
        }
    )


@bp.get("/movies/<int:movie_id>")
def movie_detail(movie_id: int):
    m = current_app.tmdb.movie_details(movie_id)
    user = current_user_optional()
    rating = (
        Rating.query.filter_by(user_id=user.id, movie_id=movie_id).first() if user else None
    )

    credits = m.get("credits") or {}
    directors = [c["name"] for c in credits.get("crew", []) if c.get("job") == "Director"]

    return jsonify(
        {
            "id": m["id"],
            "title": m.get("title") or m.get("original_title"),
            "original_title": m.get("original_title"),
            "overview": m.get("overview") or "",
            "tagline": m.get("tagline") or "",
            "release_date": m.get("release_date") or None,
            "runtime": m.get("runtime"),
            "poster_path": m.get("poster_path"),
            "backdrop_path": m.get("backdrop_path"),
            "vote_average": m.get("vote_average"),
            "genres": [g["name"] for g in m.get("genres", [])],
            "directors": directors,
            "cast": [
                {
                    "id": c["id"],
                    "name": c.get("name"),
                    "character": c.get("character"),
                    "profile_path": c.get("profile_path"),
                }
                for c in credits.get("cast", [])[:CAST_LIMIT]
            ],
            "user_rating": rating.to_dict() if rating else None,
        }
    )
