import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import { useAuth } from '@/hooks/useAuth';

interface SubmitStampResponse {
  stampId: string;
  status: string;
}

interface ReloginPageState {
  status: 'waitingLogin' | 'resubmitting' | 'success' | 'failure';
  countdown: number;
  error?: string;
}

export default function ReloginPage() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const { stampId } = router.query;
  
  const [state, setState] = useState<ReloginPageState>({
    status: 'waitingLogin',
    countdown: 5
  });

  // カウントダウンとリログイン処理
  useEffect(() => {
    if (state.status !== 'waitingLogin' || state.countdown <= 0) {
      return;
    }

    const timer = setTimeout(() => {
      if (state.countdown === 1) {
        // カウントダウン終了 → 再申請開始
        handleAutoResubmit();
      } else {
        setState(prev => ({ ...prev, countdown: prev.countdown - 1 }));
      }
    }, 1000);

    return () => clearTimeout(timer);
  }, [state.status, state.countdown]);

  // 自動再申請処理
  const handleAutoResubmit = async () => {
    if (!stampId || typeof stampId !== 'string') return;

    setState(prev => ({ ...prev, status: 'resubmitting' }));

    try {
      const response = await fetch('/api/stamps/submit', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${await user?.getIdToken()}`,
        },
        body: JSON.stringify({ stampId }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || '再申請の開始に失敗しました');
      }

      const data: SubmitStampResponse = await response.json();
      console.log('Auto resubmission started:', data);

      setState(prev => ({ ...prev, status: 'success' }));

      // 申請進捗画面へ遷移
      setTimeout(() => {
        router.push(`/status/${stampId}`);
      }, 2000);

    } catch (error) {
      console.error('Auto resubmission error:', error);
      setState({
        status: 'failure',
        countdown: 0,
        error: error instanceof Error ? error.message : '再申請でエラーが発生しました'
      });
    }
  };

  // キャンセル
  const handleCancel = () => {
    router.push(`/error/${stampId}`);
  };

  // ダッシュボードへ戻る
  const handleBackToDashboard = () => {
    router.push('/dashboard');
  };

  // 認証チェック
  useEffect(() => {
    if (!authLoading && !user) {
      router.push('/login');
    }
  }, [authLoading, user, router]);

  // ローディング中
  if (authLoading || !user) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">認証を確認中...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* ヘッダー */}
      <header className="bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-6">
            <div className="flex items-center">
              <h1 className="text-2xl font-bold text-gray-900">
                LINEスタンプ自動生成
              </h1>
            </div>
            <nav className="flex space-x-4">
              <button
                onClick={handleBackToDashboard}
                className="text-gray-600 hover:text-gray-900"
              >
                ダッシュボード
              </button>
            </nav>
          </div>
        </div>
      </header>

      {/* メインコンテンツ */}
      <main className="max-w-4xl mx-auto py-12 px-4 sm:px-6 lg:px-8">
        <div className="bg-white rounded-lg shadow p-8">
          <div className="text-center">
            
            {state.status === 'waitingLogin' && (
              <>
                {/* LINEアイコン */}
                <div className="w-16 h-16 mx-auto mb-6 bg-green-100 rounded-full flex items-center justify-center">
                  <svg className="w-10 h-10 text-green-600" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M12.017 0C5.396 0 .029 4.583.029 10.253c0 3.253 1.627 6.167 4.179 8.034L3.5 24l6.197-3.245C10.471 21.126 11.226 21.253 12.017 21.253c6.623 0 11.99-4.583 11.99-10.253C24.007 4.583 18.64.001 12.017.001zm-.005 18.506c-.964 0-1.908-.184-2.784-.531L5.5 19.5l1.824-2.688c-1.508-1.177-2.549-2.956-2.549-4.995 0-4.583 4.056-8.253 9.237-8.253s9.237 3.67 9.237 8.253-4.056 8.253-9.237 8.253z"/>
                  </svg>
                </div>

                <h2 className="text-2xl font-bold text-gray-900 mb-4">
                  LINE 再ログイン
                </h2>
                
                <div className="mb-8">
                  <p className="text-gray-600 mb-4">
                    LINEにログインしてください
                  </p>
                  
                  {/* モックLINEログインフォーム */}
                  <div className="bg-green-50 border border-green-200 rounded-lg p-6 mb-6 max-w-md mx-auto">
                    <div className="space-y-4">
                      <div className="text-center">
                        <div className="w-12 h-12 bg-green-500 rounded-full flex items-center justify-center mx-auto mb-3">
                          <svg className="w-8 h-8 text-white" fill="currentColor" viewBox="0 0 24 24">
                            <path d="M12.017 0C5.396 0 .029 4.583.029 10.253c0 3.253 1.627 6.167 4.179 8.034L3.5 24l6.197-3.245C10.471 21.126 11.226 21.253 12.017 21.253c6.623 0 11.99-4.583 11.99-10.253C24.007 4.583 18.64.001 12.017.001z"/>
                          </svg>
                        </div>
                        <p className="text-sm font-semibold text-green-700">LINE ログイン画面</p>
                        <p className="text-xs text-green-600 mt-2">（モック表示）</p>
                      </div>
                      
                      <div className="space-y-3">
                        <div className="bg-white rounded border p-3">
                          <p className="text-xs text-gray-500 mb-1">メールアドレス</p>
                          <div className="h-4 bg-gray-200 rounded animate-pulse"></div>
                        </div>
                        <div className="bg-white rounded border p-3">
                          <p className="text-xs text-gray-500 mb-1">パスワード</p>
                          <div className="h-4 bg-gray-200 rounded animate-pulse"></div>
                        </div>
                        <div className="bg-green-500 text-white rounded p-2 text-sm font-semibold">
                          ログイン中...
                        </div>
                      </div>
                    </div>
                  </div>

                  <p className="text-green-700 font-semibold mb-2">
                    ログイン完了後、自動で申請を再開します
                  </p>
                  
                  <div className="text-lg font-mono text-blue-600">
                    {state.countdown}秒後に自動再開
                  </div>
                </div>

                <button
                  onClick={handleCancel}
                  className="px-6 py-3 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors"
                >
                  キャンセル
                </button>
              </>
            )}

            {state.status === 'resubmitting' && (
              <>
                <div className="w-16 h-16 mx-auto mb-6">
                  <div className="animate-spin rounded-full h-16 w-16 border-4 border-blue-200 border-t-blue-600"></div>
                </div>
                
                <h2 className="text-2xl font-bold text-gray-900 mb-4">
                  申請を再開中...
                </h2>
                
                <p className="text-gray-600">
                  LINEログインが完了しました。申請を再開しています。
                </p>
              </>
            )}

            {state.status === 'success' && (
              <>
                <div className="w-16 h-16 mx-auto mb-6 bg-green-100 rounded-full flex items-center justify-center">
                  <svg className="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                </div>
                
                <h2 className="text-2xl font-bold text-green-700 mb-4">
                  申請再開完了
                </h2>
                
                <p className="text-gray-600 mb-4">
                  申請が正常に再開されました。進捗画面に移動します...
                </p>
              </>
            )}

            {state.status === 'failure' && (
              <>
                <div className="w-16 h-16 mx-auto mb-6 bg-red-100 rounded-full flex items-center justify-center">
                  <svg className="w-8 h-8 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </div>
                
                <h2 className="text-2xl font-bold text-red-700 mb-4">
                  再申請に失敗しました
                </h2>
                
                <p className="text-gray-600 mb-6">
                  {state.error}
                </p>

                <div className="space-x-4">
                  <button
                    onClick={handleCancel}
                    className="px-6 py-3 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors"
                  >
                    エラー画面に戻る
                  </button>
                  <button
                    onClick={() => {
                      setState({ status: 'waitingLogin', countdown: 5 });
                    }}
                    className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                  >
                    再試行
                  </button>
                </div>
              </>
            )}
          </div>
        </div>

        {/* 注意事項 */}
        <div className="mt-8 bg-blue-50 border border-blue-200 rounded-md p-4">
          <div className="flex">
            <div className="flex-shrink-0">
              <svg className="h-5 w-5 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <div className="ml-3">
              <p className="text-sm text-blue-700">
                💡 これはLINEログインのモック画面です。実際の環境では、LINEの認証画面が表示されます。
                カウントダウン終了後、自動的に申請が再開されます。
              </p>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
} 