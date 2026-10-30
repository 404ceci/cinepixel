import time

from flask import Flask, g
from flask_cors import CORS
from sqlalchemy import inspect, text
from sqlalchemy.exc import OperationalError

from .config import Config
from .errors import register_error_handlers
from .extensions import db
from .tmdb import TMDBClient


def _drop_legacy_ratings(app: Flask) -> None:
    """Upgrades databases created before user accounts existed.

    That first version had a `ratings` table without `user_id`. create_all()
    never alters existing tables, so every signed-in query would fail. Those
    old rows belong to no account and can't be assigned to one, so the table
    is dropped and recreated with the current schema.
    """
    inspector = inspect(db.engine)
    if "ratings" not in inspector.get_table_names():
        return
    columns = {c["name"] for c in inspector.get_columns("ratings")}
    if "user_id" not in columns:
        app.logger.warning("Old 'ratings' table without user accounts found; recreating it.")
        db.session.execute(text("DROP TABLE ratings"))
        db.session.commit()


def _init_db(app: Flask, retries: int = 10, delay: float = 2.0) -> None:
    """Creates the tables, waiting for Postgres to accept connections if needed."""
    with app.app_context():
        for attempt in range(1, retries + 1):
            try:
                db.session.execute(text("SELECT 1"))
                _drop_legacy_ratings(app)
                db.create_all()
                return
            except OperationalError:
                if attempt == retries:
                    raise
                app.logger.warning("Database not ready (attempt %s/%s)…", attempt, retries)
                time.sleep(delay)


def create_app(config_overrides: dict | None = None, tmdb_client: TMDBClient | None = None) -> Flask:
    app = Flask(__name__)
    app.config.from_object(Config)
    if config_overrides:
        app.config.update(config_overrides)

    if app.config["SECRET_KEY"] == "dev-only-change-me" and not app.config.get("TESTING"):
        app.logger.warning("SECRET_KEY is using the development default. Set it in .env.")

    db.init_app(app)
    CORS(
        app,
        resources={r"/api/*": {"origins": app.config["CORS_ORIGINS"]}},
        expose_headers=["X-Cache"],
    )

    app.tmdb = tmdb_client or TMDBClient(
        api_key=app.config["TMDB_API_KEY"],
        base_url=app.config["TMDB_BASE_URL"],
        language=app.config["TMDB_LANGUAGE"],
        cache_ttl=app.config["TMDB_CACHE_TTL"],
        timeout=app.config["TMDB_TIMEOUT"],
    )

    from .routes.auth import bp as auth_bp
    from .routes.movies import bp as movies_bp
    from .routes.ratings import bp as ratings_bp

    app.register_blueprint(auth_bp)
    app.register_blueprint(movies_bp)
    app.register_blueprint(ratings_bp)
    register_error_handlers(app)

    @app.after_request
    def add_cache_header(response):
        # HIT when every TMDB call in this request came from the cache; MISS otherwise.
        status = g.get("tmdb_cache")
        if status:
            response.headers["X-Cache"] = status
        return response

    _init_db(app)
    return app
