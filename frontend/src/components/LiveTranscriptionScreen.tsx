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

/* ===============================
   Watchdog 設定
================================ */
const WATCHDOG_INTERVAL_MS = 1000;
const WATCHDOG_SILENCE_LIMIT = 5000; // 無音時
const WATCHDOG_SPEECH_LIMIT = 9000;  // 発話中（緩め）

const LiveTranscriptionScreen: React.FC<LiveTranscriptionScreenProps> = ({
  onMinutesGenerated,
  onError,
  onBack,
}) => {
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [transcriptHistory, setTranscriptHistory] = useState<string[]>([]);
  const [currentTranscript, setCurrentTranscript] = useState('');

  const recognitionRef = useRef<any | null>(null);
  const watchdogRef = useRef<number | null>(null);

  const runningRef = useRef(false);          // 全体ON/OFF
  const speakingRef = useRef(false);         // 発話中フラグ
  const lastSoundAtRef = useRef(Date.now()); // 最終音声検知時刻


  /* ===============================
     SpeechRecognition 生成
  =============================== */
  const createRecognition = useCallback(() => {
    const SpeechRecognition =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

    const recognition = new SpeechRecognition();
    recognition.lang = 'ja-JP';
    recognition.interimResults = true;
    recognition.continuous = true;

    recognition.onresult = (event: any) => {
      lastSoundAtRef.current = Date.now();

      let interim = '';
      let finalText = '';

      for (let i = event.resultIndex; i < event.results.length; i++) {
        const res = event.results[i];

        if (res.isFinal) {
          finalText += res[0].transcript;
        } else {
          interim += res[0].transcript;
          speakingRef.current = true; // 発話中
        }
      }

      if (finalText.trim()) {
        setTranscriptHistory(prev => [...prev, finalText.trim()]);
        setCurrentTranscript('');
        speakingRef.current = false; // 発話確定
      } else {
        setCurrentTranscript(interim);
      }
    };

    recognition.onend = () => {
      recognitionRef.current = null;
      speakingRef.current = false;

      if (runningRef.current) {
        setTimeout(startRecognitionLoop, 200);
      }
    };

    recognition.onerror = (e: any) => {
      console.warn('SpeechRecognition error', e);
      recognitionRef.current = null;
      speakingRef.current = false;

      if (runningRef.current) {
        setTimeout(startRecognitionLoop, 300);
      }
    };

    return recognition;
  }, []);

  /* ===============================
     認識ループ
  =============================== */
  const startRecognitionLoop = useCallback(() => {
    if (!runningRef.current) return;

    try {
      const recognition = createRecognition();
      recognitionRef.current = recognition;
      recognition.start();
    } catch (e) {
      console.warn('recognition.start failed', e);
    }
  }, [createRecognition]);

  /* ===============================
     Watchdog（ゾンビ対策）
  =============================== */
  const startWatchdog = useCallback(() => {
    if (watchdogRef.current) {
      clearInterval(watchdogRef.current);
    }

    watchdogRef.current = window.setInterval(() => {
      if (!runningRef.current) return;

      const diff = Date.now() - lastSoundAtRef.current;
      const limit = speakingRef.current
        ? WATCHDOG_SPEECH_LIMIT
        : WATCHDOG_SILENCE_LIMIT;

      if (diff > limit) {
        console.warn('watchdog: force restart');

        if (recognitionRef.current) {
          try {
            recognitionRef.current.onend = null;
            recognitionRef.current.onerror = null;
            recognitionRef.current.stop();
          } catch {}
          recognitionRef.current = null;
        }

        speakingRef.current = false;
        lastSoundAtRef.current = Date.now();
        startRecognitionLoop();
      }
    }, WATCHDOG_INTERVAL_MS);
  }, [startRecognitionLoop]);

  /* ===============================
     開始
  =============================== */
  const startTranscription = useCallback(() => {
    if (runningRef.current) return;

    setTranscriptHistory([]);
    setCurrentTranscript('');
    setIsTranscribing(true);

    runningRef.current = true;
    speakingRef.current = false;
    lastSoundAtRef.current = Date.now();

    startWatchdog();
    startRecognitionLoop();
  }, [startRecognitionLoop, startWatchdog]);

  /* ===============================
     停止
  =============================== */
  const stopTranscription = useCallback(() => {
    runningRef.current = false;
    speakingRef.current = false;
    setIsTranscribing(false);

    if (watchdogRef.current) {
      clearInterval(watchdogRef.current);
      watchdogRef.current = null;
    }

    if (recognitionRef.current) {
      recognitionRef.current.onend = null;
      recognitionRef.current.onerror = null;
      recognitionRef.current.stop();
      recognitionRef.current = null;
    }
  }, []);

  /* ===============================
     議事録生成
  =============================== */
  const handleGenerateMinutes = async () => {
    setIsLoading(true);

    const fullTranscript = [...transcriptHistory, currentTranscript]
      .join(' ')
      .trim();

    if (!fullTranscript) {
      onError('議事録を生成するための文字起こしがありません。');
      setIsLoading(false);
      return;
    }

    try {
      const generated = await generateMinutesFromText(fullTranscript);

      const minutes: MeetingMinutes = {
        title: '会議議事録',
        meeting_date: new Date().toISOString().slice(0, 10),
        ...generated,
      };

      onMinutesGenerated(minutes);
    } catch (e: any) {
      onError(e?.message || '不明なエラーが発生しました。');
    } finally {
      setIsLoading(false);
    }
  };

  /* ===============================
     unmount cleanup
  =============================== */
  useEffect(() => {
    return () => stopTranscription();
  }, [stopTranscription]);


  /* ===============================
     UI - メイン画面
  =============================== */
  return (
    <div className="w-full flex flex-col items-center">
      <h2 className="text-2xl font-bold mb-4">リアルタイム文字起こし</h2>

      <div className="w-full h-64 bg-slate-100 rounded-lg p-4 overflow-y-auto mb-6 border">
        {transcriptHistory.map((line, i) => (
          <p key={i} className="text-slate-600">{line}</p>
        ))}
        <p className="text-slate-800 font-medium">{currentTranscript}</p>
      </div>

      <div className="flex items-center space-x-4">
        <button onClick={onBack} className="p-3 bg-slate-200 rounded-full hover:bg-slate-300 transition-colors">
          <BackIcon />
        </button>

        {!isTranscribing ? (
          <button
            onClick={startTranscription}
            className="w-40 h-16 bg-blue-500 text-white rounded-full flex items-center justify-center hover:bg-blue-600 transition-colors"
          >
            <MicIcon className="mr-2" /> 開始
          </button>
        ) : (
          <button
            onClick={stopTranscription}
            className="w-40 h-16 bg-red-500 text-white rounded-full flex items-center justify-center hover:bg-red-600 transition-colors"
          >
            <StopIcon className="mr-2" /> 停止
          </button>
        )}

        <button
          onClick={handleGenerateMinutes}
          disabled={isTranscribing || isLoading}
          className="h-16 px-6 bg-green-500 text-white rounded-full hover:bg-green-600 disabled:bg-slate-400 disabled:cursor-not-allowed transition-colors"
        >
          {isLoading ? <><Spinner /> 生成中…</> : '議事録を生成'}
        </button>
      </div>
    </div>
  );
};

export default LiveTranscriptionScreen;
