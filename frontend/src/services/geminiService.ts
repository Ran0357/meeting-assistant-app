import { GoogleGenAI, Type } from "@google/genai";
import { GeneratedMinutes } from "../types";

/* ===============================
   環境変数チェック
================================ */
if (!process.env.API_KEY) {
  throw new Error("API_KEY環境変数が設定されていません。");
}

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
const model = ai.models;

/* ===============================
   Gemini 出力スキーマ
================================ */
const minutesSchema = {
  type: Type.OBJECT,
  properties: {
    summary: {
      type: Type.STRING,
      description: "会議全体の簡潔な要約。",
    },
    key_points: {
      type: Type.ARRAY,
      description: "議論された主要なトピックや決定事項。",
      items: { type: Type.STRING },
    },
    actionItems: {
      type: Type.ARRAY,
      description: "会議から発生したタスク一覧。",
      items: {
        type: Type.OBJECT,
        properties: {
          task: { type: Type.STRING },
          assignee: { type: Type.STRING },
          deadline: {
            type: Type.STRING,
            description: "YYYY-MM-DD形式。特定不可の場合は空文字。",
          },
        },
        required: ["task", "assignee"],
      },
    },
  },
  required: ["summary", "key_points", "actionItems"],
};

/* ===============================
   ユーティリティ
================================ */
function sanitizeTranscript(text: string): string {
  return text
    .replace(/[\x00-\x1F\x7F]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function detectPrimaryLanguage(text: string): "ja" | "en" {
  let ja = 0;
  let en = 0;

  for (const ch of text) {
    const code = ch.charCodeAt(0);
    if (
      (code >= 0x3040 && code <= 0x30ff) ||
      (code >= 0x4e00 && code <= 0x9fff)
    ) {
      ja++;
    } else if (/[A-Za-z]/.test(ch)) {
      en++;
    }
  }

  if (ja >= en && ja > 0) return "ja";
  if (en > ja && en > 0) return "en";
  return "ja";
}

/* ===============================
   リトライ付き Gemini 呼び出し
================================ */
async function generateWithRetry(
  prompt: string,
  maxRetry = 3
) {
  let attempt = 0;

  while (true) {
    try {
      return await model.generateContent({
        model: "gemini-2.5-flash",
        contents: prompt,
        config: {
          responseMimeType: "application/json",
          responseSchema: minutesSchema,
        },
      });
    } catch (err: any) {
      attempt++;

      const is503 =
        err?.message?.includes("503") ||
        err?.status === 503;

      if (!is503 || attempt >= maxRetry) {
        throw err;
      }

      const waitMs = 1000 * Math.pow(2, attempt);
      console.warn(
        `Gemini overloaded (retry ${attempt}/${maxRetry}) - wait ${waitMs}ms`
      );
      await new Promise((r) => setTimeout(r, waitMs));
    }
  }
}

/* ===============================
   メイン関数
================================ */
export const generateMinutesFromText = async (
  transcript: string
): Promise<GeneratedMinutes> => {
  const clean = sanitizeTranscript(transcript);
  const lang = detectPrimaryLanguage(clean);
  const langLabel = lang === "ja" ? "日本語" : "英語";

  const prompt = `
あなたは優秀な会議アシスタントです。
以下の会議の文字起こしを分析し、指定されたJSON形式で出力してください。

出力ルール:
- 出力言語は「${langLabel}」
- JSON以外の文章は出力しない
- 期限は YYYY-MM-DD 形式
- 不明な期限は "" を使用
- 「未定」「TBD」は使用しない

文字起こし:
---
${clean}
---
`;

  try {
    const response = await generateWithRetry(prompt);
    const json = JSON.parse(response.text.trim());

    if (
      !json.summary ||
      !Array.isArray(json.key_points) ||
      !Array.isArray(json.actionItems)
    ) {
      throw new Error("不正なレスポンス形式");
    }

    return {
      summary: json.summary,
      key_points: json.key_points,
      actionItems: json.actionItems.map((item: any) => ({
        description: String(item.task ?? ""),
        owner_name: item.assignee || "未割り当て",
        due_date:
          typeof item.deadline === "string" &&
          /^\d{4}-\d{2}-\d{2}$/.test(item.deadline)
            ? item.deadline
            : null,
      })),
      participants: [],
    };
  } catch (error) {
    console.error("Gemini API エラー:", error);
    throw new Error("議事録の生成に失敗しました");
  }
};
