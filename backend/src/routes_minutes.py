from flask import Blueprint, request, jsonify, g
from .services.gemini_service import generate_minutes_from_text

bp_minutes = Blueprint("minutes", __name__, url_prefix="/api")

@bp_minutes.route("/generate_minutes", methods=["POST"])
def generate_minutes():
    if not getattr(g, "user_id", None):
        return jsonify({"error": "Unauthorized"}), 401

    data = request.get_json()
    transcript = data.get("transcript", "")

    if not transcript:
        return jsonify({"error": "文字起こしが空です"}), 400

    result = generate_minutes_from_text(transcript)
    return jsonify(result)
