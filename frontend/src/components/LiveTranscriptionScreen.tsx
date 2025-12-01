import React, { useState, useRef, useEffect, useCallback } from 'react';
import { MeetingMinutes } from '../types';
import { generateMinutesFromText } from '../services/geminiService';
import { Spinner } from './Spinner';
import { MicIcon, StopIcon, BackIcon } from './Icons';

interface LiveTranscriptionScreenProps {
  onMinutesGenerated: (minutes: MeetingMinutes) => void;
  onError: (error: string) => void;
  onBack: () => void;
}

const LiveTranscriptionScreen: React.FC<LiveTranscriptionScreenProps> = ({ onMinutesGenerated, onError, onBack }) => {
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [transcriptHistory, setTranscriptHistory] = useState<string[]>([]);
  const [currentTranscript, setCurrentTranscript] = useState('');

  const recognitionRef = useRef<any | null>(null);
  const lastCommittedTranscriptRef = useRef<string>('');
  const clearTimeoutRef = useRef<number | null>(null);
  // Keep a ref for the transcribing state so handlers can access the latest
  // value without stale closures.
  const transcribingRef = useRef<boolean>(false);

  const stopTranscription = useCallback(() => {
    if (recognitionRef.current) {
      try {
        recognitionRef.current.onresult = null;
        recognitionRef.current.onerror = null;
        recognitionRef.current.onend = null;
        recognitionRef.current.stop();
      } catch {}
      recognitionRef.current = null;
    }

    if (clearTimeoutRef.current) {
      clearTimeout(clearTimeoutRef.current);
      clearTimeoutRef.current = null;
    }
    transcribingRef.current = false;
    setIsTranscribing(false);
  }, []);

  const startTranscription = useCallback(() => {
    if (isTranscribing) return;
    setIsTranscribing(true);
    setTranscriptHistory([]);
    setCurrentTranscript('');
    lastCommittedTranscriptRef.current = '';

    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      onError('このブラウザは Web Speech API をサポートしていません。');
      setIsTranscribing(false);
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.lang = 'ja-JP';
    recognition.interimResults = true;
    recognition.continuous = true;

    recognition.onresult = (event: any) => {
      let interim = '';
      let finalText = '';
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const res = event.results[i];
        if (res.isFinal) {
          finalText += res[0].transcript;
        } else {
          interim += res[0].transcript;
        }
      }

      if (finalText.trim()) {
        const finalTrim = finalText.trim();
        setTranscriptHistory(prev => {
          if (prev.length > 0 && prev[prev.length - 1] === finalTrim) return prev;
          return [...prev, finalTrim];
        });
        lastCommittedTranscriptRef.current = finalTrim;
        setCurrentTranscript('');
      } else {
        setCurrentTranscript(interim);
      }
    };

    recognition.onerror = (e: any) => {
      console.error('SpeechRecognition error', e);
      onError(`音声認識エラー: ${e.error || e.message || '不明なエラー'}`);
      stopTranscription();
    };

    recognition.onend = () => {
      // The Web Speech API sometimes stops after a few final results.
      // If the user is still in transcribing mode, restart recognition to
      // provide continuous listening.
      recognitionRef.current = null;
      if (transcribingRef.current) {
        try {
          // slight delay helps avoid quick stop/start thrash
          setTimeout(() => {
            try { recognition.start(); recognitionRef.current = recognition; } catch (e) { console.warn('restart failed', e); }
          }, 200);
        } catch (e) {
          console.warn('failed to restart recognition', e);
          transcribingRef.current = false;
          setIsTranscribing(false);
        }
      } else {
        setIsTranscribing(false);
      }
    };

    try {
      recognition.start();
      recognitionRef.current = recognition;
      transcribingRef.current = true;
    } catch (e) {
      onError('音声認識を開始できませんでした。マイクの許可を確認してください。');
      transcribingRef.current = false;
      setIsTranscribing(false);
    }
  }, [isTranscribing, onError, stopTranscription]);

  const handleGenerateMinutes = async () => {
    setIsLoading(true);
    const fullTranscript = [...transcriptHistory, currentTranscript].join(' ').trim();
    if (!fullTranscript) {
      onError('議事録を生成するための文字起こしがありません。');
      setIsLoading(false);
      return;
    }
    try {
      const minutes = await generateMinutesFromText(fullTranscript);
      onMinutesGenerated(minutes);
    } catch (error) {
      if (error instanceof Error) {
        onError(error.message);
      } else {
        onError('不明なエラーが発生しました。');
      }
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    return () => {
      stopTranscription();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="w-full flex flex-col items-center">
      <h2 className="text-2xl font-bold text-center mb-4">リアルタイム文字起こし</h2>
      <div className="w-full h-64 bg-slate-100 rounded-lg p-4 overflow-y-auto mb-6 border border-slate-200">
        {transcriptHistory.map((line, index) => (
          <p key={index} className="text-slate-600">{line}</p>
        ))}
        <p className="text-slate-800 font-medium">{currentTranscript}</p>
      </div>

      <div className="flex items-center space-x-4">
        <button onClick={onBack} className="p-3 bg-slate-200 rounded-full hover:bg-slate-300 transition-colors" aria-label="戻る">
          <BackIcon />
        </button>
        {!isTranscribing ? (
          <button onClick={startTranscription} disabled={isLoading} className="flex items-center justify-center w-40 h-16 bg-blue-500 text-white rounded-full text-lg font-semibold shadow-lg hover:bg-blue-600 transition-transform transform hover:scale-105 disabled:bg-slate-400">
            <MicIcon className="mr-2" />
            <span>開始</span>
          </button>
        ) : (
          <button onClick={stopTranscription} disabled={isLoading} className="flex items-center justify-center w-40 h-16 bg-red-500 text-white rounded-full text-lg font-semibold shadow-lg hover:bg-red-600 transition-transform transform hover:scale-105 disabled:bg-slate-400">
            <StopIcon className="mr-2"/>
            <span>停止</span>
          </button>
        )}
        <button onClick={handleGenerateMinutes} disabled={isTranscribing || isLoading} className="h-16 px-6 bg-green-500 text-white rounded-full text-lg font-semibold shadow-lg hover:bg-green-600 disabled:bg-slate-400 disabled:cursor-not-allowed transition-colors flex items-center">
          {isLoading ? <><Spinner /> <span className="ml-2">生成中...</span></> : '議事録を生成'}
        </button>
      </div>
    </div>
  );
};

export default LiveTranscriptionScreen;