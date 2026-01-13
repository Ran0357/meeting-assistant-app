export type AppState = 'SELECT' | 'LIVE' | 'UPLOAD' | 'RESULTS';

/* ───────────────────────────────
 * ActionItem = document_todos
 * ─────────────────────────────── */
export interface ActionItem {
  id?: string;                  // 主キー
  document_id?: string;         // 外部キー（documents.id）
  description: string;          // タスク内容
  owner_name?: string | null;   // 担当者名（AI抽出値）
  due_date?: string | null;     // YYYY-MM-DD（date型）
  slack_id?: string | null;     // 通知用（削除予定？スキーマに存在しない）

  reminder_at?: string | null;         // timestamp with time zone
  last_reminded_at?: string | null;    // timestamp with time zone
  status?: 'open' | 'in_progress' | 'done';  // デフォルト: 'open'

  // ★ 追加：データベーススキーマに存在するカラム
  slack_channel?: string | null;       // Slack通知先チャンネル
  reminded_before?: boolean;           // 前日通知済みフラグ（デフォルト: false）
  notify_before?: boolean;             // 前日通知設定フラグ（デフォルト: false）
  notified_before_at?: string | null;  // 前日通知送信日時（timestamp without time zone）

  created_at?: string;                 // timestamp with time zone
  updated_at?: string;                 // timestamp with time zone
}

/* ───────────────────────────────
 * Participant = document_participants
 * ─────────────────────────────── */
export interface Participant {
  id?: string;
  document_id?: string;         // 外部キー（documents.id）
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