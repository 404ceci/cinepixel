from datetime import datetime, timedelta, timezone
from unittest.mock import MagicMock

import jwt
import pytest
import requests

from app.errors import ApiError
from app.tmdb import TMDBClient

from .conftest import register


# ------------------------------------------------------------------- movies
def test_search_returns_summaries(client, fake_tmdb):
    resp = client.get("/api/movies?query=fight&year=1999")
    assert resp.status_code == 200
    body = resp.get_json()
    assert body["mode"] == "search"
    assert body["results"][0]["title"] == "Fight Club"
    assert body["results"][0]["user_score"] is None
    assert fake_tmdb.calls[-1] == ("search", "fight", 1, 1999)


def test_discover_when_no_query_and_caps_pages(client, fake_tmdb):
    body = client.get("/api/movies?genre=18&page=2").get_json()
    assert body["mode"] == "discover"
    assert body["total_pages"] == 500  # TMDB limit
    assert fake_tmdb.calls[-1] == ("discover", 2, 18, None)


@pytest.mark.parametrize("qs", ["page=0", "page=abc", "year=1500", "page=501"])
def test_invalid_params_are_400(client, qs):
    resp = client.get(f"/api/movies?{qs}")
    assert resp.status_code == 400
    assert resp.get_json()["error"]["code"] == "invalid_param"


def test_movie_detail_includes_cast_and_director(client):
    body = client.get("/api/movies/550").get_json()
    assert body["cast"][0]["name"] == "Brad Pitt"
    assert body["directors"] == ["David Fincher"]
    assert body["genres"] == ["Drama"]
    assert body["user_rating"] is None


def test_movie_detail_404(client):
    assert client.get("/api/movies/999").status_code == 404


def test_health_reports_cache(client):
    body = client.get("/api/health").get_json()
    assert body["status"] == "ok"
    assert "tmdb_cache" in body


# --------------------------------------------------------------------- auth
def test_register_login_and_me(client):
    headers = register(client, "Ana@Example.com", "supersecret")
    assert client.get("/api/auth/me", headers=headers).get_json()["email"] == "ana@example.com"

    resp = client.post("/api/auth/login", json={"email": "ana@example.com", "password": "supersecret"})
    assert resp.status_code == 200
    assert resp.get_json()["user"]["email"] == "ana@example.com"


def test_duplicate_email_is_409(client):
    register(client)
    resp = client.post("/api/auth/register", json={"email": "ana@example.com", "password": "another123"})
    assert resp.status_code == 409
    assert resp.get_json()["error"]["code"] == "email_taken"


@pytest.mark.parametrize(
    "payload,code",
    [
        ({"email": "not-an-email", "password": "supersecret"}, "invalid_email"),
        ({"email": "a@b.co", "password": "short"}, "weak_password"),
        ({}, "invalid_email"),
    ],
)
def test_register_validation(client, payload, code):
    resp = client.post("/api/auth/register", json=payload)
    assert resp.status_code == 400
    assert resp.get_json()["error"]["code"] == code


def test_wrong_password_and_unknown_email_look_the_same(client):
    register(client)
    wrong = client.post("/api/auth/login", json={"email": "ana@example.com", "password": "nope-nope"})
    unknown = client.post("/api/auth/login", json={"email": "who@example.com", "password": "nope-nope"})
    assert wrong.status_code == unknown.status_code == 401
    assert wrong.get_json() == unknown.get_json()


def test_password_is_not_stored_in_plain_text(app, client):
    register(client)
    from app.models import User

    with app.app_context():
        user = User.query.one()
        assert "supersecret" not in user.password_hash


def test_protected_routes_require_a_token(client):
    assert client.get("/api/ratings").status_code == 401
    assert client.put("/api/ratings/550", json={"score": 3}).status_code == 401
    assert client.delete("/api/ratings/550").status_code == 401
    assert client.get("/api/auth/me").status_code == 401


def test_bad_and_expired_tokens(client, app):
    bad = client.get("/api/ratings", headers={"Authorization": "Bearer nonsense"})
    assert bad.get_json()["error"]["code"] == "invalid_token"

    register(client)
    expired = jwt.encode(
        {"sub": "1", "exp": datetime.now(timezone.utc) - timedelta(minutes=1)}, "test", algorithm="HS256"
    )
    resp = client.get("/api/ratings", headers={"Authorization": f"Bearer {expired}"})
    assert resp.status_code == 401
    assert resp.get_json()["error"]["code"] == "token_expired"


# ------------------------------------------------------------------ ratings
def test_rating_crud_flow(client, auth):
    resp = client.put("/api/ratings/550", json={"score": 4}, headers=auth)
    assert resp.status_code == 201
    assert resp.get_json()["title"] == "Fight Club"

    # shows up in search results and in the detail view
    assert client.get("/api/movies?query=fight", headers=auth).get_json()["results"][0]["user_score"] == 4
    assert client.get("/api/movies/550", headers=auth).get_json()["user_rating"]["score"] == 4

    resp = client.put("/api/ratings/550", json={"score": 2}, headers=auth)
    assert resp.status_code == 200 and resp.get_json()["score"] == 2

    ratings = client.get("/api/ratings", headers=auth).get_json()
    assert len(ratings) == 1 and ratings[0]["score"] == 2

    assert client.delete("/api/ratings/550", headers=auth).status_code == 204
    assert client.get("/api/ratings", headers=auth).get_json() == []
    assert client.delete("/api/ratings/550", headers=auth).status_code == 404


def test_users_only_see_their_own_ratings(client):
    ana = register(client, "ana@example.com")
    bia = register(client, "bia@example.com")
    client.put("/api/ratings/550", json={"score": 5}, headers=ana)
    client.put("/api/ratings/550", json={"score": 1}, headers=bia)  # same movie, different user

    assert [r["score"] for r in client.get("/api/ratings", headers=ana).get_json()] == [5]
    assert [r["score"] for r in client.get("/api/ratings", headers=bia).get_json()] == [1]
    assert client.get("/api/movies/550", headers=bia).get_json()["user_rating"]["score"] == 1
    # anonymous visitors see no score at all
    assert client.get("/api/movies/550").get_json()["user_rating"] is None


def test_edit_does_not_call_tmdb_again(client, fake_tmdb, auth):
    client.put("/api/ratings/550", json={"score": 3}, headers=auth)
    calls_before = len(fake_tmdb.calls)
    client.put("/api/ratings/550", json={"score": 5}, headers=auth)
    assert len(fake_tmdb.calls) == calls_before


@pytest.mark.parametrize("payload", [{"score": 0}, {"score": 6}, {"score": "5"}, {"score": True}, {}, None])
def test_invalid_scores(client, auth, payload):
    resp = client.put("/api/ratings/550", json=payload, headers=auth)
    assert resp.status_code == 400
    assert resp.get_json()["error"]["code"] == "invalid_score"


def test_rating_unknown_movie_is_404(client, auth):
    assert client.put("/api/ratings/999", json={"score": 3}, headers=auth).status_code == 404


def test_ratings_sorting(client, auth):
    client.put("/api/ratings/550", json={"score": 2}, headers=auth)
    client.put("/api/ratings/13", json={"score": 5}, headers=auth)
    by_score = [r["movie_id"] for r in client.get("/api/ratings?sort=score", headers=auth).get_json()]
    by_title = [r["title"] for r in client.get("/api/ratings?sort=title", headers=auth).get_json()]
    assert by_score == [13, 550]
    assert by_title == ["Fight Club", "Forrest Gump"]
    assert client.get("/api/ratings?sort=xyz", headers=auth).status_code == 400


# -------------------------------------------------------------- TMDB client
def _fake_session(status=200, payload=None):
    session = MagicMock()
    resp = MagicMock(status_code=status, ok=200 <= status < 300)
    resp.json.return_value = payload or {"genres": [{"id": 1, "name": "Action"}]}
    session.get.return_value = resp
    return session


def test_tmdb_cache_avoids_repeated_requests():
    session = _fake_session()
    client = TMDBClient("abc", "https://tmdb.test", session=session)
    client.genres()
    client.genres()
    assert session.get.call_count == 1
    assert client.cache_stats()["hits"] == 1 and client.cache_stats()["misses"] == 1
    client.clear_cache()
    client.genres()
    assert session.get.call_count == 2


def test_x_cache_header_goes_from_miss_to_hit(fake_tmdb):
    from app import create_app

    session = _fake_session(payload={"page": 1, "total_pages": 1, "total_results": 0, "results": []})
    app = create_app(
        {"SQLALCHEMY_DATABASE_URI": "sqlite:///:memory:", "TESTING": True},
        tmdb_client=TMDBClient("abc", "https://tmdb.test", session=session),
    )
    c = app.test_client()
    assert c.get("/api/movies?query=dune").headers["X-Cache"] == "MISS"
    assert c.get("/api/movies?query=dune").headers["X-Cache"] == "HIT"
    assert session.get.call_count == 1


def test_tmdb_auth_modes():
    v3 = _fake_session()
    TMDBClient("abc", "https://tmdb.test", session=v3).genres()
    assert v3.get.call_args.kwargs["params"]["api_key"] == "abc"

    v4 = _fake_session()
    TMDBClient("eyJtoken", "https://tmdb.test", session=v4).genres()
    assert v4.get.call_args.kwargs["headers"]["Authorization"] == "Bearer eyJtoken"
    assert "api_key" not in v4.get.call_args.kwargs["params"]


@pytest.mark.parametrize("status,code", [(401, "tmdb_unauthorized"), (429, "tmdb_rate_limited"), (500, "tmdb_error")])
def test_tmdb_errors_are_translated(status, code):
    client = TMDBClient("abc", "https://tmdb.test", session=_fake_session(status=status))
    with pytest.raises(ApiError) as exc:
        client.genres()
    assert exc.value.code == code


def test_tmdb_network_failure():
    session = MagicMock()
    session.get.side_effect = requests.ConnectionError()
    with pytest.raises(ApiError) as exc:
        TMDBClient("abc", "https://tmdb.test", session=session).genres()
    assert exc.value.code == "tmdb_unreachable"


def test_missing_key_is_503():
    with pytest.raises(ApiError) as exc:
        TMDBClient("", "https://tmdb.test").genres()
    assert exc.value.status == 503


def test_old_database_without_accounts_is_upgraded(tmp_path, fake_tmdb):
    """A database from the version before accounts had ratings without user_id."""
    import sqlite3

    from app import create_app

    path = tmp_path / "old.db"
    conn = sqlite3.connect(path)
    conn.execute(
        "CREATE TABLE ratings (id INTEGER PRIMARY KEY, movie_id INTEGER UNIQUE NOT NULL, "
        "score SMALLINT NOT NULL, title VARCHAR(255) NOT NULL, poster_path VARCHAR(255), "
        "release_date VARCHAR(10), created_at DATETIME NOT NULL, updated_at DATETIME NOT NULL)"
    )
    conn.execute("INSERT INTO ratings VALUES (1, 550, 4, 'Fight Club', NULL, NULL, '2026-01-01', '2026-01-01')")
    conn.commit()
    conn.close()

    app = create_app(
        {"SQLALCHEMY_DATABASE_URI": f"sqlite:///{path}", "TESTING": True, "SECRET_KEY": "test"},
        tmdb_client=fake_tmdb,
    )
    c = app.test_client()
    headers = register(c)
    assert c.get("/api/movies", headers=headers).status_code == 200
    assert c.put("/api/ratings/550", json={"score": 3}, headers=headers).status_code == 201
