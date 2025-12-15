import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabaseClient';
import { MeetingMinutes, ActionItem, Participant } from '../types';
import { SaveIcon, SlackIcon } from './Icons';

interface ResultsScreenProps {
  minutes: MeetingMinutes;
  onReset: () => void;
}

const ResultsScreen: React.FC<ResultsScreenProps> = ({ minutes, onReset }) => {
  const [editableMinutes, setEditableMinutes] = useState<MeetingMinutes>(minutes);
  const [participants, setParticipants] = useState<Participant[]>(minutes.participants || []);
  const [newParticipantName, setNewParticipantName] = useState('');
  const [newParticipantRole, setNewParticipantRole] = useState('');
  const [isSaved, setIsSaved] = useState(false);
  const [isNotified, setIsNotified] = useState(false);
  const [showSaveForm, setShowSaveForm] = useState(false);

  useEffect(() => {
    setEditableMinutes(minutes);
    setParticipants(minutes.participants || []);
  }, [minutes]);

  const handleInputChange = <K extends keyof MeetingMinutes>(key: K, value: MeetingMinutes[K]) => {
    setEditableMinutes(prev => ({ ...prev, [key]: value }));
  };

  const handleActionItemChange = (index: number, field: keyof ActionItem, value: string) => {
    const updated = [...(editableMinutes.actionItems || [])];
    updated[index] = { ...updated[index], [field]: value };
    setEditableMinutes(prev => ({ ...prev, actionItems: updated }));
  };

  const addParticipant = () => {
    if (!newParticipantName.trim()) return alert('名前を入力してください');
    setParticipants([...participants, { name: newParticipantName, role: newParticipantRole }]);
    setNewParticipantName('');
    setNewParticipantRole('');
  };

  const removeParticipant = (index: number) => {
    setParticipants(participants.filter((_, i) => i !== index));
  };

  const handleSave = async () => {
    if (!editableMinutes.title) return alert('会議名は必須です。');
    if (!editableMinutes.meeting_date) return alert('実施日は必須です。');

    try {
      const access_token = localStorage.getItem('access_token')?.trim();
      const refresh_token = localStorage.getItem('refresh_token')?.trim();

      if (!access_token || !refresh_token) {
        throw new Error('アクセストークンまたはリフレッシュトークンがありません');
      }

      const { data: sessionData, error: sessionError } = await supabase.auth.setSession({
        access_token,
        refresh_token,
      });
      if (sessionError) throw sessionError;
      if (!sessionData.user) throw new Error('ユーザー情報が取得できません');

      const userId = sessionData.user.id;

      // documents 保存
      const { data: docData, error: docError } = await supabase
        .from('documents')
        .upsert({
          id: editableMinutes.id,
          user_id: userId,
          title: editableMinutes.title,
          summary: editableMinutes.summary,
          key_points: editableMinutes.key_points,
          meeting_date: editableMinutes.meeting_date
        })
        .select()
        .single();
      if (docError || !docData) throw docError || new Error('ドキュメント保存に失敗');

      const documentId = docData.id;

      // participants 保存
      if (participants.length > 0) {
        const participantRecords = participants.map(p => ({
          document_id: documentId,
          name: p.name,
          slack_id: p.slack_id || null,
          role: p.role || null
        }));
        await supabase.from('document_participants').upsert(participantRecords);
      }

      // actionItems 保存
      if (editableMinutes.actionItems?.length) {
        const todos = editableMinutes.actionItems.map((a) => ({

          document_id: documentId,
          description: a.description,

          owner_name: a.owner_name || null,

          // ★ 空文字（""）を null に変換する
          due_date:
            !a.due_date || a.due_date === "未定"
              ? null
              : a.due_date,

          reminder_at: a.reminder_at || null,
          last_reminded_at: a.last_reminded_at || null,

          status: a.status || "open",
        }));

        const { data: todoData, error: todoError } = await supabase
          .from("document_todos")
          .upsert(todos)
          .select();


      }

      setEditableMinutes(prev => ({ ...prev, participants }));
      setIsSaved(true);
      setTimeout(() => setIsSaved(false), 2000);
      setShowSaveForm(false);
      alert('議事録をDBに保存しました！');

    } catch (err: any) {
      console.error(err);
      alert(`保存中にエラーが発生しました: ${err.message || err}`);
    }
  };

  const handleNotifySlack = async () => {
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const access_token = sessionData?.session?.access_token;
      if (!access_token) throw new Error("アクセストークンがありません");

      const res = await fetch(
        "https://eltdfrnvqseivxqfoxqe.supabase.co/functions/v1/slack",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${access_token}`,
          },
          body: JSON.stringify({ text: "今日の会議のまとめができました！アクションアイテムをチェックしてください。", actionItems: editableMinutes.actionItems }),
        }
      );

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Slack通知に失敗");
      }

      alert("Slackに通知しました！");
    } catch (err: any) {
      console.error(err);
      alert(err.message);
    }
  };




  return (
    <div className="w-full flex flex-col items-center">
      <h2 className="text-3xl font-bold text-center mb-8">生成された議事録</h2>

      {/* 要約 */}
      <div className="w-full space-y-8">
        <div>
          <h3 className="text-xl font-semibold mb-2 border-b-2 border-blue-500 pb-2">要約</h3>
          <textarea
            value={editableMinutes.summary}
            onChange={e => handleInputChange('summary', e.target.value)}
            className="w-full p-3 bg-slate-50 rounded-md border border-slate-300 h-32"
          />
        </div>

        {/* 決定事項 */}
        <div>
          <h3 className="text-xl font-semibold mb-2 border-b-2 border-green-500 pb-2">主要な決定事項</h3>
          <textarea
            value={(editableMinutes.key_points || []).join('\n')}
            onChange={e => handleInputChange('key_points', e.target.value.split('\n'))}
            className="w-full p-3 bg-slate-50 rounded-md border border-slate-300 h-40"
          />
        </div>

        {/* アクションアイテム */}
        <div>
          <h3 className="text-xl font-semibold mb-2 border-b-2 border-yellow-500 pb-2">アクションアイテム</h3>
          <div className="space-y-4">
            {editableMinutes.actionItems?.map((item, index) => (
              <div key={index} className="flex gap-4 p-3 bg-slate-50 rounded-md border">
                <div className="flex-[2]">
                  <label className="text-sm font-medium">タスク</label>
                  <input
                    type="text"
                    value={item.description}
                    onChange={e => handleActionItemChange(index, 'description', e.target.value)}
                    className="mt-1 w-full p-2 border rounded"
                  />
                </div>
                <div className="flex-1">
                  <label className="text-sm font-medium">担当者</label>
                  <input
                    type="text"
                    value={item.owner_name || ''}
                    onChange={e => handleActionItemChange(index, 'owner_name', e.target.value)}
                    className="mt-1 w-full p-2 border rounded"
                  />
                </div>
                <div className="flex-1">
                  <label className="text-sm font-medium">期限</label>
                  <input
                    type="date"
                    value={item.due_date || ''}
                    onChange={e => handleActionItemChange(
                      index,
                      'due_date',
                      e.target.value || null
                    )
                    }
                    className="mt-1 w-full p-2 border rounded"
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ボタン */}
      <div className="mt-10 flex flex-wrap justify-center gap-4">
        <button
          onClick={() => setShowSaveForm(true)}
          className="flex items-center px-6 py-3 rounded-full bg-blue-500 text-white hover:bg-blue-600"
        >
          <SaveIcon className="mr-2" /> DBに保存
        </button>

        <button
          onClick={handleNotifySlack}
          className="flex items-center px-6 py-3 rounded-full bg-gray-800 text-white hover:bg-gray-900"
        >
          <SlackIcon className="mr-2" /> Slackに通知
        </button>

        <button
          onClick={onReset}
          className="px-6 py-3 rounded-full bg-slate-500 text-white hover:bg-slate-600"
        >
          最初に戻る
        </button>
      </div>

      {/* 保存フォームモーダル */}
      {showSaveForm && (
        <div className="fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md space-y-4 shadow-xl">
            <h3 className="text-xl font-semibold mb-3">保存情報を入力</h3>

            {/* 会議名 */}
            <div>
              <label className="block text-sm font-medium">会議名（必須）</label>
              <input
                type="text"
                value={editableMinutes.title || ''}
                onChange={e => handleInputChange('title', e.target.value)}
                className="w-full mt-1 p-2 border rounded"
              />
            </div>

            {/* 実施日 */}
            <div>
              <label className="block text-sm font-medium">実施日（必須）</label>
              <input
                type="date"
                value={editableMinutes.meeting_date || ''}
                onChange={e => handleInputChange('meeting_date', e.target.value)}
                className="w-full mt-1 p-2 border rounded"
              />
            </div>

            {/* 参加者 */}
            <div>
              <label className="block text-sm font-medium">参加者（任意・1人ずつ追加）</label>
              {participants.map((p, i) => (
                <div key={i} className="flex gap-2 mt-1 items-center">
                  <span>{p.name} {p.role && `(${p.role})`}</span>
                  <button
                    onClick={() => removeParticipant(i)}
                    className="px-2 py-1 bg-red-500 text-white rounded"
                  >
                    削除
                  </button>
                </div>
              ))}
              <div className="flex gap-1 mt-1">
                <input
                  type="text"
                  placeholder="名前"
                  value={newParticipantName}
                  onChange={e => setNewParticipantName(e.target.value)}
                  className="flex-1 p-1 border rounded"
                />
                <input
                  type="text"
                  placeholder="役割"
                  value={newParticipantRole}
                  onChange={e => setNewParticipantRole(e.target.value)}
                  className="flex-1 p-1 border rounded"
                />
                <button
                  onClick={addParticipant}
                  className="px-2 py-2 bg-green-500 text-white rounded"
                >
                  追加
                </button>
              </div>
            </div>

            {/* 保存 / キャンセル */}
            <div className="flex justify-between pt-4">
              <button
                onClick={() => setShowSaveForm(false)}
                className="px-4 py-2 bg-gray-300 rounded hover:bg-gray-400"
              >
                キャンセル
              </button>

              <button
                onClick={handleSave}
                className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
              >
                保存する
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ResultsScreen;
