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
const WATCHDOG_INTERVAL_MS = 2000; // 2秒ごとにチェック（負荷軽減）
const WATCHDOG_SILENCE_LIMIT = 60000; // 無音60秒まで許容（会議の沈黙に対応）
const WATCHDOG_SPEECH_LIMIT = 60000; // 発話中も60秒まで許容
const SILENCE_COMMIT_MS = 3000; // 無音で3秒後に履歴化（少し長めに）
const AUTO_SAVE_INTERVAL_MS = 15000; // 15秒ごとに保存

const LiveTranscriptionScreen: React.FC<LiveTranscriptionScreenProps> = ({
  onMinutesGenerated,
  onError,
  onBack,
}) => {
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [micPermission, setMicPermission] = useState<'granted' | 'denied' | 'prompt'>('prompt');
  const [transcriptHistory, setTranscriptHistory] = useState<string[]>([]);
  const [currentTranscript, setCurrentTranscript] = useState('');
  const [isRecovering, setIsRecovering] = useState(false);

  const recognitionRef = useRef<any | null>(null);
  const watchdogRef = useRef<number | null>(null);
  const silenceTimerRef = useRef<number | null>(null);
  const autoSaveRef = useRef<number | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);

  const runningRef = useRef(false);
  const startingRef = useRef(false);
  const stoppingRef = useRef(false);
  const speakingRef = useRef(false);
  const handlingErrorRef = useRef(false); // エラー処理中のフラグ
  const lastSoundAtRef = useRef(Date.now());
  const bufferRef = useRef('');
  const restartCountRef = useRef(0); // 短時間での再起動回数
  const lastRestartAtRef = useRef(0); // 最後の再起動時刻

  /* ===============================
     ローカルストレージへの自動保存
  =============================== */
  const STORAGE_KEY = 'transcription_history';
  const STORAGE_TIMESTAMP_KEY = 'transcription_timestamp';

  // 履歴をローカルストレージに保存
  const saveToLocalStorage = useCallback((history: string[]) => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(history));
      localStorage.setItem(STORAGE_TIMESTAMP_KEY, Date.now().toString());
      console.log('Saved to localStorage:', history.length, 'items');
    } catch (e) {
      console.error('Failed to save to localStorage:', e);
    }
  }, []);

  // ローカルストレージから履歴を復元
  const loadFromLocalStorage = useCallback(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      const timestamp = localStorage.getItem(STORAGE_TIMESTAMP_KEY);
      
      if (saved && timestamp) {
        const history = JSON.parse(saved);
        const savedTime = parseInt(timestamp);
        const hoursSinceLastSave = (Date.now() - savedTime) / (1000 * 60 * 60);
        
        // 24時間以内のデータのみ復元提案
        if (hoursSinceLastSave < 24 && Array.isArray(history) && history.length > 0) {
          console.log('Found saved data:', history.length, 'items');
          return { history, hoursSinceLastSave };
        }
      }
    } catch (e) {
      console.error('Failed to load from localStorage:', e);
    }
    return null;
  }, []);

  // ローカルストレージをクリア
  const clearLocalStorage = useCallback(() => {
    try {
      localStorage.removeItem(STORAGE_KEY);
      localStorage.removeItem(STORAGE_TIMESTAMP_KEY);
      console.log('Cleared localStorage');
    } catch (e) {
      console.error('Failed to clear localStorage:', e);
    }
  }, []);

  // 復元データを適用
  const applyRecoveredData = useCallback((history: string[]) => {
    setTranscriptHistory(history);
    setIsRecovering(false);
    clearLocalStorage();
  }, [clearLocalStorage]);

  /* ===============================
     マイク許可の確認と取得
  =============================== */
  const checkMicPermission = useCallback(async () => {
    try {
      // マイク入力の許可を取得
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      // 許可確認後すぐに停止（SpeechRecognition APIが独自にマイクアクセスを管理するため）
      stream.getTracks().forEach(track => track.stop());
      mediaStreamRef.current = null;
      
      setMicPermission('granted');
      console.log('Microphone permission granted');
      return true;
    } catch (error: any) {
      console.error('マイク許可エラー:', error);
      setMicPermission('denied');
      onError('マイクへのアクセスが拒否されました。ブラウザの設定を確認してください。');
      return false;
    }
  }, [onError]);

  /* ===============================
     Recognition生成
  =============================== */
  const createRecognition = useCallback(() => {
    const SpeechRecognition =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) throw new Error('ブラウザがSpeechRecognitionに対応していません');

    const recognition = new SpeechRecognition();
    recognition.lang = 'ja-JP';
    recognition.interimResults = true;
    recognition.continuous = true;
    recognition.maxAlternatives = 1; // パフォーマンス向上

    recognition.onstart = () => {
      console.log('Recognition started');
      startingRef.current = false;
      // 正常に開始できたらカウントをリセット
      restartCountRef.current = 0;
      lastRestartAtRef.current = Date.now();
    };

    recognition.onresult = (event: any) => {
      // 停止中は結果を無視
      if (stoppingRef.current || !runningRef.current) return;

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

      // 無音で自動履歴化
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
      console.log('Recognition ended');
      recognitionRef.current = null;
      speakingRef.current = false;

      // エラー処理中の場合は再起動しない（onerrorに任せる）
      if (handlingErrorRef.current) {
        console.log('Not restarting: error handler will restart');
        return;
      }

      // 停止中または実行中でない場合は再起動しない（重要！）
      if (stoppingRef.current || !runningRef.current) {
        console.log('Not restarting: stopping or not running');
        return;
      }

      // 短時間での連続再起動を検出（10秒以内）
      const now = Date.now();
      const timeSinceLastRestart = now - lastRestartAtRef.current;
      
      if (timeSinceLastRestart < 10000) {
        // 10秒以内の再起動はカウント
        restartCountRef.current++;
        if (restartCountRef.current > 10) {
          console.error('短時間での再起動回数が多すぎるため、停止します');
          stopTranscription();
          onError('音声認識が不安定です。マイクの接続を確認して再度開始してください。');
          return;
        }
      } else {
        // 10秒以上経過していればカウントをリセット（正常な動作）
        restartCountRef.current = 1;
      }
      
      lastRestartAtRef.current = now;

      // 再起動（少し遅延）
      setTimeout(() => {
        if (!stoppingRef.current && runningRef.current && !handlingErrorRef.current) {
          console.log('Restarting recognition after end');
          startRecognitionLoop();
        }
      }, 1000); // 1秒の遅延
    };

    recognition.onerror = (event: any) => {
      console.error('Recognition error:', event.error);
      
      // エラー処理中フラグを立てる
      handlingErrorRef.current = true;
      recognitionRef.current = null;
      speakingRef.current = false;
      
      // 停止中または実行中でない場合は再起動しない
      if (stoppingRef.current || !runningRef.current) {
        console.log('Not restarting after error: stopping or not running');
        handlingErrorRef.current = false;
        return;
      }

      // 致命的なエラー（許可拒否）の場合のみ停止
      if (event.error === 'not-allowed' || event.error === 'service-not-allowed') {
        stopTranscription();
        onError('マイクへのアクセスが拒否されました。');
        handlingErrorRef.current = false;
        return;
      }

      // abortedエラーは特に長めに待つ（競合を避けるため）
      const delay = event.error === 'aborted' ? 2500 : 1200;
      
      console.log(`Error type: ${event.error}, will restart in ${delay}ms`);
      
      setTimeout(() => {
        if (!stoppingRef.current && runningRef.current) {
          console.log('Restarting recognition after error');
          startRecognitionLoop();
        }
        // エラー処理完了フラグをリセット
        setTimeout(() => {
          handlingErrorRef.current = false;
        }, 500);
      }, delay);
    };

    return recognition;
  }, [onError]);

  /* ===============================
     Recognition Loop
  =============================== */
  const startRecognitionLoop = useCallback(() => {
    // 停止中または既に起動中なら何もしない
    if (!runningRef.current || stoppingRef.current || startingRef.current) {
      console.log('Cannot start: not running, stopping, or already starting');
      return;
    }

    // 既にrecognitionが存在する場合は何もしない
    if (recognitionRef.current) {
      console.log('Recognition already exists');
      return;
    }

    startingRef.current = true;
    try {
      const recognition = createRecognition();
      recognitionRef.current = recognition;
      recognition.start();
      console.log('Recognition.start() called successfully');
    } catch (e: any) {
      console.warn('recognition.start failed:', e.message || e);
      startingRef.current = false;
      recognitionRef.current = null;
      
      // 停止中でなければ少し待って再試行
      if (!stoppingRef.current && runningRef.current) {
        console.log('Retrying recognition start in 1.5 seconds...');
        setTimeout(() => {
          if (!stoppingRef.current && runningRef.current) {
            startRecognitionLoop();
          }
        }, 1500);
      }
    }
  }, [createRecognition]);

  /* ===============================
     Watchdog
  =============================== */
  const startWatchdog = useCallback(() => {
    if (watchdogRef.current) clearInterval(watchdogRef.current);

    watchdogRef.current = window.setInterval(() => {
      if (!runningRef.current || stoppingRef.current) return;

      const diff = Date.now() - lastSoundAtRef.current;
      const limit = speakingRef.current ? WATCHDOG_SPEECH_LIMIT : WATCHDOG_SILENCE_LIMIT;

      if (diff > limit) {
        console.log(`Watchdog: timeout detected (${Math.round(diff/1000)}s since last sound), restarting...`);
        
        // 既存のrecognitionを停止（abort → stop の順）
        try {
          if (recognitionRef.current) {
            recognitionRef.current.abort();
            recognitionRef.current.stop();
          }
        } catch (e) {
          console.warn('Failed to stop in watchdog:', e);
        }
        
        recognitionRef.current = null;
        speakingRef.current = false;
        lastSoundAtRef.current = Date.now();
        
        // 再起動（停止中でなければ）
        if (!stoppingRef.current && runningRef.current) {
          setTimeout(() => {
            if (!stoppingRef.current && runningRef.current) {
              console.log('Watchdog: starting recognition loop');
              startRecognitionLoop();
            }
          }, 500);
        }
      }
    }, WATCHDOG_INTERVAL_MS);
  }, [startRecognitionLoop]);

  /* ===============================
     自動バッファ保存（長時間会議用）
  =============================== */
  const startAutoSave = useCallback(() => {
    if (autoSaveRef.current) clearInterval(autoSaveRef.current);

    autoSaveRef.current = window.setInterval(() => {
      if (!runningRef.current) return;
      if (bufferRef.current.trim()) {
        setTranscriptHistory(prev => [...prev, bufferRef.current.trim()]);
        bufferRef.current = '';
        setCurrentTranscript('');
      }
    }, AUTO_SAVE_INTERVAL_MS);
  }, []);

  const stopAutoSave = useCallback(() => {
    if (autoSaveRef.current) {
      clearInterval(autoSaveRef.current);
      autoSaveRef.current = null;
    }
  }, []);

  /* ===============================
     Start
  =============================== */
  const startTranscription = useCallback(async () => {
    if (runningRef.current || startingRef.current) {
      console.log('Already running or starting');
      return;
    }

    // マイク許可を確認（停止時にストリームを解放しているので再取得）
    const granted = await checkMicPermission();
    if (!granted) return;

    // フラグをリセット
    runningRef.current = true;
    stoppingRef.current = false;
    startingRef.current = false;
    speakingRef.current = false;
    lastSoundAtRef.current = Date.now();
    bufferRef.current = '';
    restartCountRef.current = 0;
    lastRestartAtRef.current = Date.now();

    setTranscriptHistory([]);
    setCurrentTranscript('');
    setIsTranscribing(true);

    console.log('Starting transcription');

    // 各種タイマーを起動
    startWatchdog();
    startAutoSave();
    
    // Recognition開始（少し遅延させて確実に起動）
    setTimeout(() => {
      if (runningRef.current && !stoppingRef.current) {
        startRecognitionLoop();
      }
    }, 100);
  }, [startRecognitionLoop, startWatchdog, startAutoSave, checkMicPermission]);

  /* ===============================
     Stop
  =============================== */
  const stopTranscription = useCallback(() => {
    console.log('Stopping transcription');
    
    // まず停止フラグを立てる（最優先）
    stoppingRef.current = true;
    runningRef.current = false;
    speakingRef.current = false;

    setIsTranscribing(false);

    // タイマーをすべて停止
    if (silenceTimerRef.current) {
      clearTimeout(silenceTimerRef.current);
      silenceTimerRef.current = null;
    }

    stopAutoSave();

    if (watchdogRef.current) {
      clearInterval(watchdogRef.current);
      watchdogRef.current = null;
    }

    // Recognitionを確実に停止（abort → stop の順）
    if (recognitionRef.current) {
      try {
        // abort()を先に呼んでマイクアクセスを即座に解放
        recognitionRef.current.abort();
        recognitionRef.current.stop();
      } catch (e) {
        console.warn('Failed to stop recognition:', e);
      }
      recognitionRef.current = null;
    }

    // メディアストリームを停止（ブラウザのマイクインジケーターを消す）
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach(track => {
        track.stop();
        console.log('Media track stopped:', track.kind);
      });
      mediaStreamRef.current = null;
    }

    // 最後のバッファを履歴化
    if (bufferRef.current.trim()) {
      setTranscriptHistory(prev => [...prev, bufferRef.current.trim()]);
      bufferRef.current = '';
      setCurrentTranscript('');
    }

    // 停止フラグをリセット（少し長めに待つ）
    setTimeout(() => {
      stoppingRef.current = false;
      startingRef.current = false;
      console.log('Stop complete');
    }, 1500);
  }, [stopAutoSave]);

  /* ===============================
     議事録生成
  =============================== */
  const handleGenerateMinutes = async () => {
    // 最後のバッファを履歴に追加
    if (bufferRef.current.trim()) {
      setTranscriptHistory(prev => [...prev, bufferRef.current.trim()]);
      bufferRef.current = '';
      setCurrentTranscript('');
    }

    setIsLoading(true);

    const token = localStorage.getItem('access_token') || '';
    const fullTranscript = transcriptHistory.join(' ').trim();

    if (!fullTranscript) {
      onError('文字起こしがありません。');
      setIsLoading(false);
      return;
    }

    try {
      const generated = await generateMinutes(fullTranscript, token);
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

  // 初回マウント時にマイク許可と復元データを確認
  useEffect(() => {
    checkMicPermission();
    
    // 保存されたデータがあるかチェック
    const saved = loadFromLocalStorage();
    if (saved) {
      setIsRecovering(true);
      // 復元するかユーザーに確認（UIで表示）
    }
  }, [checkMicPermission, loadFromLocalStorage]);

  // transcriptHistoryが変更されたら自動保存
  useEffect(() => {
    if (transcriptHistory.length > 0) {
      saveToLocalStorage(transcriptHistory);
    }
  }, [transcriptHistory, saveToLocalStorage]);

  // クリーンアップ
  useEffect(() => {
    return () => {
      stopTranscription();
      if (mediaStreamRef.current) {
        mediaStreamRef.current.getTracks().forEach(track => track.stop());
      }
    };
  }, [stopTranscription]);

  /* ===============================
     UI
  =============================== */
  return (
    <div className="w-full flex flex-col items-center">
      <h2 className="text-2xl font-bold mb-4">リアルタイム文字起こし</h2>

      {/* 復元データの通知 */}
      {isRecovering && loadFromLocalStorage() && (
        <div className="w-full bg-blue-100 border border-blue-400 text-blue-700 px-4 py-3 rounded mb-4">
          <p className="font-bold">💾 前回の文字起こしデータが見つかりました</p>
          <p className="text-sm mb-3">
            {Math.round(loadFromLocalStorage()!.hoursSinceLastSave * 10) / 10}時間前のデータ（
            {loadFromLocalStorage()!.history.length}件）
          </p>
          <div className="flex gap-2">
            <button
              onClick={() => {
                const saved = loadFromLocalStorage();
                if (saved) applyRecoveredData(saved.history);
              }}
              className="px-3 py-1 bg-blue-500 text-white rounded hover:bg-blue-600 text-sm"
            >
              復元する
            </button>
            <button
              onClick={() => {
                setIsRecovering(false);
                clearLocalStorage();
              }}
              className="px-3 py-1 bg-slate-300 text-slate-700 rounded hover:bg-slate-400 text-sm"
            >
              破棄する
            </button>
          </div>
        </div>
      )}

      {micPermission === 'denied' && (
        <div className="w-full bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
          <p className="font-bold">マイクへのアクセスが拒否されています</p>
          <p className="text-sm">ブラウザの設定からマイクの許可を有効にしてください。</p>
        </div>
      )}

      <div className="w-full h-64 bg-slate-100 rounded-lg p-4 overflow-y-auto mb-6 border">
        {transcriptHistory.length === 0 && !currentTranscript && (
          <p className="text-slate-400 italic">文字起こしがここに表示されます...</p>
        )}
        {transcriptHistory.map((line, i) => (
          <p key={i} className="text-slate-600 mb-2">{line}</p>
        ))}
        {currentTranscript && (
          <p className="text-slate-800 font-medium">{currentTranscript}</p>
        )}
      </div>

      <p className="text-sm text-slate-500 mb-3">
        {isTranscribing ? '🎤 マイク入力中...' : '⏹ 停止中'}
        {micPermission === 'prompt' && ' (アクセス許可を確認中...)'}
      </p>

      <div className="flex items-center space-x-4">
        <button 
          onClick={onBack} 
          className="p-3 bg-slate-200 rounded-full hover:bg-slate-300 transition-colors"
          aria-label="戻る"
        >
          <BackIcon />
        </button>

        {!isTranscribing ? (
          <button
            onClick={startTranscription}
            disabled={micPermission === 'denied'}
            className="w-40 h-16 bg-blue-500 text-white rounded-full flex items-center justify-center hover:bg-blue-600 disabled:bg-slate-400 disabled:cursor-not-allowed transition-colors">
            <MicIcon className="mr-2" /> 開始
          </button>
        ) : (
          <button
            onClick={stopTranscription}
            className="w-40 h-16 bg-red-500 text-white rounded-full flex items-center justify-center hover:bg-red-600 transition-colors">
            <StopIcon className="mr-2" /> 停止
          </button>
        )}

        <button
          onClick={handleGenerateMinutes}
          disabled={isTranscribing || isLoading || transcriptHistory.length === 0}
          className="h-16 px-6 bg-green-500 text-white rounded-full hover:bg-green-600 disabled:bg-slate-400 disabled:cursor-not-allowed transition-colors">
          {isLoading ? <><Spinner /> 生成中…</> : '議事録を生成'}
        </button>
      </div>

      <p className="text-xs text-slate-400 mt-4">
        文字起こし中は、はっきりと話してください。長時間の会議でも自動保存されます。
      </p>
    </div>
  );
};

export default LiveTranscriptionScreen;