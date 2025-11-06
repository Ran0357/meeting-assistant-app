
import { GoogleGenAI, Type } from "@google/genai";
import { MeetingMinutes } from '../types';

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
    keyPoints: {
      type: Type.ARRAY,
      description: '議論された主要なトピックや決定事項のリスト。',
      items: { type: Type.STRING },
    },
    actionItems: {
      type: Type.ARRAY,
      description: '会議から発生した具体的なタスクとその担当者のリスト。',
      items: {
        type: Type.OBJECT,
        properties: {
          task: { type: Type.STRING, description: '実行すべきタスクの内容。' },
          assignee: { type: Type.STRING, description: 'タスクの担当者。不明な場合は「未割り当て」とする。' },
        },
        required: ['task', 'assignee'],
      },
    },
  },
  required: ['summary', 'keyPoints', 'actionItems'],
};

export const generateMinutesFromText = async (transcript: string): Promise<MeetingMinutes> => {
  const prompt = `
あなたは優秀な会議アシスタントです。以下の会議の文字起こしを分析し、指定されたJSON形式で要約、主要な決定事項、およびアクションアイテムを抽出してください。

アクションアイテムには、担当者も特定してください。担当者が不明な場合は '未割り当て' としてください。

文字起こし:
---
${transcript}
---
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

    // 型ガード
    if (
      'summary' in parsedJson &&
      'keyPoints' in parsedJson &&
      'actionItems' in parsedJson
    ) {
      return parsedJson as MeetingMinutes;
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
