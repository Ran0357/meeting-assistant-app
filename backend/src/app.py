from .config import Config
from flask import Flask, jsonify, g
from flask_cors import CORS
from .routes_auth import bp_auth
from .supabase_auth_filter import auth_filter
from .routes_minutes import bp_minutes
import logging


def create_app() -> Flask:
    app = Flask(
        __name__,
        static_folder="static",
        static_url_path="",
    )

    # -----------------------------
    # Logging
    # -----------------------------
    logging.basicConfig(level=logging.INFO)

    # -----------------------------
    # CORS
    # -----------------------------
    CORS(
        app,
        resources={r"/api/*": {"origins": "*"}},
        methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"],
        allow_headers="*",
        supports_credentials=True,
    )

    # -----------------------------
    # Middleware
    # -----------------------------
    app.before_request(auth_filter)

    # -----------------------------
    # Blueprints
    # -----------------------------
    app.register_blueprint(bp_auth)
    app.register_blueprint(bp_minutes)

    # -----------------------------
    # Health / Debug
    # -----------------------------
    @app.route("/api/protected")
    def protected():
        if not getattr(g, "user_id", None):
            return jsonify({"error": "Unauthorized"}), 401

        return jsonify(
            {
                "message": "認証済みユーザーのみアクセスできます",
                "user_id": g.user_id,
            }
        )

    # -----------------------------
    # Error Handlers
    # -----------------------------
    @app.errorhandler(404)
    def not_found(_):
        return jsonify({"error": "Not Found"}), 404

    @app.errorhandler(500)
    def internal_error(_):
        return jsonify({"error": "Internal Server Error"}), 500

    return app


# -----------------------------
# Entrypoint
# -----------------------------
app = create_app()

if __name__ == "__main__":
    app.run(
        host="0.0.0.0",
        port=Config.SERVER_PORT,
        debug=True,
    )
