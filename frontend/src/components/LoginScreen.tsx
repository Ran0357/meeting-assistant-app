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
    <div className="w-full max-w-md mx-auto mt-20 p-8 border border-gray-200 rounded-lg shadow-sm bg-white">
      <div className="text-center mb-8">
        <h1 className="text-2xl font-semibold text-gray-900 mb-2">
          会議アシスタントシステム
        </h1>
        <p className="text-sm text-gray-600">
          {mode === 'login' ? 'システムにログイン' : 'アカウント新規登録'}
        </p>
      </div>

      {message && (
        <div className="mb-4 p-3 bg-green-50 border border-green-200 text-green-800 rounded text-sm">
          {message}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-5">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">メールアドレス</label>
          <input
            type="email"
            autoComplete="email"
            required
            value={email}
            onChange={e => setEmail(e.target.value)}
            className="block w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            placeholder="user@example.com"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">パスワード</label>
          <input
            type="password"
            autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
            required
            value={password}
            onChange={e => setPassword(e.target.value)}
            className="block w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            placeholder="パスワードを入力"
          />
        </div>

        {mode === 'signup' && (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">パスワード（確認）</label>
            <input
              type="password"
              autoComplete="new-password"
              required
              value={confirmPassword}
              onChange={e => setConfirmPassword(e.target.value)}
              className="block w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="パスワードを再入力"
            />
          </div>
        )}

        <div className="pt-2">
          <button
            type="submit"
            disabled={isLoading}
            className="w-full flex justify-center py-2.5 px-4 border border-transparent rounded-md text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
          >
            {isLoading ? <Spinner /> : mode === 'login' ? 'ログイン' : '登録する'}
          </button>
        </div>
      </form>

      <div className="mt-6 pt-6 border-t border-gray-200">
        <p className="text-center text-sm text-gray-600">
          {mode === 'login' ? 'アカウントをお持ちでないですか？' : 'すでにアカウントをお持ちですか？'}
        </p>
        <button
          onClick={() => handleModeChange(mode === 'login' ? 'signup' : 'login')}
          className="mt-2 w-full py-2 px-4 border border-gray-300 rounded-md text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors"
        >
          {mode === 'login' ? '新規登録はこちら' : 'ログインはこちら'}
        </button>
      </div>
    </div>
  );
};

export default LoginScreen;
