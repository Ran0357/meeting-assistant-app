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

    data = request.get_json() or {}
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

    data = request.get_json() or {}

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
