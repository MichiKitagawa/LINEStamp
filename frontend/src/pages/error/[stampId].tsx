import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import { useAuth } from '@/hooks/useAuth';

interface StampStatusResponse {
  stampId: string;
  status: string;
  retryCount: number;
  presetId?: string;
  createdAt: string;
  updatedAt: string;
}

interface RetryStampResponse {
  stampId: string;
  status: string;
  retryCount: number;
}

interface ErrorPageState {
  status: 'loading' | 'loaded' | 'retrying' | 'error';
  stampStatus: string;
  retryCount: number;
  error?: string;
}

export default function ErrorPage() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const { stampId } = router.query;
  
  const [state, setState] = useState<ErrorPageState>({
    status: 'loading',
    stampStatus: '',
    retryCount: 0
  });

  // スタンプステータスを取得
  const fetchStampStatus = async (stampId: string) => {
    try {
      const response = await fetch(`/api/stamps/${stampId}/status`, {
        headers: {
          'Authorization': `Bearer ${await user?.getIdToken()}`,
        },
      });

      if (!response.ok) {
        throw new Error('ステータスの取得に失敗しました');
      }

      const data: StampStatusResponse = await response.json();
      
      setState({
        status: 'loaded',
        stampStatus: data.status,
        retryCount: data.retryCount,
      });

    } catch (error) {
      console.error('Status fetch error:', error);
      setState({
        status: 'error',
        stampStatus: '',
        retryCount: 0,
        error: error instanceof Error ? error.message : '不明なエラー'
      });
    }
  };

  // 再申請を実行
  const handleRetry = async () => {
    if (!stampId || typeof stampId !== 'string') return;

    setState(prev => ({ ...prev, status: 'retrying' }));

    try {
      const response = await fetch('/api/stamps/retry', {
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

      const data: RetryStampResponse = await response.json();
      console.log('Retry started:', data);

      // 申請進捗画面へ遷移
      router.push(`/status/${stampId}`);

    } catch (error) {
      console.error('Retry error:', error);
      setState(prev => ({
        ...prev,
        status: 'loaded',
        error: error instanceof Error ? error.message : '再申請でエラーが発生しました'
      }));
    }
  };

  // 再認証画面への遷移
  const handleRelogin = () => {
    router.push(`/relogin/${stampId}`);
  };

  // ダッシュボードへ戻る
  const handleBackToDashboard = () => {
    router.push('/dashboard');
  };

  // 初期化処理
  useEffect(() => {
    if (authLoading || !user || !stampId) {
      return;
    }

    if (typeof stampId !== 'string') {
      setState({
        status: 'error',
        stampStatus: '',
        retryCount: 0,
        error: '無効なスタンプIDです'
      });
      return;
    }

    fetchStampStatus(stampId);
  }, [authLoading, user, stampId]);

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

  // エラータイプの判定
  const getErrorType = () => {
    if (state.stampStatus === 'failed') {
      return 'submission_error';
    } else if (state.stampStatus === 'session_expired') {
      return 'session_expired';
    } else {
      return 'unknown_error';
    }
  };

  const errorType = getErrorType();

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
            {/* エラーアイコン */}
            <div className="w-16 h-16 mx-auto mb-6 bg-red-100 rounded-full flex items-center justify-center">
              <svg className="w-8 h-8 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </div>

            {/* エラーメッセージ */}
            <div className="mb-8">
              {state.status === 'loading' ? (
                <div>
                  <h2 className="text-2xl font-bold text-gray-900 mb-4">
                    情報を読み込み中...
                  </h2>
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
                </div>
              ) : state.status === 'error' ? (
                <div>
                  <h2 className="text-2xl font-bold text-red-700 mb-4">
                    エラーが発生しました
                  </h2>
                  <p className="text-gray-600">{state.error}</p>
                </div>
              ) : errorType === 'submission_error' ? (
                <div>
                  <h2 className="text-2xl font-bold text-red-700 mb-4">
                    申請エラー
                  </h2>
                  <p className="text-gray-600 mb-2">
                    LINE Creators Market への申請中にエラーが発生しました。
                  </p>
                  {state.retryCount > 0 && (
                    <p className="text-sm text-gray-500">
                      再試行回数: {state.retryCount}回
                    </p>
                  )}
                </div>
              ) : errorType === 'session_expired' ? (
                <div>
                  <h2 className="text-2xl font-bold text-orange-700 mb-4">
                    セッション切れ
                  </h2>
                  <p className="text-gray-600 mb-2">
                    LINE へのログインセッションが切れました。
                  </p>
                  <p className="text-gray-600">
                    再度LINEにログインしてから申請を再開してください。
                  </p>
                </div>
              ) : (
                <div>
                  <h2 className="text-2xl font-bold text-red-700 mb-4">
                    不明なエラー
                  </h2>
                  <p className="text-gray-600">
                    予期しないエラーが発生しました。
                  </p>
                </div>
              )}
            </div>

            {/* エラー詳細情報 */}
            {state.status === 'loaded' && (
              <div className="bg-gray-50 border border-gray-200 rounded-md p-4 mb-8">
                <div className="text-sm text-gray-700">
                  <p className="mb-2"><strong>スタンプID:</strong> {stampId}</p>
                  <p className="mb-2"><strong>ステータス:</strong> {state.stampStatus}</p>
                  <p><strong>再試行回数:</strong> {state.retryCount}回</p>
                </div>
              </div>
            )}

            {/* アクションボタン */}
            {(state.status === 'loaded' || state.status === 'retrying') && (
              <div className="space-y-4">
                {errorType === 'submission_error' && (
                  <button
                    onClick={handleRetry}
                    disabled={state.status === 'retrying'}
                    className="w-full sm:w-auto px-8 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {state.status === 'retrying' ? (
                      <>
                        <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white inline" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                        再申請中...
                      </>
                    ) : (
                      '再申請する'
                    )}
                  </button>
                )}

                {errorType === 'session_expired' && (
                  <button
                    onClick={handleRelogin}
                    className="w-full sm:w-auto px-8 py-3 bg-orange-600 text-white rounded-lg hover:bg-orange-700 transition-colors"
                  >
                    LINE再ログイン
                  </button>
                )}

                <div className="mt-6">
                  <button
                    onClick={handleBackToDashboard}
                    className="w-full sm:w-auto px-6 py-3 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors"
                  >
                    ダッシュボードへ戻る
                  </button>
                </div>
              </div>
            )}

            {/* エラー時のアクションボタン */}
            {state.status === 'error' && (
              <div className="space-x-4">
                <button
                  onClick={handleBackToDashboard}
                  className="px-6 py-3 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors"
                >
                  ダッシュボードに戻る
                </button>
                <button
                  onClick={() => {
                    setState({
                      status: 'loading',
                      stampStatus: '',
                      retryCount: 0
                    });
                    fetchStampStatus(stampId as string);
                  }}
                  className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                >
                  再確認
                </button>
              </div>
            )}
          </div>
        </div>

        {/* 注意事項 */}
        <div className="mt-8 bg-yellow-50 border border-yellow-200 rounded-md p-4">
          <div className="flex">
            <div className="flex-shrink-0">
              <svg className="h-5 w-5 text-yellow-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
              </svg>
            </div>
            <div className="ml-3">
              <p className="text-sm text-yellow-700">
                💡 エラーが継続する場合は、しばらく時間をおいてから再試行してください。
                問題が解決しない場合は、新しいスタンプを作成することをお勧めします。
              </p>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
} 