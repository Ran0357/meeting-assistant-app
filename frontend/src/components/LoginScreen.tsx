import React, { useState } from 'react';
import { Spinner } from './Spinner';

interface LoginScreenProps {
  onLogin: (email: string, pass: string) => Promise<void>;
  onSignUp: (email: string, pass: string) => Promise<void>;
  onError: (error: string | null) => void;
  setAuthMessage: (message: string | null) => void;
  message?: string | null;
  error?: string | null;
}

const LoginScreen: React.FC<LoginScreenProps> = ({
  onLogin,
  onSignUp,
  onError,
  setAuthMessage,
  message,
  error,
}) => {
  const [mode, setMode] = useState<'login' | 'signup'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleModeChange = (newMode: 'login' | 'signup') => {
    setMode(newMode);
    onError(null);
    setAuthMessage(null);
    setPassword('');
    setConfirmPassword('');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    onError(null);
    setAuthMessage(null);

    // --- フロントエンド・バリデーション ---
    if (password.length < 6) {
      onError('パスワードは6文字以上で入力してください。');
      return;
    }

    if (mode === 'signup' && password !== confirmPassword) {
      onError('パスワード（確認用）が一致しません。');
      return;
    }

    setIsLoading(true);
    try {
      if (mode === 'login') {
        await onLogin(email, password);
      } else {
        // 新規登録実行
        await onSignUp(email, password);
        // ★ 登録成功時：ログインモードに切り替え、パスワードをリセット
        setMode('login');
        setPassword('');
        setConfirmPassword('');
      }
    } catch (err: any) {
      // エラー処理は親(Login.tsx)で行われるため、ここではisLoadingの解除のみ
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="w-full max-w-md mx-auto mt-20 p-8 border border-gray-200 rounded-lg shadow-sm bg-white">
      <div className="text-center mb-8">
        <h1 className="text-2xl font-semibold text-gray-900 mb-2">会議アシスタントシステム</h1>
        <p className="text-sm text-gray-600">
          {mode === 'login' ? 'システムにログイン' : 'アカウント新規登録'}
        </p>
      </div>

      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-800 rounded text-sm">
          {error}
        </div>
      )}

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
            required
            value={email}
            onChange={e => setEmail(e.target.value)}
            className="block w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-blue-500 outline-none"
            placeholder="user@example.com"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">パスワード</label>
          <input
            type="password"
            required
            value={password}
            onChange={e => setPassword(e.target.value)}
            className="block w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-blue-500 outline-none"
            placeholder="6文字以上で入力"
          />
        </div>

        {mode === 'signup' && (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">パスワード（確認）</label>
            <input
              type="password"
              required
              value={confirmPassword}
              onChange={e => setConfirmPassword(e.target.value)}
              className="block w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-blue-500 outline-none"
              placeholder="再入力してください"
            />
          </div>
        )}

        <button
          type="submit"
          disabled={isLoading}
          className="w-full flex justify-center py-2.5 px-4 rounded-md text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 transition-colors"
        >
          {isLoading ? <Spinner /> : mode === 'login' ? 'ログイン' : '登録する'}
        </button>
      </form>

      <div className="mt-6 pt-6 border-t border-gray-200 text-center">
        <p className="text-sm text-gray-600 mb-2">
          {mode === 'login' ? 'アカウントをお持ちでないですか？' : 'すでにアカウントをお持ちですか？'}
        </p>
        <button
          type="button"
          onClick={() => handleModeChange(mode === 'login' ? 'signup' : 'login')}
          className="text-sm font-medium text-blue-600 hover:underline"
        >
          {mode === 'login' ? '新規登録はこちら' : 'ログインはこちら'}
        </button>
      </div>
    </div>
  );
};

export default LoginScreen;