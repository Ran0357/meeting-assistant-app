
import React from 'react';
import { MicIcon, UploadIcon } from './Icons';

interface SelectionScreenProps {
  onSelectLive: () => void;
  onSelectUpload: () => void;
  onSelectViewPastDocuments: () => void;
}

const SelectionScreen: React.FC<SelectionScreenProps> = ({ onSelectLive, onSelectUpload, onSelectViewPastDocuments }) => {
  return (
    <div className="w-full">
      <div className="mb-6">
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
        <button
          onClick={onSelectLive}
          className="group flex flex-col p-6 bg-white border-2 border-gray-200 rounded-lg hover:border-blue-500 hover:shadow-md transition-all text-left"
        >
          <div className="flex items-center mb-4">
            <div className="bg-blue-600 text-white rounded-md p-3">
              <MicIcon />
            </div>
            <h3 className="ml-4 text-lg font-semibold text-gray-900">リアルタイム文字起こし</h3>
          </div>
          <p className="text-sm text-gray-600 leading-relaxed">
            会議をしながらリアルタイムで文字起こしを行い、議事録を自動生成します。
          </p>
          <div className="mt-4 pt-4 border-t border-gray-100">
            <span className="text-xs font-medium text-blue-600 group-hover:text-blue-700">機能を開始 →</span>
          </div>
        </button>
        <button
          onClick={onSelectUpload}
          className="group flex flex-col p-6 bg-white border-2 border-gray-200 rounded-lg hover:border-blue-500 hover:shadow-md transition-all text-left"
        >
          <div className="flex items-center mb-4">
            <div className="bg-blue-600 text-white rounded-md p-3">
              <UploadIcon />
            </div>
            <h3 className="ml-4 text-lg font-semibold text-gray-900">ファイルから作成</h3>
          </div>
          <p className="text-sm text-gray-600 leading-relaxed">
            音声ファイルまたはテキストファイルをアップロードして議事録を生成します。
          </p>
          <div className="mt-4 pt-4 border-t border-gray-100">
            <span className="text-xs font-medium text-blue-600 group-hover:text-blue-700">機能を開始 →</span>
          </div>
        </button>
      </div>

      {/* 過去の議事録ボタン */}
      <div className="mb-6">
        <button
          onClick={onSelectViewPastDocuments}
          className="w-full p-4 bg-gradient-to-r from-purple-50 to-indigo-50 border-2 border-purple-300 rounded-lg hover:border-purple-500 hover:shadow-md transition-all text-left"
        >
          <h3 className="text-lg font-semibold text-purple-900 mb-2">📋 過去の議事録を見る</h3>
          <p className="text-sm text-purple-700">
            これまでに作成した議事録を確認・編集できます。
          </p>
        </button>
      </div>

      <div className="mt-8 p-4 bg-blue-50 border border-blue-200 rounded-lg">
        <p className="text-sm text-blue-800">
          <span className="font-semibold">ヒント:</span> リアルタイム文字起こしは会議中に、ファイルアップロードは会議後の記録整理に適しています。
        </p>
      </div>
    </div>
  );
};

export default SelectionScreen;