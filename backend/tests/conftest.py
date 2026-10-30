import pytest

from app import create_app
from app.errors import ApiError
from app.extensions import db

MOVIES = {
    550: {
        "id": 550,
        "title": "Fight Club",
        "original_title": "Fight Club",
        "overview": "An insomniac office worker…",
        "release_date": "1999-10-15",
        "poster_path": "/fight.jpg",
        "backdrop_path": "/fight-bg.jpg",
        "runtime": 139,
        "vote_average": 8.4,
        "genres": [{"id": 18, "name": "Drama"}],
        "credits": {
            "cast": [{"id": 1, "name": "Brad Pitt", "character": "Tyler Durden", "profile_path": None}],
            "crew": [{"name": "David Fincher", "job": "Director"}],
        },
    },
    13: {
        "id": 13,
        "title": "Forrest Gump",
        "release_date": "1994-06-23",
        "poster_path": "/gump.jpg",
        "genres": [],
        "credits": {"cast": [], "crew": []},
    },
}


class FakeTMDB:
    """Stands in for TMDB in tests: no network, predictable responses."""

    def __init__(self):
        self.calls = []

    def search_movies(self, query, page=1, year=None):
        self.calls.append(("search", query, page, year))
        results = [m for m in MOVIES.values() if query.lower() in m["title"].lower()]
        return {"page": page, "total_pages": 1, "total_results": len(results), "results": results}

    def discover_movies(self, page=1, genre=None, year=None):
        self.calls.append(("discover", page, genre, year))
        return {"page": page, "total_pages": 900, "total_results": 2, "results": list(MOVIES.values())}

    def movie_details(self, movie_id):
        self.calls.append(("details", movie_id))
        if movie_id not in MOVIES:
            raise ApiError("Movie not found.", status=404, code="not_found")
        return MOVIES[movie_id]

    def genres(self):
        return [{"id": 18, "name": "Drama"}]

    def cache_stats(self):
        return {"entries": 0, "hits": 0, "misses": 0}


@pytest.fixture()
def fake_tmdb():
    return FakeTMDB()


@pytest.fixture()
def app(fake_tmdb):
    app = create_app(
        {"SQLALCHEMY_DATABASE_URI": "sqlite:///:memory:", "TESTING": True, "SECRET_KEY": "test"},
        tmdb_client=fake_tmdb,
    )
    yield app
    with app.app_context():
        db.drop_all()


@pytest.fixture()
def client(app):
    return app.test_client()


def register(client, email="ana@example.com", password="supersecret"):
    resp = client.post("/api/auth/register", json={"email": email, "password": password})
    assert resp.status_code == 201, resp.get_json()
    return {"Authorization": f"Bearer {resp.get_json()['token']}"}


@pytest.fixture()
def auth(client):
    """Headers for a signed-in user."""
    return register(client)
