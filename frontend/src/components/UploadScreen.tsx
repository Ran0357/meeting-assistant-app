import React, { useState, useCallback } from 'react';
import { MeetingMinutes } from '../types';
import { generateMinutesFromText } from '../services/geminiService';
import { Spinner } from './Spinner';
import { UploadIcon, BackIcon } from './Icons';

interface UploadScreenProps {
  onMinutesGenerated: (minutes: MeetingMinutes) => void;
  onError: (error: string) => void;
  onBack: () => void;
}

const UploadScreen: React.FC<UploadScreenProps> = ({ onMinutesGenerated, onError, onBack }) => {
  const [file, setFile] = useState<File | null>(null);
  const [fileContent, setFileContent] = useState<string>('');
  const [isLoading, setIsLoading] = useState(false);

  // ファイル選択時
  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = event.target.files?.[0];
    if (!selectedFile) return;

    if (selectedFile.type !== 'text/plain' || selectedFile.size > 5 * 1024 * 1024) {
      onError('5MB以下のプレーンテキストファイル（.txt）を選択してください。');
      setFile(null);
      setFileContent('');
      return;
    }

    setFile(selectedFile);
    const reader = new FileReader();
    reader.onload = (e) => setFileContent(e.target?.result as string);
    reader.readAsText(selectedFile);
  };

  // 議事録生成
  const handleGenerate = useCallback(async () => {
    if (!file || !fileContent) {
      onError('ファイルが選択されていないか、内容が空です。');
      return;
    }

    setIsLoading(true);
    try {
      // Gemini APIなどで議事録生成
      const generatedMinutes = await generateMinutesFromText(fileContent);

      // DB保存前の初期値
      const minutes: MeetingMinutes = {
        ...generatedMinutes,
        title: '',             // 保存フォームで入力
        meeting_date: '',      // 保存フォームで入力
        participants: generatedMinutes.participants || []
      };

      onMinutesGenerated(minutes);

    } catch (err: any) {
      if (err instanceof Error) onError(err.message);
      else onError('不明なエラーが発生しました。');
    } finally {
      setIsLoading(false);
    }
  }, [file, fileContent, onMinutesGenerated, onError]);

  return (
    <div className="w-full flex flex-col items-center text-center">
      <h2 className="text-2xl font-bold mb-6">テキストファイルから議事録を作成</h2>
      <p className="text-slate-600 mb-8">
        ZoomやGoogle Meetからエクスポートした文字起こしテキストファイル（.txt）をアップロードしてください。
      </p>

      <div className="w-full max-w-lg">
        <label
          htmlFor="file-upload"
          className="relative cursor-pointer bg-white rounded-md font-medium text-blue-600 hover:text-blue-500
                     focus-within:outline-none focus-within:ring-2 focus-within:ring-offset-2 focus-within:ring-blue-500"
        >
          <div className="flex justify-center items-center px-6 pt-5 pb-6 border-2 border-slate-300 border-dashed rounded-md">
            <div className="space-y-1 text-center">
              <UploadIcon className="mx-auto h-12 w-12 text-slate-400" />
              <div className="flex text-sm text-slate-600">
                <span className="text-blue-600">ファイルを選択</span>
                <input
                  id="file-upload"
                  name="file-upload"
                  type="file"
                  className="sr-only"
                  onChange={handleFileChange}
                  accept=".txt,text/plain"
                />
              </div>
              <p className="text-xs text-slate-500">TXTファイル (5MBまで)</p>
            </div>
          </div>
        </label>

        {file && <p className="mt-4 text-sm text-slate-500">選択中のファイル: {file.name}</p>}
      </div>

      <div className="mt-8 flex items-center space-x-4">
        <button
          onClick={onBack}
          className="p-3 bg-slate-200 rounded-full hover:bg-slate-300 transition-colors"
          aria-label="戻る"
        >
          <BackIcon />
        </button>

        <button
          onClick={handleGenerate}
          disabled={!file || isLoading}
          className="px-8 py-3 bg-green-500 text-white rounded-full text-lg font-semibold shadow-lg
                     hover:bg-green-600 disabled:bg-slate-400 disabled:cursor-not-allowed transition-colors flex items-center"
        >
          {isLoading ? (
            <>
              <Spinner /> <span className="ml-2">生成中...</span>
            </>
          ) : (
            '議事録を生成'
          )}
        </button>
      </div>
    </div>
  );
};

export default UploadScreen;
