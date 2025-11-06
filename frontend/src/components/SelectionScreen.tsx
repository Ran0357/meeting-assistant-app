
import React from 'react';
import { MicIcon, UploadIcon } from './Icons';

interface SelectionScreenProps {
  onSelectLive: () => void;
  onSelectUpload: () => void;
}

const SelectionScreen: React.FC<SelectionScreenProps> = ({ onSelectLive, onSelectUpload }) => {
  return (
    <div className="w-full">
      <h2 className="text-2xl font-bold text-center mb-8 text-slate-700">議事録の作成方法を選択してください</h2>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        <button
          onClick={onSelectLive}
          className="group flex flex-col items-center justify-center p-8 bg-blue-50 rounded-xl border-2 border-transparent hover:border-blue-500 hover:bg-white transition-all duration-300 transform hover:-translate-y-1 shadow-md hover:shadow-xl"
        >
          <div className="bg-blue-500 text-white rounded-full p-4 mb-4 group-hover:bg-blue-600 transition-colors">
            <MicIcon />
          </div>
          <h3 className="text-xl font-semibold text-slate-800">リアルタイム文字起こし</h3>
          <p className="text-slate-500 mt-2 text-center">会議をしながらリアルタイムで議事録を生成します。</p>
        </button>
        <button
          onClick={onSelectUpload}
          className="group flex flex-col items-center justify-center p-8 bg-green-50 rounded-xl border-2 border-transparent hover:border-green-500 hover:bg-white transition-all duration-300 transform hover:-translate-y-1 shadow-md hover:shadow-xl"
        >
          <div className="bg-green-500 text-white rounded-full p-4 mb-4 group-hover:bg-green-600 transition-colors">
            <UploadIcon />
          </div>
          <h3 className="text-xl font-semibold text-slate-800">ファイルから作成</h3>
          <p className="text-slate-500 mt-2 text-center">音声ファイルやテキストファイルをアップロードして議事録を生成します。</p>
        </button>
      </div>
    </div>
  );
};

export default SelectionScreen;