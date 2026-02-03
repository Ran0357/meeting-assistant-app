from typing import Dict, Any
from flask import Blueprint, jsonify, request, Response
from .supabase_auth_service import SupabaseAuthService
import logging

logger = logging.getLogger(__name__)
logging.basicConfig(level=logging.INFO)

bp_auth = Blueprint("auth", __name__)
supabase_auth_service = SupabaseAuthService()


# -----------------------------
# アカウント登録
# -----------------------------
@bp_auth.route("/api/auth/register", methods=["POST"])
def register() -> Response:
    data: Dict[str, Any] = request.get_json() or {}
    redirect_to: str = request.host_url.rstrip("/") + "/"

    result, status_code = supabase_auth_service.signup(
        email=data.get("email"),
        password=data.get("password"),
        redirect_to=redirect_to,
    )

    if result.get("id"):
        return jsonify({
            "message": "Registration successful. Please check your email for confirmation."
        }), 200

    return jsonify(result), 400


# -----------------------------
# 認証ユーザー情報取得
# -----------------------------
@bp_auth.route("/api/auth/user", methods=["GET"])
def auth_user() -> Response:
    auth_header = request.headers.get("Authorization", "")

    if not auth_header.startswith("Bearer "):
        return jsonify({"error": "Unauthorized"}), 401

    token = auth_header.replace("Bearer ", "")

    result, status_code = supabase_auth_service.get_user_by_access_token(
        access_token=token
    )

    if status_code != 200:
        return jsonify({"error": "Unauthorized"}), 401

    return jsonify({
        "email": result.get("email")
    }), 200


# -----------------------------
# ログイン
# -----------------------------
@bp_auth.route("/api/auth/login", methods=["POST"])
def login() -> Response:
    data: Dict[str, Any] = request.get_json() or {}

    result, status_code = supabase_auth_service.login_with_password(
        email=data.get("email"),
        password=data.get("password"),
    )

    return jsonify(result), status_code


# -----------------------------
# ログアウト
# -----------------------------
@bp_auth.route("/api/auth/logout", methods=["POST"])
def logout() -> Response:
    auth_header = request.headers.get("Authorization", "")

    if not auth_header.startswith("Bearer "):
        return jsonify({"message": "Already logged out"}), 200

    token = auth_header.replace("Bearer ", "")
    supabase_auth_service.logout(access_token=token)

    return jsonify({"message": "Logout successful."}), 200
