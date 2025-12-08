export type AppState = 'SELECT' | 'LIVE' | 'UPLOAD' | 'RESULTS';

/* ───────────────────────────────
 * ActionItem = document_todos
 * ─────────────────────────────── */
export interface ActionItem {
  id?: string;                  // 主キー
  description: string;          // タスク内容
  owner_name?: string;          // 担当者名（AI抽出値）
  due_date?: string;            // YYYY-MM-DD
  slack_id?: string | null;     // 通知用

  reminder_at?: string | null;
  last_reminded_at?: string | null;
  status?: 'open' | 'in_progress' | 'done';
}

/* ───────────────────────────────
 * Participant = document_participants
 * ─────────────────────────────── */
export interface Participant {
  id?: string;
  name: string;                 // 表示名
  slack_id?: string | null;     // Slack通知に必要
  role?: string | null;         // PM / client / など任意
}

/* ───────────────────────────────
 * AI 生成結果（DB保存前）
 * ─────────────────────────────── */
export interface GeneratedMinutes {
  summary: string;

  key_points: string[];

  actionItems: ActionItem[];
  participants?: Participant[]; // フォームで追加する
}



/* ───────────────────────────────
 * MeetingMinutes = documents
 * ─────────────────────────────── */
export interface MeetingMinutes extends GeneratedMinutes {
  id?: string;
  user_id?: string;

  title: string;                // 保存フォームで入力必須
  meeting_date: string;         // 保存フォームで入力必須

  created_at?: string;
  updated_at?: string;
}
