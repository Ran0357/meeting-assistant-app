
import React, { useState, useEffect } from 'react';
import { MeetingMinutes, ActionItem } from '../types';
import { SaveIcon, SlackIcon, CheckIcon } from './Icons';


interface ResultsScreenProps {
  minutes: MeetingMinutes;
  onReset: () => void;
}

const ResultsScreen: React.FC<ResultsScreenProps> = ({ minutes, onReset }) => {
  const [editableMinutes, setEditableMinutes] = useState(minutes);
  const [isSaved, setIsSaved] = useState(false);
  const [isNotified, setIsNotified] = useState(false);

  useEffect(() => {
    setEditableMinutes(minutes);
  }, [minutes]);
  
  const handleSave = () => {
    console.log("Saving minutes:", editableMinutes);
    // ここでSupabaseへの保存処理を実装
    setIsSaved(true);
    setTimeout(() => setIsSaved(false), 2000);
    alert("（シミュレーション）議事録がデータベースに保存されました。");
  };

  const handleNotifySlack = () => {
    console.log("Notifying Slack about minutes:", editableMinutes);
    // ここでSlack APIへの通知処理を実装
    setIsNotified(true);
    setTimeout(() => setIsNotified(false), 2000);
    alert("（シミュレーション）Slackに通知が送信されました。");
  };
  
  const handleInputChange = <K extends keyof MeetingMinutes,>(
    key: K,
    value: MeetingMinutes[K]
  ) => {
    setEditableMinutes(prev => ({...prev, [key]: value}));
  };
  
  const handleActionItemChange = (index: number, field: keyof ActionItem, value: string) => {
    const newActionItems = [...editableMinutes.actionItems];
    newActionItems[index] = {...newActionItems[index], [field]: value};
    handleInputChange('actionItems', newActionItems);
  };

  return (
    <div className="w-full flex flex-col items-center">
      <h2 className="text-3xl font-bold text-center mb-8">生成された議事録</h2>

      <div className="w-full space-y-8">
        <div>
          <h3 className="text-xl font-semibold mb-2 border-b-2 border-blue-500 pb-2">要約</h3>
          <textarea
            value={editableMinutes.summary}
            onChange={(e) => handleInputChange('summary', e.target.value)}
            className="w-full p-3 bg-slate-50 rounded-md border border-slate-300 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition h-32"
          />
        </div>
        
        <div>
          <h3 className="text-xl font-semibold mb-2 border-b-2 border-green-500 pb-2">主要な決定事項</h3>
          <textarea
            value={editableMinutes.keyPoints.join('\n')}
            onChange={(e) => handleInputChange('keyPoints', e.target.value.split('\n'))}
            className="w-full p-3 bg-slate-50 rounded-md border border-slate-300 focus:ring-2 focus:ring-green-500 focus:border-green-500 transition h-40"
            placeholder="決定事項を一行ずつ入力"
          />
        </div>

        <div>
          <h3 className="text-xl font-semibold mb-2 border-b-2 border-yellow-500 pb-2">アクションアイテム</h3>
          <div className="space-y-4">
            {editableMinutes.actionItems.map((item, index) => (
              <div key={index} className="grid grid-cols-1 md:grid-cols-3 gap-4 p-3 bg-slate-50 rounded-md border border-slate-200">
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-slate-700">タスク</label>
                  <input
                    type="text"
                    value={item.task}
                    onChange={(e) => handleActionItemChange(index, 'task', e.target.value)}
                    className="mt-1 block w-full rounded-md border-slate-300 shadow-sm focus:border-yellow-500 focus:ring-yellow-500 sm:text-sm"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700">担当者</label>
                  <input
                    type="text"
                    value={item.assignee}
                    onChange={(e) => handleActionItemChange(index, 'assignee', e.target.value)}
                    className="mt-1 block w-full rounded-md border-slate-300 shadow-sm focus:border-yellow-500 focus:ring-yellow-500 sm:text-sm"
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="mt-10 flex flex-wrap justify-center gap-4">
        <button
          onClick={handleSave}
          className={`flex items-center px-6 py-3 rounded-full text-lg font-semibold shadow-lg transition-colors duration-300 ${
            isSaved ? 'bg-green-500 text-white' : 'bg-blue-500 hover:bg-blue-600 text-white'
          }`}
        >
          {isSaved ? <CheckIcon className="mr-2" /> : <SaveIcon className="mr-2" />}
          {isSaved ? '保存しました' : 'DBに保存'}
        </button>
        <button
          onClick={handleNotifySlack}
          className={`flex items-center px-6 py-3 rounded-full text-lg font-semibold shadow-lg transition-colors duration-300 ${
            isNotified ? 'bg-green-500 text-white' : 'bg-gray-800 hover:bg-gray-900 text-white'
          }`}
        >
          {isNotified ? <CheckIcon className="mr-2" /> : <SlackIcon className="mr-2" />}
          {isNotified ? '通知しました' : 'Slackに通知'}
        </button>
        <button
          onClick={onReset}
          className="px-6 py-3 bg-slate-500 hover:bg-slate-600 text-white rounded-full text-lg font-semibold shadow-lg transition-colors"
        >
          最初に戻る
        </button>
      </div>
    </div>
  );
};

export default ResultsScreen;