import React, { useState, useRef, useEffect, useCallback } from 'react';
import { MeetingMinutes } from '../types';
import { generateMinutes } from '../api/minutes';
import { Spinner } from './Spinner';
import { MicIcon, StopIcon, BackIcon } from './Icons';

interface LiveTranscriptionScreenProps {
  onMinutesGenerated: (minutes: MeetingMinutes) => void;
  onError: (error: string) => void;
  onBack: () => void;
}

/* ===============================
   安定化パラメータ
================================ */
const WATCHDOG_INTERVAL_MS = 1000;
const WATCHDOG_SILENCE_LIMIT = 15000;
const WATCHDOG_SPEECH_LIMIT = 25000;
const SILENCE_COMMIT_MS = 900;

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
  const silenceTimerRef = useRef<number | null>(null);

  const runningRef = useRef(false);
  const startingRef = useRef(false);
  const stoppingRef = useRef(false);
  const speakingRef = useRef(false);
  const lastSoundAtRef = useRef(Date.now());

  const bufferRef = useRef('');

  /* ===============================
     Recognition生成
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
      speakingRef.current = true;

      let interim = '';
      let finalText = '';

      for (let i = event.resultIndex; i < event.results.length; i++) {
        const res = event.results[i];
        if (res.isFinal) finalText += res[0].transcript;
        else interim += res[0].transcript;
      }

      if (finalText) bufferRef.current += finalText;

      setCurrentTranscript(bufferRef.current + interim);

      if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);

      silenceTimerRef.current = window.setTimeout(() => {
        if (bufferRef.current.trim()) {
          setTranscriptHistory(prev => [...prev, bufferRef.current.trim()]);
          bufferRef.current = '';
          setCurrentTranscript('');
        }
        speakingRef.current = false;
      }, SILENCE_COMMIT_MS);
    };

    recognition.onend = () => {
      recognitionRef.current = null;
      speakingRef.current = false;

      if (!runningRef.current || stoppingRef.current) return;

      setTimeout(() => startRecognitionLoop(), 700);
    };

    recognition.onerror = () => {
      recognitionRef.current = null;
      speakingRef.current = false;

      if (!runningRef.current || stoppingRef.current) return;

      setTimeout(() => startRecognitionLoop(), 1000);
    };

    return recognition;
  }, []);

  /* ===============================
     Recognition Loop
  =============================== */
  const startRecognitionLoop = useCallback(() => {
    if (!runningRef.current) return;
    if (startingRef.current) return;

    startingRef.current = true;

    try {
      const recognition = createRecognition();
      recognitionRef.current = recognition;
      recognition.start();
    } catch (e) {
      console.warn('recognition.start failed', e);
    } finally {
      setTimeout(() => {
        startingRef.current = false;
      }, 600);
    }
  }, [createRecognition]);

  /* ===============================
     Watchdog
  =============================== */
  const startWatchdog = useCallback(() => {
    if (watchdogRef.current) clearInterval(watchdogRef.current);

    watchdogRef.current = window.setInterval(() => {
      if (!runningRef.current) return;

      const diff = Date.now() - lastSoundAtRef.current;
      const limit = speakingRef.current
        ? WATCHDOG_SPEECH_LIMIT
        : WATCHDOG_SILENCE_LIMIT;

      if (diff > limit) {
        try {
          recognitionRef.current?.stop();
        } catch {}

        recognitionRef.current = null;
        speakingRef.current = false;
        lastSoundAtRef.current = Date.now();

        startRecognitionLoop();
      }
    }, WATCHDOG_INTERVAL_MS);
  }, [startRecognitionLoop]);

  /* ===============================
     Start
  =============================== */
  const startTranscription = useCallback(() => {
    if (runningRef.current) return;

    runningRef.current = true;
    stoppingRef.current = false;
    speakingRef.current = false;
    lastSoundAtRef.current = Date.now();
    bufferRef.current = '';

    setTranscriptHistory([]);
    setCurrentTranscript('');
    setIsTranscribing(true);

    startWatchdog();
    startRecognitionLoop();
  }, [startRecognitionLoop, startWatchdog]);

  /* ===============================
     Stop
  =============================== */
  const stopTranscription = useCallback(() => {
    stoppingRef.current = true;
    runningRef.current = false;
    speakingRef.current = false;

    setIsTranscribing(false);

    if (silenceTimerRef.current) {
      clearTimeout(silenceTimerRef.current);
      silenceTimerRef.current = null;
    }

    if (watchdogRef.current) {
      clearInterval(watchdogRef.current);
      watchdogRef.current = null;
    }

    try {
      recognitionRef.current?.stop();
    } catch {}

    recognitionRef.current = null;

    setTimeout(() => {
      stoppingRef.current = false;
    }, 1000);
  }, []);

  /* ===============================
     議事録生成
  =============================== */
  const handleGenerateMinutes = async () => {
    setIsLoading(true);

    const fullTranscript = [...transcriptHistory, bufferRef.current]
      .join(' ')
      .trim();

    if (!fullTranscript) {
      onError('文字起こしがありません。');
      setIsLoading(false);
      return;
    }

    try {
      const generated = await generateMinutes(fullTranscript);

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

  useEffect(() => {
    return () => stopTranscription();
  }, [stopTranscription]);

  /* ===============================
     UI
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

      <p className="text-sm text-slate-500 mb-3">
        {isTranscribing ? '🎤 マイク入力中...' : '⏹ 停止中'}
      </p>

      <div className="flex items-center space-x-4">
        <button onClick={onBack} className="p-3 bg-slate-200 rounded-full hover:bg-slate-300">
          <BackIcon />
        </button>

        {!isTranscribing ? (
          <button
            onClick={startTranscription}
            className="w-40 h-16 bg-blue-500 text-white rounded-full flex items-center justify-center hover:bg-blue-600">
            <MicIcon className="mr-2" /> 開始
          </button>
        ) : (
          <button
            onClick={stopTranscription}
            className="w-40 h-16 bg-red-500 text-white rounded-full flex items-center justify-center hover:bg-red-600">
            <StopIcon className="mr-2" /> 停止
          </button>
        )}

        <button
          onClick={handleGenerateMinutes}
          disabled={isTranscribing || isLoading}
          className="h-16 px-6 bg-green-500 text-white rounded-full hover:bg-green-600 disabled:bg-slate-400">
          {isLoading ? <><Spinner /> 生成中…</> : '議事録を生成'}
        </button>
      </div>
    </div>
  );
};

export default LiveTranscriptionScreen;
