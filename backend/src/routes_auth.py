from typing import Dict, Any
from flask import Blueprint, jsonify, request, Response, redirect, g
from supabase_auth_service import SupabaseAuthService
import logging
from supabase import create_client

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


# 過去の議事録一覧取得
@bp_auth.route("/api/documents", methods=["GET"])
def get_documents() -> Response:
    """現在のユーザーの過去の議事録一覧を取得"""
    user_id = getattr(g, "user_id", None)
    
    if not user_id:
        return jsonify({"error": "Unauthorized"}), 401

    try:
        from config import Config
        
        supabase = create_client(
            Config.SUPABASE_URL,
            Config.SUPABASE_SERVICE_KEY
        )
        
        # user_id に紐づく documents を取得
        response = supabase.table("documents").select(
            "id, title, meeting_date, summary, created_at, updated_at"
        ).eq("user_id", user_id).order("created_at", desc=True).execute()
        
        return jsonify({"documents": response.data}), 200
    
    except Exception as e:
        logger.error(f"Error fetching documents: {str(e)}")
        return jsonify({"error": str(e)}), 500


# 議事録詳細取得
@bp_auth.route("/api/documents/<document_id>", methods=["GET"])
def get_document_detail(document_id: str) -> Response:
    """指定された議事録の詳細情報を取得"""
    user_id = getattr(g, "user_id", None)
    
    if not user_id:
        return jsonify({"error": "Unauthorized"}), 401

    try:
        from config import Config
        
        supabase = create_client(
            Config.SUPABASE_URL,
            Config.SUPABASE_SERVICE_KEY
        )
        
        # document を取得（user_id チェック）
        doc_response = supabase.table("documents").select("*").eq("id", document_id).eq("user_id", user_id).single().execute()
        
        if not doc_response.data:
            return jsonify({"error": "Document not found"}), 404
        
        document = doc_response.data
        
        # 関連する participants と actionItems を取得
        participants = supabase.table("document_participants").select("*").eq("document_id", document_id).execute().data
        action_items = supabase.table("document_todos").select("*").eq("document_id", document_id).execute().data
        
        document["participants"] = participants
        document["actionItems"] = action_items
        
        return jsonify(document), 200
    
    except Exception as e:
        logger.error(f"Error fetching document detail: {str(e)}")
        return jsonify({"error": str(e)}), 500



