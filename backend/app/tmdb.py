"""TMDB client with an in-memory TTL cache.

The frontend never talks to TMDB directly: every request goes through here.
That keeps the API key out of the browser and lets repeated requests (the same
search, the same movie opened twice, the genre list) be served from memory.
"""

from __future__ import annotations

import threading
from typing import Any

import requests
from cachetools import TTLCache
from flask import g, has_request_context

from .errors import ApiError


class TMDBClient:
    def __init__(
        self,
        api_key: str,
        base_url: str,
        language: str = "en-US",
        cache_ttl: int = 600,
        cache_size: int = 512,
        timeout: float = 8.0,
        session: requests.Session | None = None,
    ):
        self.api_key = api_key.strip()
        self.base_url = base_url.rstrip("/")
        self.language = language
        self.timeout = timeout
        self.session = session or requests.Session()
        self._cache: TTLCache = TTLCache(maxsize=cache_size, ttl=cache_ttl)
        self._lock = threading.Lock()  # gunicorn runs with threads
        self.hits = 0
        self.misses = 0

    # ------------------------------------------------------------------ cache
    def _record(self, hit: bool) -> None:
        if hit:
            self.hits += 1
        else:
            self.misses += 1
        # Lets the route add an X-Cache header to its response.
        if has_request_context():
            g.tmdb_cache = "MISS" if not hit or g.get("tmdb_cache") == "MISS" else "HIT"

    def cache_stats(self) -> dict:
        with self._lock:
            return {
                "entries": len(self._cache),
                "max_entries": self._cache.maxsize,
                "ttl_seconds": int(self._cache.ttl),
                "hits": self.hits,
                "misses": self.misses,
            }

    def clear_cache(self) -> None:
        with self._lock:
            self._cache.clear()

    # ------------------------------------------------------------------- HTTP
    @property
    def _uses_bearer(self) -> bool:
        # The v4 "API Read Access Token" is a JWT, which always starts with "eyJ".
        return self.api_key.startswith("eyJ")

    def _get(self, path: str, params: dict[str, Any] | None = None) -> dict:
        if not self.api_key:
            raise ApiError(
                "TMDB_API_KEY is not set. Add it to the .env file and restart.",
                status=503,
                code="tmdb_not_configured",
            )

        params = {k: v for k, v in (params or {}).items() if v not in (None, "")}
        params["language"] = self.language
        cache_key = (path, tuple(sorted(params.items())))

        with self._lock:
            cached = self._cache.get(cache_key)
        if cached is not None:
            self._record(hit=True)
            return cached

        headers = {"Accept": "application/json"}
        if self._uses_bearer:
            headers["Authorization"] = f"Bearer {self.api_key}"
        else:
            params["api_key"] = self.api_key

        try:
            resp = self.session.get(
                f"{self.base_url}{path}", params=params, headers=headers, timeout=self.timeout
            )
        except requests.RequestException as exc:
            raise ApiError(
                "Couldn't reach TMDB. Try again in a moment.", 502, "tmdb_unreachable"
            ) from exc

        if resp.status_code == 404:
            raise ApiError("Movie not found.", 404, "not_found")
        if resp.status_code == 401:
            raise ApiError("The TMDB API key was rejected. Check TMDB_API_KEY.", 502, "tmdb_unauthorized")
        if resp.status_code == 429:
            raise ApiError("TMDB rate limit reached. Wait a few seconds and try again.", 503, "tmdb_rate_limited")
        if not resp.ok:
            raise ApiError("TMDB returned an unexpected error.", 502, "tmdb_error")

        data = resp.json()
        with self._lock:
            self._cache[cache_key] = data
        self._record(hit=False)
        return data

    # ----------------------------------------------------------------- domain
    def search_movies(self, query: str, page: int = 1, year: int | None = None) -> dict:
        return self._get(
            "/search/movie",
            {"query": query, "page": page, "primary_release_year": year, "include_adult": "false"},
        )

    def discover_movies(
        self, page: int = 1, genre: int | None = None, year: int | None = None
    ) -> dict:
        return self._get(
            "/discover/movie",
            {
                "page": page,
                "with_genres": genre,
                "primary_release_year": year,
                "sort_by": "popularity.desc",
                "include_adult": "false",
            },
        )

    def movie_details(self, movie_id: int) -> dict:
        return self._get(f"/movie/{movie_id}", {"append_to_response": "credits"})

    def genres(self) -> list[dict]:
        return self._get("/genre/movie/list").get("genres", [])
