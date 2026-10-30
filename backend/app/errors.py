from flask import Flask, jsonify
from werkzeug.exceptions import HTTPException


class ApiError(Exception):
    """A business error that becomes a standard JSON response."""

    def __init__(self, message: str, status: int = 400, code: str = "bad_request"):
        super().__init__(message)
        self.message = message
        self.status = status
        self.code = code


def register_error_handlers(app: Flask) -> None:
    @app.errorhandler(ApiError)
    def handle_api_error(err: ApiError):
        return jsonify({"error": {"code": err.code, "message": err.message}}), err.status

    @app.errorhandler(HTTPException)
    def handle_http(err: HTTPException):
        return (
            jsonify({"error": {"code": err.name.lower().replace(" ", "_"), "message": err.description}}),
            err.code,
        )

    @app.errorhandler(Exception)
    def handle_unexpected(err: Exception):
        app.logger.exception("Unexpected error")
        return (
            jsonify({"error": {"code": "internal_error", "message": "Something went wrong on the server."}}),
            500,
        )
