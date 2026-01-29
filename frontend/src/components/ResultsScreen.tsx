import React, { useState, useEffect } from 'react';
import { MeetingMinutes, ActionItem, Participant } from '../types';
import { SaveIcon } from './Icons';

interface ResultsScreenProps {
  minutes: MeetingMinutes;
  onReset: () => void;
}

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL;

const EMPTY_ACTION: ActionItem = {
  description: '',
  owner_name: '',
  due_date: null,
  reminder_at: null,
  last_reminded_at: null,
  status: 'open',
  slack_channel: null,
  reminded_before: false,
  notify_before: false,
  notified_before_at: null,
};

const ResultsScreen: React.FC<ResultsScreenProps> = ({ minutes, onReset }) => {
  const [editableMinutes, setEditableMinutes] = useState<MeetingMinutes>(minutes);
  const [participants, setParticipants] = useState<Participant[]>(minutes.participants || []);
  const [showSaveForm, setShowSaveForm] = useState(false);

  useEffect(() => {
    setEditableMinutes({
      ...minutes,
      actionItems:
        minutes.actionItems && minutes.actionItems.length > 0
          ? minutes.actionItems
          : [structuredClone(EMPTY_ACTION)],
    });
    setParticipants(minutes.participants || []);
  }, [minutes]);

  const handleInputChange = <K extends keyof MeetingMinutes>(key: K, value: MeetingMinutes[K]) => {
    setEditableMinutes(prev => ({ ...prev, [key]: value }));
  };

  const handleActionItemChange = (index: number, field: keyof ActionItem, value: any) => {
    const updated = [...(editableMinutes.actionItems || [])];
    updated[index] = { ...updated[index], [field]: value };
    setEditableMinutes(prev => ({ ...prev, actionItems: updated }));
  };

  const addActionItem = () => {
    setEditableMinutes(prev => ({
      ...prev,
      actionItems: [...(prev.actionItems || []), structuredClone(EMPTY_ACTION)],
    }));
  };

  const removeActionItem = (index: number) => {
    const items = editableMinutes.actionItems || [];
    if (items.length === 1) return;
    setEditableMinutes(prev => ({
      ...prev,
      actionItems: items.filter((_, i) => i !== index),
    }));
  };

  const handleSave = async () => {
    if (!editableMinutes.title) return alert('会議名は必須です');
    if (!editableMinutes.meeting_date) return alert('実施日は必須です');

    const token = localStorage.getItem('access_token');
    if (!token) return alert('ログイン情報がありません');

    try {
      const res = await fetch(`${API_BASE_URL}/api/save_minutes`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(editableMinutes),
      });

      if (!res.ok) {
        const text = await res.text();
        throw new Error(text);
      }

      alert('保存完了！');
      setShowSaveForm(false);
    } catch (err: any) {
      console.error(err);
      alert(`保存失敗: ${err.message}`);
    }
  };

  return (
    <div className="w-full flex flex-col items-center">
      <h2 className="text-3xl font-bold mb-6">生成された議事録</h2>

      <section className="w-full space-y-6">
        <div>
          <h3 className="font-semibold border-b-2 border-blue-500 pb-1">要約</h3>
          <textarea
            value={editableMinutes.summary}
            onChange={e => handleInputChange('summary', e.target.value)}
            className="w-full h-32 p-3 border rounded"
          />
        </div>

        <div>
          <h3 className="font-semibold border-b-2 border-green-500 pb-1">主要な決定事項</h3>
          <textarea
            value={(editableMinutes.key_points || []).join('\n')}
            onChange={e => handleInputChange('key_points', e.target.value.split('\n'))}
            className="w-full h-40 p-3 border rounded"
          />
        </div>

        <div>
          <h3 className="font-semibold border-b-2 border-yellow-500 pb-1">アクションアイテム</h3>

          <div className="space-y-3">
            {editableMinutes.actionItems?.map((item, i) => (
              <div key={i} className="flex gap-3 p-3 border rounded bg-slate-50">
                <input
                  className="flex-[2] p-2 border rounded"
                  placeholder="タスク"
                  value={item.description}
                  onChange={e => handleActionItemChange(i, 'description', e.target.value)}
                />
                <input
                  className="flex-1 p-2 border rounded"
                  placeholder="担当者"
                  value={item.owner_name || ''}
                  onChange={e => handleActionItemChange(i, 'owner_name', e.target.value)}
                />
                <input
                  type="date"
                  className="flex-1 p-2 border rounded"
                  value={item.due_date || ''}
                  onChange={e => handleActionItemChange(i, 'due_date', e.target.value || null)}
                />
                <button
                  onClick={() => removeActionItem(i)}
                  className="px-3 bg-red-500 text-white rounded"
                >
                  削除
                </button>
              </div>
            ))}
          </div>

          <button
            onClick={addActionItem}
            className="mt-3 px-4 py-2 bg-yellow-500 text-white rounded"
          >
            ＋ 追加
          </button>
        </div>
      </section>

      <div className="mt-8 flex gap-4">
        <button
          onClick={() => setShowSaveForm(true)}
          className="flex items-center px-6 py-3 bg-blue-600 text-white rounded-full"
        >
          <SaveIcon className="mr-2" /> DB保存
        </button>

        <button
          onClick={onReset}
          className="px-6 py-3 bg-gray-500 text-white rounded-full"
        >
          最初に戻る
        </button>
      </div>

      {showSaveForm && (
        <div className="fixed inset-0 bg-black/40 flex justify-center items-center">
          <div className="bg-white p-6 rounded-lg w-full max-w-md">
            <h3 className="text-lg font-semibold mb-4">保存情報</h3>

            <input
              placeholder="会議名"
              value={editableMinutes.title || ''}
              onChange={e => handleInputChange('title', e.target.value)}
              className="w-full p-2 border rounded mb-2"
            />

            <input
              type="date"
              value={editableMinutes.meeting_date || ''}
              onChange={e => handleInputChange('meeting_date', e.target.value)}
              className="w-full p-2 border rounded mb-4"
            />

            <div className="flex justify-between">
              <button onClick={() => setShowSaveForm(false)} className="px-4 py-2 bg-gray-300 rounded">
                キャンセル
              </button>
              <button onClick={handleSave} className="px-4 py-2 bg-blue-600 text-white rounded">
                保存
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ResultsScreen;
