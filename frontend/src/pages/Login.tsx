import React, { useState } from 'react';
import LoginScreen from '../components/LoginScreen';

export default function Login() {
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const handleLogin = async (email: string, password: string) => {
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || data.message || 'ログイン失敗');

      localStorage.setItem('access_token', data.access_token);
      localStorage.setItem('refresh_token', data.refresh_token);
      setMessage('ログイン成功！');
      window.location.href = '/meeting';
    } catch (err: any) {
      setError(err.message);
    }
  };

  const handleSignUp = async (email: string, password: string) => {
    try {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || data.message || '登録失敗');

      setMessage('登録成功！メールを確認してください');
    } catch (err: any) {
      setError(err.message);
    }
  };

  return (
    <LoginScreen
      onLogin={handleLogin}
      onSignUp={handleSignUp}
      onError={setError}
      setAuthMessage={setMessage}
      message={message}
    />
  );
}
