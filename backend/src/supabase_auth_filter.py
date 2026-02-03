from flask import request, jsonify, g
from fnmatch import fnmatch
from .supabase_auth_service import SupabaseAuthService
import logging

logger = logging.getLogger(__name__)

supabase_auth_service = SupabaseAuthService()


def auth_filter():
    # CORS preflight は無条件で通す
    if request.method == "OPTIONS":
        return None

    excluded_patterns = [
        "/",               # トップ
        "/api/auth/*",     # 認証系
    ]

    # 除外パスは認証チェックしない
    for pattern in excluded_patterns:
        if fnmatch(request.path, pattern):
            return None

    auth_header = request.headers.get("Authorization", "")

    if not auth_header.startswith("Bearer "):
        logger.info("Missing or invalid Authorization header")
        return jsonify({"error": "Unauthorized"}), 401

    token = auth_header.removeprefix("Bearer ").strip()

    try:
        supabase_result, status_code = (
            supabase_auth_service.get_user_by_access_token(
                access_token=token
            )
        )
    except Exception:
        logger.exception("Supabase auth failed")
        return jsonify({"error": "Unauthorized"}), 401

    if status_code != 200 or not supabase_result.get("id"):
        logger.info("Invalid access token")
        return jsonify({"error": "Unauthorized"}), 401

    # ここまで来たら認証OK
    g.user_id = supabase_result["id"]
    g.user_email = supabase_result.get("email")

    return None
