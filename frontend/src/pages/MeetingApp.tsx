// src/pages/MeetingApp.tsx
import React, { useState, useCallback } from 'react';
import { AppState, MeetingMinutes } from '../types';
import SelectionScreen from '../components/SelectionScreen';
import LiveTranscriptionScreen from '../components/LiveTranscriptionScreen';
import UploadScreen from '../components/UploadScreen';
import ResultsScreen from '../components/ResultsScreen';
import PastDocumentsScreen from '../components/PastDocumentsScreen';
import { GithubIcon } from '../components/Icons';

const MeetingApp: React.FC = () => {
  const [appState, setAppState] = useState<AppState>('SELECT');
  const [minutes, setMinutes] = useState<MeetingMinutes | null>(null);
  const [error, setError] = useState<string | null>(null);

  const API_BASE_URL = import.meta.env.VITE_API_BASE_URL;

  const handleLogout = async () => {
    const token = localStorage.getItem('access_token');
    try {
      if (token) {
        await fetch(`${API_BASE_URL}/api/auth/logout`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
        });
      }
    } catch (err) {
      console.error('Logout error:', err);
    } finally {
      localStorage.removeItem('access_token');
      window.location.href = '/login';
    }
  };

  const handleMinutesGenerated = useCallback((generatedMinutes: MeetingMinutes) => {
    setMinutes(generatedMinutes);
    setAppState('RESULTS');
    setError(null);
  }, []);

  const handleReset = useCallback(() => {
    setAppState('SELECT');
    setMinutes(null);
    setError(null);
  }, []);

  const handleBack = useCallback(() => {
    setAppState('SELECT');
    setError(null);
  }, []);

  const renderContent = () => {
    if (error) {
      return (
        <div className="text-center p-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-red-100 rounded-full mb-4">
            <svg className="w-8 h-8 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </div>
          <h3 className="text-lg font-semibold text-gray-900 mb-2">エラーが発生しました</h3>
          <p className="text-sm text-gray-600 mb-6">{error}</p>
          <button
            onClick={handleReset}
            className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-md transition-colors"
          >
            最初に戻る
          </button>
        </div>
      );
    }

    switch (appState) {
      case 'SELECT':
        return (
          <SelectionScreen
            onSelectLive={() => setAppState('LIVE')}
            onSelectUpload={() => setAppState('UPLOAD')}
            onSelectViewPastDocuments={() => setAppState('PAST_DOCUMENTS')}
          />
        );
      case 'LIVE':
        return (
          <LiveTranscriptionScreen
            onMinutesGenerated={handleMinutesGenerated}
            onError={setError}
            onBack={handleBack}
          />
        );
      case 'UPLOAD':
        return (
          <UploadScreen
            onMinutesGenerated={handleMinutesGenerated}
            onError={setError}
            onBack={handleBack}
          />
        );
      case 'PAST_DOCUMENTS':
        return (
          <PastDocumentsScreen
            onBack={handleBack}
            onSelectDocument={(doc) => {
              setMinutes(doc);
              setAppState('RESULTS');
            }}
          />
        );
      case 'RESULTS':
        return minutes ? <ResultsScreen minutes={minutes} onReset={handleReset} /> : null;
      default:
        return <div>不正な状態です。</div>;
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-gray-50">
      {/* ヘッダーバー */}
      <header className="bg-white border-b border-gray-200 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center">
              <h1 className="text-xl font-semibold text-gray-900">
                会議アシスタントシステム
              </h1>
              <span className="ml-4 px-3 py-1 text-xs font-medium bg-blue-100 text-blue-800 rounded-full">
                Gemini API
              </span>
            </div>
            <div className="flex items-center gap-4">
              <span className="text-sm text-gray-600">
                {new Date().toLocaleDateString('ja-JP', { year: 'numeric', month: 'long', day: 'numeric' })}
              </span>
              <button
                onClick={handleLogout}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 transition-colors"
              >
                ログアウト
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* メインコンテンツ */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="bg-white rounded-lg shadow border border-gray-200">
          <div className="px-6 py-4 border-b border-gray-200">
            <h2 className="text-lg font-medium text-gray-900">
              {appState === 'SELECT' && '機能選択'}
              {appState === 'LIVE' && 'リアルタイム文字起こし'}
              {appState === 'UPLOAD' && 'ファイルアップロード'}
              {appState === 'PAST_DOCUMENTS' && '過去の議事録'}
              {appState === 'RESULTS' && '議事録結果'}
            </h2>
          </div>
          <div className="p-6 min-h-[500px]">
            {renderContent()}
          </div>
        </div>
      </main>

      {/* フッター */}
      <footer className="bg-white border-t border-gray-200 mt-auto">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex justify-between items-center text-sm text-gray-500">
            <p>© 2026 会議アシスタントシステム. All rights reserved.</p>
            <a
              href="https://github.com/google/genai-js"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 hover:text-gray-700 transition-colors"
            >
              <GithubIcon />
              GitHub
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default MeetingApp;
