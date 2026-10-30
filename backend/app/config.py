import os


class Config:
    SQLALCHEMY_DATABASE_URI = os.getenv(
        "DATABASE_URL",
        "postgresql+psycopg://movies:movies@localhost:5432/movies",
    )
    SQLALCHEMY_TRACK_MODIFICATIONS = False
    SQLALCHEMY_ENGINE_OPTIONS = {"pool_pre_ping": True}

    # Signs the JWT access tokens. Must be overridden outside local development.
    SECRET_KEY = os.getenv("SECRET_KEY", "dev-only-change-me")
    JWT_EXPIRES_HOURS = int(os.getenv("JWT_EXPIRES_HOURS", "168"))  # 7 days

    # Accepts either the TMDB "API Key" (v3) or the "API Read Access Token" (v4).
    TMDB_API_KEY = os.getenv("TMDB_API_KEY", "")
    TMDB_BASE_URL = os.getenv("TMDB_BASE_URL", "https://api.themoviedb.org/3")
    TMDB_LANGUAGE = os.getenv("TMDB_LANGUAGE", "en-US")
    TMDB_CACHE_TTL = int(os.getenv("TMDB_CACHE_TTL", "600"))  # seconds
    TMDB_TIMEOUT = float(os.getenv("TMDB_TIMEOUT", "8"))

    CORS_ORIGINS = os.getenv("CORS_ORIGINS", "*")
