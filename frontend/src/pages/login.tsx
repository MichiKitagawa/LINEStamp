import { useEffect } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';
import { useAuth } from '@/hooks/useAuth';

export default function LoginPage() {
  const { user, loading, error, signInWithGoogle, clearError } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (user && !loading) {
      router.push('/dashboard');
    }
  }, [user, loading, router]);

  const handleGoogleLogin = async () => {
    await signInWithGoogle();
  };

  if (loading) {
    return (
      <>
        <Head>
          <title>ログイン - LINE スタンプ自動生成システム</title>
        </Head>
        <div className="min-h-screen flex items-center justify-center bg-gray-50">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
        </div>
      </>
    );
  }

  return (
    <>
      <Head>
        <title>ログイン - LINE スタンプ自動生成システム</title>
      </Head>
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary-50 to-secondary-50">
        <div className="max-w-md w-full space-y-8 p-8">
          <div className="text-center">
            <h1 className="text-4xl font-bold text-gray-900 mb-2">
              LINE スタンプ
              <br />
              自動生成システム
            </h1>
            <p className="text-gray-600">
              AIでオリジナルスタンプを作成し、
              <br />
              LINE Creators Marketに自動申請
            </p>
          </div>

          <div className="mt-8 space-y-6">
            <div className="bg-white rounded-lg shadow-md p-6">
              <div className="space-y-4">
                {/* エラーメッセージ */}
                {error && (
                  <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
                    <div className="flex items-center">
                      <div className="text-red-600 mr-2">⚠️</div>
                      <div className="text-sm text-red-700">{error}</div>
                    </div>
                    <button
                      onClick={clearError}
                      className="mt-2 text-xs text-red-600 hover:text-red-800 underline"
                    >
                      エラーを閉じる
                    </button>
                  </div>
                )}

                <button
                  onClick={handleGoogleLogin}
                  disabled={loading}
                  className="w-full flex justify-center items-center px-4 py-3 border border-transparent text-base font-medium rounded-lg text-white bg-primary-600 hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors duration-200"
                >
                  {loading ? (
                    <div className="flex items-center">
                      <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-2"></div>
                      認証中...
                    </div>
                  ) : (
                    <div className="flex items-center">
                      <svg className="w-5 h-5 mr-2" viewBox="0 0 24 24">
                        <path
                          fill="currentColor"
                          d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                        />
                        <path
                          fill="currentColor"
                          d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                        />
                        <path
                          fill="currentColor"
                          d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                        />
                        <path
                          fill="currentColor"
                          d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                        />
                      </svg>
                      Google でログイン
                    </div>
                  )}
                </button>

                <div className="text-center">
                  <p className="text-sm text-gray-500">
                    ログインすることで、
                    <a href="#" className="text-primary-600 hover:text-primary-500">
                      利用規約
                    </a>
                    と
                    <a href="#" className="text-primary-600 hover:text-primary-500">
                      プライバシーポリシー
                    </a>
                    に同意したものとみなされます。
                  </p>
                </div>
              </div>
            </div>

            <div className="text-center">
              <div className="bg-white rounded-lg shadow-sm p-4">
                <h3 className="font-semibold text-gray-900 mb-2">✨ 主な機能</h3>
                <ul className="text-sm text-gray-600 space-y-1">
                  <li>• オリジナル画像からスタンプ生成</li>
                  <li>• LINE Creators Marketへ自動申請</li>
                  <li>• 申請状況のリアルタイム追跡</li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
} 