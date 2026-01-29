from flask import Blueprint, request, jsonify, g
from supabase import create_client
from .services.gemini_service import generate_minutes_from_text
from .config import Config

bp_minutes = Blueprint("minutes", __name__, url_prefix="/api")

supabase = create_client(
    Config.SUPABASE_URL,
    Config.SUPABASE_SERVICE_KEY
)


# 議事録生成
@bp_minutes.route("/generate_minutes", methods=["POST"])
def generate_minutes():
    if not getattr(g, "user_id", None):
        return jsonify({"error": "Unauthorized"}), 401

    data = request.get_json()
    transcript = data.get("transcript", "")

    if not transcript:
        return jsonify({"error": "文字起こしが空です"}), 400

    result = generate_minutes_from_text(transcript)
    return jsonify(result), 200


# 議事録保存
@bp_minutes.route("/save_minutes", methods=["POST"])
def save_minutes():
    if not getattr(g, "user_id", None):
        return jsonify({"error": "Unauthorized"}), 401

    data = request.get_json()

    doc_res = supabase.table("documents").insert({
        "user_id": g.user_id,
        "title": data.get("title"),
        "summary": data.get("summary"),
        "key_points": data.get("key_points"),
        "meeting_date": data.get("meeting_date"),
    }).execute()

    document_id = doc_res.data[0]["id"]

    action_items = data.get("actionItems") or []
    todos = []

    for a in action_items:
        if not a.get("description"):
            continue
        todos.append({
            "document_id": document_id,
            "description": a.get("description"),
            "owner_name": a.get("owner_name"),
            "due_date": a.get("due_date"),
            "status": a.get("status", "open"),
        })

    if todos:
        supabase.table("document_todos").insert(todos).execute()

    return jsonify({"status": "ok", "document_id": document_id}), 200


# 過去の議事録一覧取得
@bp_auth.route("/api/documents", methods=["GET"])
def get_documents() -> Response:
    """現在のユーザーの過去の議事録一覧を取得"""
    user_id = getattr(g, "user_id", None)
    
    if not user_id:
        return jsonify({"error": "Unauthorized"}), 401

    try:
        from .config import Config
        
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
        from .config import Config
        
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
