import React, { useState } from 'react';
import LoginScreen from '../components/LoginScreen';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL;

export default function Login() {
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const translateError = (data: any) => {
    // 1. Flaskから返ってくるJSONの中身（message または error）を抽出
    const rawMsg = data?.message || data?.error || (typeof data === 'string' ? data : '');
    const msg = rawMsg.toLowerCase();

    // 2. 日本語への翻訳
    if (msg.includes('at least 6 characters')) {
      return 'パスワードは6文字以上で入力してください。';
    }
    if (msg.includes('already registered') || msg.includes('already exists')) {
      return 'このメールアドレスは既に登録されています。';
    }
    if (msg.includes('invalid login credentials')) {
      return 'メールアドレスまたはパスワードが正しくありません。';
    }
    if (msg.includes('email') && (msg.includes('validate') || msg.includes('invalid'))) {
      return '有効なメールアドレスを入力してください。';
    }

    if (msg.includes('email not confirmed')) {
      return 'メールアドレスの確認が完了していません。届いたメールのリンクをクリックしてください。';
    }

    // 3. 該当しない場合は、元のメッセージがあるか確認し、なければ汎用メッセージ
    return rawMsg || '入力内容に誤りがあるか、登録できない形式です。';
  };

  const handleSignUp = async (email: string, password: string) => {
    setError(null);
    setMessage(null);
    try {
      const res = await fetch(`${API_BASE_URL}/api/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });

      const data = await res.json();

      if (!res.ok) {
        // ここで data (サーバーが返したJSON) をそのまま渡す
        throw new Error(translateError(data));
      }

      // 成功時
      setMessage('登録が完了しました。メールを確認してログインしてください。');
    } catch (err: any) {
      setError(err.message);
      throw err; // LoginScreen側のisLoadingを止めるために必要
    }
  };

  const handleLogin = async (email: string, password: string) => {
    setError(null);
    setMessage(null);
    try {
      const res = await fetch(`${API_BASE_URL}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(translateError(data));
      }

      localStorage.setItem('access_token', data.access_token);
      setMessage('ログインに成功しました！');
      window.location.href = '/meeting';
    } catch (err: any) {
      setError(err.message);
      throw err;
    }
  };

  return (
    <LoginScreen
      onLogin={handleLogin}
      onSignUp={handleSignUp}
      onError={setError}
      setAuthMessage={setMessage}
      message={message}
      error={error}
    />
  );
}