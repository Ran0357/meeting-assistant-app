from flask import request, jsonify, g
from fnmatch import fnmatch
from supabase_auth_service import SupabaseAuthService

supabase_auth_service = SupabaseAuthService()

# 認証フィルター
def auth_filter():
    excluded_patterns = [
        "/", "/api/auth/*"
    ]

    # 除外パスは認証チェックしない
    if any(fnmatch(request.path, pattern) for pattern in excluded_patterns):
        return
    
    auth_header = request.headers.get("Authorization", "")
    if not auth_header.startswith("Bearer "):
        return jsonify({"error": "Unauthorized"}), 401
    
    supabase_result, status_code = supabase_auth_service.get_user_by_access_token(access_token=auth_header[7:])
    if not supabase_result.get("id"):
        return jsonify({"error": "Unauthorized"}), 401

    g.user_id = supabase_result.get("id")