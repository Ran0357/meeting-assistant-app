// src/pages/MeetingApp.tsx
import React, { useState, useCallback } from 'react';
import { AppState, MeetingMinutes } from '../types';
import SelectionScreen from '../components/SelectionScreen';
import LiveTranscriptionScreen from '../components/LiveTranscriptionScreen';
import UploadScreen from '../components/UploadScreen';
import ResultsScreen from '../components/ResultsScreen';
import { GithubIcon } from '../components/Icons';

const MeetingApp: React.FC = () => {
  const [appState, setAppState] = useState<AppState>('SELECT');
  const [minutes, setMinutes] = useState<MeetingMinutes | null>(null);
  const [error, setError] = useState<string | null>(null);

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
        <div className="text-center p-8 bg-red-100 border border-red-400 text-red-700 rounded-lg">
          <h2 className="text-2xl font-bold mb-4">エラーが発生しました</h2>
          <p className="mb-6">{error}</p>
          <button
            onClick={handleReset}
            className="bg-red-500 hover:bg-red-700 text-white font-bold py-2 px-4 rounded transition-colors"
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
      case 'RESULTS':
        return minutes ? <ResultsScreen minutes={minutes} onReset={handleReset} /> : null;
      default:
        return <div>不正な状態です。</div>;
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-4 sm:p-6 bg-slate-100 font-sans">
      <div className="w-full max-w-4xl mx-auto">
        <header className="text-center mb-8">
          <h1 className="text-4xl sm:text-5xl font-extrabold text-slate-800 tracking-tight">
            会議アシスタント
          </h1>
          <p className="mt-2 text-lg text-slate-600">
            Gemini APIによる議事録作成を体験
          </p>
        </header>
        <main className="bg-white rounded-2xl shadow-2xl p-6 sm:p-10 min-h-[400px] flex items-center justify-center">
          {renderContent()}
        </main>
        <footer className="text-center mt-8 text-slate-500">
          <p>Powered by Google Gemini API</p>
          <a
            href="https://github.com/google/genai-js"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 hover:text-slate-800 transition-colors"
          >
            <GithubIcon />
            View on GitHub
          </a>
        </footer>
      </div>
    </div>
  );
};

export default MeetingApp;
