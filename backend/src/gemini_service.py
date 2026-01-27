# backend/src/services/gemini_service.py

import os
import re
import json
import time
from google import genai
from google.genai import types

# ===============================
# 環境変数チェック
# ===============================
API_KEY = os.getenv("GEMINI_API_KEY")
if not API_KEY:
    raise RuntimeError("GEMINI_API_KEY が設定されていません")

client = genai.Client(api_key=API_KEY)

# ===============================
# Gemini 出力スキーマ
# ===============================
minutes_schema = {
    "type": "object",
    "properties": {
        "summary": {"type": "string"},
        "key_points": {
            "type": "array",
            "items": {"type": "string"},
        },
        "actionItems": {
            "type": "array",
            "items": {
                "type": "object",
                "properties": {
                    "task": {"type": "string"},
                    "assignee": {"type": "string"},
                    "deadline": {"type": "string"},
                },
                "required": ["task", "assignee"],
            },
        },
    },
    "required": ["summary", "key_points", "actionItems"],
}

# ===============================
# ユーティリティ
# ===============================

def sanitize_transcript(text: str) -> str:
    text = re.sub(r"[\x00-\x1F\x7F]+", " ", text)
    text = re.sub(r"\s+", " ", text)
    return text.strip()


def detect_primary_language(text: str) -> str:
    ja = 0
    en = 0

    for ch in text:
        code = ord(ch)
        if (0x3040 <= code <= 0x30FF) or (0x4E00 <= code <= 0x9FFF):
            ja += 1
        elif ch.isalpha():
            en += 1

    if ja >= en and ja > 0:
        return "ja"
    if en > ja and en > 0:
        return "en"
    return "ja"

# ===============================
# リトライ付き Gemini 呼び出し
# ===============================

def generate_with_retry(prompt: str, max_retry: int = 3):
    for attempt in range(max_retry):
        try:
            response = client.models.generate_content(
                model="gemini-2.5-flash",
                contents=prompt,
                config=types.GenerateContentConfig(
                    response_mime_type="application/json",
                    response_schema=minutes_schema,
                ),
            )
            return response
        except Exception as e:
            if attempt >= max_retry - 1:
                raise e
            wait = 2 ** attempt
            print(f"Gemini retry {attempt+1}/{max_retry} wait {wait}s")
            time.sleep(wait)

# ===============================
# メイン処理
# ===============================

def generate_minutes_from_text(transcript: str) -> dict:
    clean = sanitize_transcript(transcript)
    lang = detect_primary_language(clean)
    lang_label = "日本語" if lang == "ja" else "英語"

    prompt = f"""
あなたは優秀な会議アシスタントです。
以下の会議の文字起こしを分析し、指定されたJSON形式で出力してください。

出力ルール:
- 出力言語は「{lang_label}」
- JSON以外の文章は出力しない
- 期限は YYYY-MM-DD 形式
- 不明な期限は "" を使用
- 「未定」「TBD」は使用しない

文字起こし:
---
{clean}
---
"""

    response = generate_with_retry(prompt)
    json_text = response.text.strip()

    data = json.loads(json_text)

    return {
        "summary": data["summary"],
        "key_points": data["key_points"],
        "actionItems": [
            {
                "description": item.get("task", ""),
                "owner_name": item.get("assignee", "未割り当て"),
                "due_date": item.get("deadline")
                if re.match(r"^\d{4}-\d{2}-\d{2}$", item.get("deadline", ""))
                else None,
            }
            for item in data["actionItems"]
        ],
        "participants": [],
    }
