import { MeetingMinutes } from '../types';

/**
 * 過去の議事録一覧を取得
 */
export const fetchDocumentsList = async (token: string): Promise<MeetingMinutes[]> => {
  try {
    const response = await fetch('/api/documents', {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch documents: ${response.statusText}`);
    }

    const data = await response.json();
    return data.documents || [];
  } catch (error) {
    console.error('Error fetching documents:', error);
    throw error;
  }
};

/**
 * 指定された議事録の詳細情報を取得
 */
export const fetchDocumentDetail = async (token: string, documentId: string): Promise<MeetingMinutes> => {
  try {
    const response = await fetch(`/api/documents/${documentId}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch document detail: ${response.statusText}`);
    }

    const data = await response.json();
    return data as MeetingMinutes;
  } catch (error) {
    console.error('Error fetching document detail:', error);
    throw error;
  }
};
