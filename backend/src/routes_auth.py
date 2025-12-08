from typing import Dict, Any
from flask import Blueprint, jsonify, request, Response, redirect
from supabase_auth_service import SupabaseAuthService
import logging

logger = logging.getLogger(__name__)
logging.basicConfig(level=logging.INFO)

supabase_auth_service = SupabaseAuthService()

# 認証ルーティング
bp_auth = Blueprint("auth", __name__)

# アカウント登録
@bp_auth.route("/api/auth/register", methods=["POST"])
def register() -> Response:
    data : Dict[str, Any]  = request.get_json() or {}
    redirect_to : str = request.host_url.rstrip("/") + "/"
    supabase_result, status_code = supabase_auth_service.signup(
        email=data.get("email"), 
        password=data.get("password"), 
        redirect_to=redirect_to
    )
    if supabase_result.get("id"):
        return jsonify({"message": "Registration successful. Please check your email for confirmation."}), 200
    return jsonify(supabase_result), 400

# 認証ユーザ情報取得
@bp_auth.route("/api/auth/user")
def auth_user() -> Response:
    auth_header: str = request.headers.get("Authorization", "")

    # Bearer トークンが無い or 不正なら 401
    if not auth_header.startswith("Bearer "):
        return jsonify({"error": "Unauthorized"}), 401

    token = auth_header.replace("Bearer ", "")

    supabase_result, status_code = supabase_auth_service.get_user_by_access_token(
        access_token=token
    )

    if status_code != 200:
        return jsonify({"error": "Unauthorized"}), 401

    return jsonify({"email": supabase_result.get("email")}), 200

    
# ログイン
@bp_auth.route("/api/auth/login", methods=["POST"])
def login() -> Response:
    data : Dict[str, Any]  = request.get_json() or {}
    supabase_result, status_code = supabase_auth_service.login_with_password(
        email=data.get("email"), 
        password=data.get("password")
    )
    
    return jsonify(supabase_result), status_code

# ログアウト
@bp_auth.route("/api/auth/logout", methods=["POST"])
def logout() -> Response:
    auth_header: str = request.headers.get("Authorization", "")

    if not auth_header.startswith("Bearer "):
        return jsonify({"message": "Already logged out"}), 200

    token = auth_header.replace("Bearer ", "")

    supabase_auth_service.logout(access_token=token)
    return jsonify({"message": "Logout successful."}), 200



