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
    doc_data = {
        "title": data.get("title"),
        "summary": data.get("summary"),
        "key_points": data.get("key_points"),
        "meeting_date": data.get("meeting_date"),
    }

    if document_id:
        supabase.table("documents").update(doc_data)\
            .eq("id", document_id).eq("user_id", g.user_id).execute()
    else:
        doc_res = supabase.table("documents").insert({**doc_data, "user_id": g.user_id}).execute()
        document_id = doc_res.data[0]["id"]

    # ---------- action items ----------
    action_items = data.get("actionItems") or []
    for a in action_items:
        if not a.get("description"):
            continue
        todo_data = {
            "document_id": document_id,
            "description": a.get("description"),
            "owner_name": a.get("owner_name") or None,
            "due_date": a.get("due_date") or None,
            "status": a.get("status", "open"),
            "notify_before": bool(a.get("due_date")),
            "notified_before_at": a.get("notified_before_at") or None
        }
        if a.get("id"):
            supabase.table("document_todos").update(todo_data).eq("id", a["id"]).execute()
        else:
            supabase.table("document_todos").insert(todo_data).execute()

    # ---------- participants ----------
    participants = data.get("participants") or []
    for p in participants:
        participant_data = {
            "document_id": document_id,
            "name": p.get("name"),
            "role": p.get("role") or None
        }
        if p.get("id"):
            supabase.table("document_participants").update(participant_data).eq("id", p["id"]).execute()
        else:
            supabase.table("document_participants").insert(participant_data).execute()

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
