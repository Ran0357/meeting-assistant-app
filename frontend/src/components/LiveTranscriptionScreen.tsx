
import React, { useState, useRef, useEffect, useCallback } from 'react';
// Fix: Removed LiveSession as it is not exported from @google/genai
import { GoogleGenAI, LiveServerMessage, Modality, Blob } from "@google/genai";
import { MeetingMinutes } from '../types';
import { generateMinutesFromText } from '../services/geminiService';
import { Spinner } from './Spinner';
import { MicIcon, StopIcon, BackIcon } from './Icons';

interface LiveTranscriptionScreenProps {
  onMinutesGenerated: (minutes: MeetingMinutes) => void;
  onError: (error: string) => void;
  onBack: () => void;
}

// Audio utility functions
function encode(bytes: Uint8Array): string {
  let binary = '';
  const len = bytes.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

function createBlob(data: Float32Array): Blob {
  const l = data.length;
  const int16 = new Int16Array(l);
  for (let i = 0; i < l; i++) {
    int16[i] = data[i] < 0 ? data[i] * 32768 : data[i] * 32767;
  }
  return {
    data: encode(new Uint8Array(int16.buffer)),
    mimeType: 'audio/pcm;rate=16000',
  };
}

const LiveTranscriptionScreen: React.FC<LiveTranscriptionScreenProps> = ({ onMinutesGenerated, onError, onBack }) => {
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [transcriptHistory, setTranscriptHistory] = useState<string[]>([]);
  const [currentTranscript, setCurrentTranscript] = useState('');

  // Fix: Changed type to `any` as LiveSession is not an exported type.
  const sessionRef = useRef<any | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const scriptProcessorRef = useRef<ScriptProcessorNode | null>(null);
  const mediaStreamSourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  
  const stopTranscription = useCallback(() => {
    if (isTranscribing) {
      if (sessionRef.current) {
        sessionRef.current.close();
        sessionRef.current = null;
      }
      if (mediaStreamRef.current) {
        mediaStreamRef.current.getTracks().forEach(track => track.stop());
        mediaStreamRef.current = null;
      }
      if (scriptProcessorRef.current) {
        scriptProcessorRef.current.disconnect();
        scriptProcessorRef.current = null;
      }
      if (mediaStreamSourceRef.current) {
        mediaStreamSourceRef.current.disconnect();
        mediaStreamSourceRef.current = null;
      }
      if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
        audioContextRef.current.close();
        audioContextRef.current = null;
      }
      setIsTranscribing(false);
    }
  }, [isTranscribing]);

  const startTranscription = async () => {
    if (isTranscribing) return;
    setIsTranscribing(true);
    setTranscriptHistory([]);
    setCurrentTranscript('');

    try {
      if (!process.env.API_KEY) {
        throw new Error("APIキーが設定されていません。");
      }
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

      const sessionPromise = ai.live.connect({
        model: 'gemini-2.5-flash-native-audio-preview-09-2025',
        callbacks: {
          onopen: () => { console.log('接続が開かれました。'); },
          onmessage: (message: LiveServerMessage) => {
            if (message.serverContent?.inputTranscription) {
              const text = message.serverContent.inputTranscription.text;
              setCurrentTranscript(prev => prev + text);
            }
            if (message.serverContent?.turnComplete) {
              // Fix: Use functional update to get the latest transcript and avoid stale closures.
              setCurrentTranscript(prevTranscript => {
                if (prevTranscript) {
                  setTranscriptHistory(prevHistory => [...prevHistory, prevTranscript]);
                }
                return '';
              });
            }
          },
          onerror: (e: ErrorEvent) => {
            console.error('エラー:', e);
            onError(`リアルタイム接続エラー: ${e.message}`);
            stopTranscription();
          },
          onclose: (e: CloseEvent) => {
            console.log('接続が閉じられました。');
          },
        },
        config: {
          responseModalities: [Modality.AUDIO],
          inputAudioTranscription: {},
        },
      });

      // Fix: Per Gemini API guidelines, use the promise to handle the session
      // to avoid race conditions. We still need the resolved session to close it.
      sessionPromise.then(session => {
        sessionRef.current = session;
      }).catch(error => {
        console.error("接続の確立に失敗しました:", error);
        if (error instanceof Error) {
            onError(`接続に失敗しました: ${error.message}`);
        } else {
            onError("接続中に不明なエラーが発生しました。");
        }
        stopTranscription();
      });
      
      mediaStreamRef.current = await navigator.mediaDevices.getUserMedia({ audio: true });
      // Fix: Cast window to `any` to support vendor-prefixed webkitAudioContext
      audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 16000 });
      mediaStreamSourceRef.current = audioContextRef.current.createMediaStreamSource(mediaStreamRef.current);
      scriptProcessorRef.current = audioContextRef.current.createScriptProcessor(4096, 1, 1);
      
      scriptProcessorRef.current.onaudioprocess = (audioProcessingEvent) => {
        const inputData = audioProcessingEvent.inputBuffer.getChannelData(0);
        const pcmBlob = createBlob(inputData);
        // Fix: Use the sessionPromise to send data as per Gemini API guidelines.
        sessionPromise.then((session) => {
          session.sendRealtimeInput({ media: pcmBlob });
        });
      };
      
      mediaStreamSourceRef.current.connect(scriptProcessorRef.current);
      scriptProcessorRef.current.connect(audioContextRef.current.destination);

    } catch (error) {
      console.error("文字起こしの開始に失敗しました:", error);
      if (error instanceof Error) {
        onError(`マイクへのアクセスに失敗しました: ${error.message}`);
      } else {
        onError("マイクへのアクセス中に不明なエラーが発生しました。");
      }
      stopTranscription();
    }
  };

  const handleGenerateMinutes = async () => {
    setIsLoading(true);
    const fullTranscript = [...transcriptHistory, currentTranscript].join(' ').trim();
    if (!fullTranscript) {
      onError("議事録を生成するための文字起こしがありません。");
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
        onError("不明なエラーが発生しました。");
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