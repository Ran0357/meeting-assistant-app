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

    # 既存 todo を取得して id リストを作る
    existing_todos = supabase.table("document_todos")\
        .select("id").eq("document_id", document_id).execute().data
    existing_todo_ids = {t["id"] for t in existing_todos}

    sent_todo_ids = set()
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
            sent_todo_ids.add(a["id"])
        else:
            insert_res = supabase.table("document_todos").insert(todo_data).execute()
            sent_todo_ids.add(insert_res.data[0]["id"])

    # フロントで削除されたものは DB からも削除
    ids_to_delete = existing_todo_ids - sent_todo_ids
    if ids_to_delete:
        supabase.table("document_todos").delete().in_("id", list(ids_to_delete)).execute()

    # ---------- participants ----------
    participants = data.get("participants") or []

    existing_participants = supabase.table("document_participants")\
        .select("id").eq("document_id", document_id).execute().data
    existing_participant_ids = {p["id"] for p in existing_participants}

    sent_participant_ids = set()
    for p in participants:
        participant_data = {
            "document_id": document_id,
            "name": p.get("name"),
            "role": p.get("role") or None
        }
        if p.get("id"):
            supabase.table("document_participants").update(participant_data).eq("id", p["id"]).execute()
            sent_participant_ids.add(p["id"])
        else:
            insert_res = supabase.table("document_participants").insert(participant_data).execute()
            sent_participant_ids.add(insert_res.data[0]["id"])

    ids_to_delete = existing_participant_ids - sent_participant_ids
    if ids_to_delete:
        supabase.table("document_participants").delete().in_("id", list(ids_to_delete)).execute()

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
