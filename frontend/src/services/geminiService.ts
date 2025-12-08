import { GoogleGenAI, Type } from "@google/genai";
import { GeneratedMinutes, MeetingMinutes } from '../types';
if (!process.env.API_KEY) {
  throw new Error("API_KEY環境変数が設定されていません。");
}
const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
const model = ai.models;
const minutesSchema = {
  type: Type.OBJECT,
  properties: {
    summary: {
      type: Type.STRING,
      description: '会議全体の簡潔な要約。',
    },
    key_points: {
      type: Type.ARRAY,
      description: '議論された主要なトピックや決定事項のリスト。',
      items: { type: Type.STRING },
    },
    actionItems: {
      type: Type.ARRAY,
      description: '会議から発生した具体的なタスクとその担当者、期限のリスト。',
      items: {
        type: Type.OBJECT,
        properties: {
          task: { type: Type.STRING, description: '実行すべきタスクの内容。' },
          assignee: { type: Type.STRING, description: 'タスクの担当者。不明な場合は「未割り当て」とする。' },
          deadline: { type: Type.STRING, description: "タスクの期限（可能ならYYYY-MM-DD形式）。不明な場合は '未定' とする。" },
        },
        required: ['task', 'assignee'],
      },
    },
  },
  required: ['summary', 'key_points', 'actionItems'],
};
// 簡易言語検出とクリーンアップ
function detectPrimaryLanguage(text: string): 'ja' | 'en' {
  const counts = { ja: 0, en: 0, other: 0 };
  for (const ch of text) {
    const code = ch.charCodeAt(0);
    if ((code >= 0x3040 && code <= 0x30FF) || (code >= 0x4E00 && code <= 0x9FFF)) {
      counts.ja++;
    } else if ((code >= 0x0041 && code <= 0x007A) || (code >= 0x0020 && code <= 0x007E && /[A-Za-z]/.test(ch))) {
      counts.en++;
    } else {
      counts.other++;
    }
  }
  // 日本語文字が多ければ日本語、英字が多ければ英語。どちらでもなければ日本語を優先。
  if (counts.ja >= counts.en && counts.ja > 0) return 'ja';
  if (counts.en > counts.ja && counts.en > 0) return 'en';
  return 'ja';
}
function sanitizeTranscript(text: string): string {
  // 制御文字削除・連続空白を単一スペースへ、先頭末尾トリム
  return text.replace(/[\x00-\x1F\x7F]+/g, ' ').replace(/\s+/g, ' ').trim();
}
export const generateMinutesFromText = async (transcript: string): Promise<GeneratedMinutes> => {
  const clean = sanitizeTranscript(transcript);
  const primaryLang = detectPrimaryLanguage(clean);
  const langLabel = primaryLang === 'ja' ? '日本語' : '英語';
  const prompt = `
あなたは優秀な会議アシスタントです。以下の会議の文字起こしを分析し、指定されたJSON形式で要約、主要な決定事項、およびアクションアイテムを抽出してください。
出力言語について:
- 出力は「${langLabel}」で行ってください（文字起こしの主な言語に基づいて選択済み）。
- 文字起こし内に他の言語やスクリプト（例: デーヴァナーガリー等）の断片が含まれる場合、それらは選択した出力言語に翻訳してからJSONの値として出力してください。元の断片はJSON内に残さないでください。
- JSON内の値（summary, key_points, actionItems の文字列）は上記言語で記述してください。フィールド名（キー）は既存の英語キーのままにしてください。
アクションアイテムには、担当者と期限を必ず含めてください。期限は可能な限り YYYY-MM-DD 形式で出力してください。
期限が特定できない場合は '未定' と出力してください。
文字起こし（不要な制御文字は削除済み）:
---
${clean}
---
出力は純粋なJSONのみ（余計な説明文やバッククォート等を一切含めないでください）。
`;
  try {
    const response = await model.generateContent({
      model: "gemini-2.5-flash",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: minutesSchema,
      },
    });
    const jsonString = response.text.trim();
    const parsedJson = JSON.parse(jsonString);
    // 正規化：期限が無ければ '未定'、担当者が無ければ '未割り当て' を補う
    if (
      'summary' in parsedJson &&
      'key_points' in parsedJson &&
      'actionItems' in parsedJson &&
      Array.isArray(parsedJson.actionItems)
    ) {
      const normalized: GeneratedMinutes = {
        summary: parsedJson.summary,
        key_points: parsedJson.key_points,
        actionItems: parsedJson.actionItems.map((item: any) => ({
          description: typeof item.task === 'string' ? item.task : String(item.task ?? ''),
          owner_name: typeof item.assignee === 'string' && item.assignee ? item.assignee : '未割り当て',
          due_date: typeof item.deadline === 'string' && item.deadline ? item.deadline : '未定',
        })),
        participants: [],  // 必要に応じて
    };
      return normalized as GeneratedMinutes;
    } else {
      throw new Error("APIからのレスポンス形式が正しくありません。");
    }
  } catch (error) {
    console.error("Gemini API呼び出し中にエラーが発生しました:", error);
    if (error instanceof Error) {
        throw new Error(`議事録の生成に失敗しました: ${error.message}`);
    }
    throw new Error('議事録の生成中に不明なエラーが発生しました。');
  }
};