import React, { useState, useEffect, useCallback } from 'react';
import { MeetingMinutes } from '../types';
import { fetchDocumentsList, fetchDocumentDetail } from '../services/documentsService';
import { Spinner } from './Spinner';
import { BackIcon } from './Icons';

interface PastDocumentsScreenProps {
  onBack: () => void;
  onSelectDocument?: (minutes: MeetingMinutes) => void;
}

interface PastDocument {
  id?: string;
  title: string;
  meeting_date: string;
  summary: string;
  created_at?: string;
}

const PastDocumentsScreen: React.FC<PastDocumentsScreenProps> = ({ onBack, onSelectDocument }) => {
  const [pastDocuments, setPastDocuments] = useState<PastDocument[]>([]);
  const [selectedDocument, setSelectedDocument] = useState<MeetingMinutes | null>(null);
  const [loadingDocuments, setLoadingDocuments] = useState(true);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // 過去議事録一覧を取得
  useEffect(() => {
    const loadPastDocuments = async () => {
      setLoadingDocuments(true);
      setError(null);
      try {
        const token = localStorage.getItem('access_token');
        if (!token) {
          throw new Error('アクセストークンが見つかりません。');
        }

        const docs = await fetchDocumentsList(token);
        setPastDocuments(docs);
      } catch (err: any) {
        setError(`過去の議事録の取得に失敗しました: ${err.message}`);
      } finally {
        setLoadingDocuments(false);
      }
    };

    loadPastDocuments();
  }, []);

  // 過去議事録の詳細を取得
  const loadDocumentDetail = useCallback(async (docId: string) => {
    setLoadingDetail(true);
    setError(null);
    try {
      const token = localStorage.getItem('access_token');
      if (!token) {
        throw new Error('アクセストークンが見つかりません。');
      }

      const doc = await fetchDocumentDetail(token, docId);
      setSelectedDocument(doc);
    } catch (err: any) {
      setError(`議事録の詳細取得に失敗しました: ${err.message}`);
    } finally {
      setLoadingDetail(false);
    }
  }, []);

  // 議事録詳細画面
  if (selectedDocument) {
    return (
      <div className="w-full flex flex-col items-center">
        <div className="w-full mb-4 flex items-center gap-2">
          <button
            onClick={() => setSelectedDocument(null)}
            className="p-2 bg-slate-200 rounded-full hover:bg-slate-300 transition-colors"
          >
            <BackIcon />
          </button>
          <span className="text-sm text-gray-600">議事録一覧に戻る</span>
        </div>

        <h2 className="text-3xl font-bold mb-2">{selectedDocument.title}</h2>
        <p className="text-sm text-slate-500 mb-6">
          {new Date(selectedDocument.meeting_date).toLocaleDateString('ja-JP')}
        </p>

        <div className="w-full space-y-6">
          {/* 要約 */}
          <div>
            <h3 className="text-xl font-semibold mb-2 border-b-2 border-blue-500 pb-2">要約</h3>
            <p className="text-slate-700 whitespace-pre-wrap">{selectedDocument.summary}</p>
          </div>

          {/* 決定事項 */}
          <div>
            <h3 className="text-xl font-semibold mb-2 border-b-2 border-green-500 pb-2">主要な決定事項</h3>
            {selectedDocument.key_points && selectedDocument.key_points.length > 0 ? (
              <ul className="list-disc list-inside space-y-1">
                {selectedDocument.key_points.map((point, i) => (
                  <li key={i} className="text-slate-700">{point}</li>
                ))}
              </ul>
            ) : (
              <p className="text-slate-500">なし</p>
            )}
          </div>

          {/* アクションアイテム */}
          {selectedDocument.actionItems && selectedDocument.actionItems.length > 0 && (
            <div>
              <h3 className="text-xl font-semibold mb-2 border-b-2 border-yellow-500 pb-2">アクションアイテム</h3>
              <div className="space-y-2">
                {selectedDocument.actionItems.map((item, i) => (
                  <div key={i} className="p-3 bg-slate-50 rounded-md border">
                    <p className="font-medium">{item.description}</p>
                    <p className="text-sm text-slate-600">
                      担当: {item.owner_name || '未割り当て'} | 期限: {item.due_date || '未定'}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 参加者 */}
          {selectedDocument.participants && selectedDocument.participants.length > 0 && (
            <div>
              <h3 className="text-xl font-semibold mb-2 border-b-2 border-indigo-500 pb-2">参加者</h3>
              <div className="flex flex-wrap gap-2">
                {selectedDocument.participants.map((p, i) => (
                  <span key={i} className="px-3 py-1 bg-indigo-100 text-indigo-800 rounded-full text-sm">
                    {p.name} {p.role && `(${p.role})`}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="mt-8 flex gap-4">
          <button
            onClick={() => setSelectedDocument(null)}
            className="px-6 py-3 rounded-full bg-slate-500 text-white hover:bg-slate-600 transition-colors"
          >
            一覧に戻る
          </button>
          {onSelectDocument && selectedDocument && (
            <button
              onClick={() => {
                onSelectDocument(selectedDocument);
              }}
              className="px-6 py-3 rounded-full bg-blue-500 text-white hover:bg-blue-600 transition-colors"
            >
              この議事録を編集
            </button>
          )}
        </div>
      </div>
    );
  }

  // 過去議事録一覧画面
  return (
    <div className="w-full flex flex-col items-center">
      <div className="w-full mb-4 flex items-center gap-2">
        <button
          onClick={onBack}
          className="p-2 bg-slate-200 rounded-full hover:bg-slate-300 transition-colors"
        >
          <BackIcon />
        </button>
        <span className="text-sm text-gray-600">機能選択画面に戻る</span>
      </div>

      <h2 className="text-3xl font-bold text-center mb-8">過去の議事録</h2>

      {error && (
        <div className="w-full mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
          <p className="text-red-800">{error}</p>
        </div>
      )}

      {loadingDocuments ? (
        <div className="flex flex-col items-center justify-center py-12">
          <Spinner />
          <p className="text-slate-500 mt-4">議事録を読み込み中...</p>
        </div>
      ) : pastDocuments.length === 0 ? (
        <div className="w-full text-center py-12">
          <p className="text-slate-500 text-lg mb-4">過去の議事録はまだありません</p>
          <button
            onClick={onBack}
            className="px-6 py-3 rounded-full bg-blue-500 text-white hover:bg-blue-600 transition-colors"
          >
            最初に戻る
          </button>
        </div>
      ) : (
        <div className="w-full space-y-3 mb-8">
          {pastDocuments.map((doc) => (
            <button
              key={doc.id}
              onClick={() => loadDocumentDetail(doc.id)}
              disabled={loadingDetail}
              className="w-full p-4 text-left bg-white border border-slate-300 rounded-lg hover:border-blue-500 hover:shadow-md transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <div className="flex justify-between items-start mb-2">
                <h3 className="font-semibold text-lg text-slate-800">{doc.title}</h3>
                {loadingDetail && (
                  <Spinner />
                )}
              </div>
              <p className="text-sm text-slate-600 mb-2">
                📅 {new Date(doc.meeting_date).toLocaleDateString('ja-JP')}
              </p>
              <p className="text-sm text-slate-600 line-clamp-2">{doc.summary}</p>
            </button>
          ))}
        </div>
      )}

      <button
        onClick={onBack}
        className="px-6 py-3 rounded-full bg-slate-500 text-white hover:bg-slate-600 transition-colors"
      >
        機能選択画面に戻る
      </button>
    </div>
  );
};

export default PastDocumentsScreen;
