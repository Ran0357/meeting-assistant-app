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
    user_id = g.user_id

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
            .eq("user_id", user_id) \
            .execute()
    else:
        doc_res = supabase.table("documents").insert({
            "user_id": user_id,
            "title": data.get("title"),
            "summary": data.get("summary"),
            "key_points": data.get("key_points"),
            "meeting_date": data.get("meeting_date"),
        }).execute()
        document_id = doc_res.data[0]["id"]

    # ---------- action items ----------
    action_items = data.get("actionItems") or []

    # 現存 todo ID
    existing_todos_res = supabase.table("document_todos") \
        .select("id") \
        .eq("document_id", document_id) \
        .execute()
    existing_ids = [t["id"] for t in existing_todos_res.data]

    # フロントから削除されたものを消す
    incoming_ids = [a.get("id") for a in action_items if a.get("id")]
    to_delete = list(set(existing_ids) - set(incoming_ids))
    if to_delete:
        supabase.table("document_todos").delete().in_("id", to_delete).execute()

    # upsert で追加・更新
    todos_upsert = []
    for a in action_items:
        if not a.get("description"):
            continue

        todos_upsert.append({
            "id": a.get("id"),  # Noneの場合は新規
            "document_id": document_id,
            "description": a.get("description"),
            "owner_name": a.get("owner_name"),
            "due_date": a.get("due_date"),
            "status": a.get("status", "open"),
            "notify_before": bool(a.get("due_date")),
            "notified_before_at": a.get("notified_before_at"),
            "reminder_at": a.get("reminder_at"),
            "last_reminded_at": a.get("last_reminded_at"),
            "slack_channel": a.get("slack_channel"),
            "reminded_before": a.get("reminded_before", False)
        })

    if todos_upsert:
        supabase.table("document_todos").upsert(todos_upsert, on_conflict=["id"]).execute()

    # ---------- participants ----------
    participants = data.get("participants") or []

    # 現存参加者
    existing_participants_res = supabase.table("document_participants") \
        .select("id") \
        .eq("document_id", document_id) \
        .execute()
    existing_participant_ids = [p["id"] for p in existing_participants_res.data]

    incoming_participant_ids = [p.get("id") for p in participants if p.get("id")]
    to_delete_participants = list(set(existing_participant_ids) - set(incoming_participant_ids))
    if to_delete_participants:
        supabase.table("document_participants").delete().in_("id", to_delete_participants).execute()

    participants_upsert = []
    for p in participants:
        participants_upsert.append({
            "id": p.get("id"),
            "document_id": document_id,
            "name": p.get("name"),
            "role": p.get("role"),
            "slack_id": p.get("slack_id")
        })

    if participants_upsert:
        supabase.table("document_participants").upsert(participants_upsert, on_conflict=["id"]).execute()

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
