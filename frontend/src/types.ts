
export type AppState = 'SELECT' | 'LIVE' | 'UPLOAD' | 'RESULTS';

export interface ActionItem {
  task: string;
  assignee: string;
}

export interface MeetingMinutes {
  summary: string;
  keyPoints: string[];
  actionItems: ActionItem[];
}
