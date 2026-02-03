from flask import Blueprint, request, jsonify, g
from supabase import create_client
from .services.gemini_service import generate_minutes_from_text
from .config import Config
import logging

logger = logging.getLogger(__name__)

bp_minutes = Blueprint("minutes", __name__, url_prefix="/api")

# グローバル supabase client（Service Role Key 固定）
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

    data = request.get_json() or {}
    transcript = data.get("transcript")

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

    data = request.get_json() or {}
    document_id = data.get("id")

    try:
        # ---------- documents ----------
        doc_data = {
            "title": data.get("title"),
            "summary": data.get("summary"),
            "key_points": data.get("key_points"),
            "meeting_date": data.get("meeting_date"),
        }

        if document_id:
            supabase.table("documents") \
                .update(doc_data) \
                .eq("id", document_id) \
                .eq("user_id", g.user_id) \
                .execute()
        else:
            res = supabase.table("documents") \
                .insert({**doc_data, "user_id": g.user_id}) \
                .execute()
            document_id = res.data[0]["id"]

        # ---------- action items ----------
        action_items = data.get("actionItems") or []

        existing = supabase.table("document_todos") \
            .select("id") \
            .eq("document_id", document_id) \
            .execute().data

        existing_ids = {t["id"] for t in existing}
        sent_ids = set()

        for item in action_items:
            if not item.get("description"):
                continue

            todo_data = {
                "document_id": document_id,
                "description": item.get("description"),
                "owner_name": item.get("owner_name"),
                "due_date": item.get("due_date"),
                "status": item.get("status", "open"),
                "notify_before": bool(item.get("due_date")),
                "notified_before_at": item.get("notified_before_at"),
            }

            if item.get("id"):
                supabase.table("document_todos") \
                    .update(todo_data) \
                    .eq("id", item["id"]) \
                    .execute()
                sent_ids.add(item["id"])
            else:
                res = supabase.table("document_todos") \
                    .insert(todo_data) \
                    .execute()
                sent_ids.add(res.data[0]["id"])

        delete_ids = existing_ids - sent_ids
        if delete_ids:
            supabase.table("document_todos") \
                .delete() \
                .in_("id", list(delete_ids)) \
                .execute()

        # ---------- participants ----------
        participants = data.get("participants") or []

        existing = supabase.table("document_participants") \
            .select("id") \
            .eq("document_id", document_id) \
            .execute().data

        existing_ids = {p["id"] for p in existing}
        sent_ids = set()

        for p in participants:
            pdata = {
                "document_id": document_id,
                "name": p.get("name"),
                "role": p.get("role"),
            }

            if p.get("id"):
                supabase.table("document_participants") \
                    .update(pdata) \
                    .eq("id", p["id"]) \
                    .execute()
                sent_ids.add(p["id"])
            else:
                res = supabase.table("document_participants") \
                    .insert(pdata) \
                    .execute()
                sent_ids.add(res.data[0]["id"])

        delete_ids = existing_ids - sent_ids
        if delete_ids:
            supabase.table("document_participants") \
                .delete() \
                .in_("id", list(delete_ids)) \
                .execute()

        return jsonify({"status": "ok", "document_id": document_id}), 200

    except Exception:
        logger.exception("Failed to save minutes")
        return jsonify({"error": "Failed to save minutes"}), 500


# -----------------------------
# 議事録一覧取得
# -----------------------------
@bp_minutes.route("/documents", methods=["GET"])
def get_documents():
    if not getattr(g, "user_id", None):
        return jsonify({"error": "Unauthorized"}), 401

    try:
        res = supabase.table("documents").select(
            "id, title, summary, meeting_date, created_at, updated_at"
        ).eq("user_id", g.user_id) \
         .order("updated_at", desc=True) \
         .execute()

        return jsonify({"documents": res.data}), 200

    except Exception:
        logger.exception("Failed to fetch documents")
        return jsonify({"error": "Failed to fetch documents"}), 500


# -----------------------------
# 議事録詳細取得
# -----------------------------
@bp_minutes.route("/documents/<document_id>", methods=["GET"])
def get_document_detail(document_id):
    if not getattr(g, "user_id", None):
        return jsonify({"error": "Unauthorized"}), 401

    try:
        doc = supabase.table("documents") \
            .select("*") \
            .eq("id", document_id) \
            .eq("user_id", g.user_id) \
            .single() \
            .execute()

        if not doc.data:
            return jsonify({"error": "Document not found"}), 404

        document = doc.data
        document["participants"] = supabase.table("document_participants") \
            .select("*") \
            .eq("document_id", document_id) \
            .execute().data

        document["actionItems"] = supabase.table("document_todos") \
            .select("*") \
            .eq("document_id", document_id) \
            .execute().data

        return jsonify(document), 200

    except Exception:
        logger.exception("Failed to fetch document detail")
        return jsonify({"error": "Failed to fetch document detail"}), 500
