import React, { useState } from 'react';
import { Spinner } from './Spinner';

interface LoginScreenProps {
  onLogin: (email: string, pass: string) => Promise<void>;
  onSignUp: (email: string, pass: string) => Promise<void>;
  onError: (error: string | null) => void;
  setAuthMessage: (message: string | null) => void;
  message?: string | null;
}

const LoginScreen: React.FC<LoginScreenProps> = ({ onLogin, onSignUp, onError, setAuthMessage, message }) => {
  const [mode, setMode] = useState<'login' | 'signup'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleModeChange = (newMode: 'login' | 'signup') => {
    setMode(newMode);
    setEmail('');
    setPassword('');
    setConfirmPassword('');
    onError(null);
    setAuthMessage(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    onError(null);
    setAuthMessage(null);

    if (mode === 'signup' && password !== confirmPassword) {
      onError('パスワードが一致しません。');
      return;
    }

    setIsLoading(true);
    try {
      if (mode === 'login') {
        await onLogin(email, password);
      } else {
        await onSignUp(email, password);
        setMode('login'); // 登録成功後はログインモードに
      }
    } catch (error) {
      // エラーは親コンポーネントで処理
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="w-full max-w-md mx-auto mt-20 p-6 border rounded-lg shadow-md bg-white">
      <h2 className="text-3xl font-bold text-center mb-6 text-slate-800">
        {mode === 'login' ? 'ログイン' : '新規登録'}
      </h2>

      {message && (
        <div className="mb-4 text-center p-3 bg-green-100 border border-green-400 text-green-700 rounded-lg">
          {message}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-slate-700">メールアドレス</label>
          <input
            type="email"
            autoComplete="email"
            required
            value={email}
            onChange={e => setEmail(e.target.value)}
            className="mt-1 block w-full px-3 py-2 border border-slate-300 rounded-md shadow-sm placeholder-slate-400 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700">パスワード</label>
          <input
            type="password"
            autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
            required
            value={password}
            onChange={e => setPassword(e.target.value)}
            className="mt-1 block w-full px-3 py-2 border border-slate-300 rounded-md shadow-sm placeholder-slate-400 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
          />
        </div>

        {mode === 'signup' && (
          <div>
            <label className="block text-sm font-medium text-slate-700">パスワード（確認）</label>
            <input
              type="password"
              autoComplete="new-password"
              required
              value={confirmPassword}
              onChange={e => setConfirmPassword(e.target.value)}
              className="mt-1 block w-full px-3 py-2 border border-slate-300 rounded-md shadow-sm placeholder-slate-400 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
            />
          </div>
        )}

        <div>
          <button
            type="submit"
            disabled={isLoading}
            className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:bg-slate-400"
          >
            {isLoading ? <Spinner /> : mode === 'login' ? 'ログイン' : '登録する'}
          </button>
        </div>
      </form>

      <p className="mt-6 text-center text-sm text-slate-600">
        {mode === 'login' ? 'アカウントをお持ちでないですか？' : 'すでにアカウントをお持ちですか？'}{' '}
        <button
          onClick={() => handleModeChange(mode === 'login' ? 'signup' : 'login')}
          className="font-medium text-blue-600 hover:text-blue-500"
        >
          {mode === 'login' ? '新規登録' : 'ログイン'}
        </button>
      </p>
    </div>
  );
};

export default LoginScreen;
