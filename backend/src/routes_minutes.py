from flask import Blueprint, request, jsonify, g
from supabase import create_client
from .services.gemini_service import generate_minutes_from_text
from .config import Config

bp_minutes = Blueprint("minutes", __name__, url_prefix="/api")

supabase = create_client(
    Config.SUPABASE_URL,
    Config.SUPABASE_SERVICE_KEY
)


# -----------------------------
# 議事録生成
# -----------------------------
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


# -----------------------------
# 議事録 保存 / 更新
# -----------------------------
@bp_minutes.route("/save_minutes", methods=["POST"])
def save_minutes():
    if not getattr(g, "user_id", None):
        return jsonify({"error": "Unauthorized"}), 401

    data = request.get_json()
    document_id = data.get("id")

    # ---------- documents ----------
    if document_id:
        supabase.table("documents") \
            .update({
                "title": data.get("title"),
                "summary": data.get("summary"),
                "key_points": data.get("key_points"),
                "meeting_date": data.get("meeting_date"),
            }) \
            .eq("id", document_id) \
            .eq("user_id", g.user_id) \
            .execute()
    else:
        doc_res = supabase.table("documents").insert({
            "user_id": g.user_id,
            "title": data.get("title"),
            "summary": data.get("summary"),
            "key_points": data.get("key_points"),
            "meeting_date": data.get("meeting_date"),
        }).execute()

        document_id = doc_res.data[0]["id"]

    # ---------- action items ----------
    supabase.table("document_todos") \
        .delete() \
        .eq("document_id", document_id) \
        .execute()

    action_items = data.get("actionItems") or []
    todos = []

    for a in action_items:
        if not a.get("description"):
            continue

        due_date = a.get("due_date")

        todos.append({
            "document_id": document_id,
            "description": a.get("description"),
            "owner_name": a.get("owner_name"),
            "due_date": due_date,
            "status": a.get("status", "open"),

            # 期限があるものだけ前日通知ON
            "notify_before": bool(due_date),
            "notified_before_at": None
        })

    if todos:
        supabase.table("document_todos").insert(todos).execute()

    return jsonify({"status": "ok", "document_id": document_id}), 200


# -----------------------------
# 議事録一覧取得
# -----------------------------
@bp_minutes.route("/documents", methods=["GET"])
def get_documents():
    if not getattr(g, "user_id", None):
        return jsonify({"error": "Unauthorized"}), 401

    res = supabase.table("documents") \
        .select("id,title,summary,meeting_date,created_at") \
        .eq("user_id", g.user_id) \
        .order("created_at", desc=True) \
        .execute()

    return jsonify({"documents": res.data}), 200


# -----------------------------
# 議事録詳細取得
# -----------------------------
@bp_minutes.route("/documents/<document_id>", methods=["GET"])
def get_document_detail(document_id):
    if not getattr(g, "user_id", None):
        return jsonify({"error": "Unauthorized"}), 401

    doc_res = supabase.table("documents") \
        .select("*") \
        .eq("id", document_id) \
        .eq("user_id", g.user_id) \
        .single() \
        .execute()

    if not doc_res.data:
        return jsonify({"error": "Document not found"}), 404

    document = doc_res.data

    participants = supabase.table("document_participants") \
        .select("*") \
        .eq("document_id", document_id) \
        .execute().data

    action_items = supabase.table("document_todos") \
        .select("*") \
        .eq("document_id", document_id) \
        .execute().data

    document["participants"] = participants
    document["actionItems"] = action_items

    return jsonify(document), 200
