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

interface StatusPageState {
  status: 'loading' | 'polling' | 'completed' | 'error';
  stampStatus: string;
  retryCount: number;
  currentStep: number;
  error?: string | undefined;
}

// 申請プロセスのステップ
const SUBMISSION_STEPS = [
  'Puppeteer 起動中...',
  'Chromium ブラウザを起動しています...',
  'LINE Creators Market にアクセス中...',
  'LINEアカウントでログイン中...',
  'スタンプ申請フォームを開いています...',
  'メタデータを入力中...',
  '画像をアップロード中...',
  'フォームを送信中...',
  '申請完了！'
];

export default function StatusPage() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const { stampId } = router.query;
  
  const [state, setState] = useState<StatusPageState>({
    status: 'loading',
    stampStatus: '',
    retryCount: 0,
    currentStep: 0
  });
  
  const [pollingInterval, setPollingInterval] = useState<NodeJS.Timeout | null>(null);

  // ステータスをポーリング
  const pollStatus = async (stampId: string) => {
    try {
      const response = await fetch(`${process.env['NEXT_PUBLIC_API_BASE_URL']}/stamps/${stampId}/status`, {
        headers: {
          'Authorization': `Bearer ${await user?.getIdToken()}`,
        },
      });

      if (!response.ok) {
        throw new Error('ステータスの取得に失敗しました');
      }

      const data: StampStatusResponse = await response.json();
      console.log('Current status:', data.status);

      setState(prev => ({
        ...prev,
        stampStatus: data.status,
        retryCount: data.retryCount
      }));

      if (data.status === 'submitted') {
        // 申請完了 → 成功画面へ遷移
        if (pollingInterval) {
          clearInterval(pollingInterval);
        }
        
        setState(prev => ({
          ...prev,
          status: 'completed',
          currentStep: SUBMISSION_STEPS.length - 1
        }));
        
        setTimeout(() => {
          router.push(`/success/${stampId}`);
        }, 3000);

      } else if (data.status === 'failed') {
        // 申請失敗 → エラー画面へ遷移
        if (pollingInterval) {
          clearInterval(pollingInterval);
        }
        router.push(`/error/${stampId}`);

      } else if (data.status === 'session_expired') {
        // セッション切れ → 再認証画面へ遷移
        if (pollingInterval) {
          clearInterval(pollingInterval);
        }
        router.push(`/relogin/${stampId}`);

      } else if (data.status === 'submitting') {
        // 申請中 → 継続してポーリング、ステップを進める
        setState(prev => ({
          ...prev,
          status: 'polling',
          currentStep: Math.min(prev.currentStep + 1, SUBMISSION_STEPS.length - 2)
        }));
      }

    } catch (error) {
      console.error('Status polling error:', error);
      setState(prev => ({
        ...prev,
        status: 'error',
        error: error instanceof Error ? error.message : '不明なエラー'
      }));
      
      if (pollingInterval) {
        clearInterval(pollingInterval);
      }
    }
  };

  // ポーリング開始
  const startStatusPolling = (stampId: string) => {
    // 1.5秒間隔でポーリング
    const interval = setInterval(() => pollStatus(stampId), 1500);
    setPollingInterval(interval);
    
    // 初回実行
    pollStatus(stampId);
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
        currentStep: 0,
        error: '無効なスタンプIDです'
      });
      return;
    }

    setState(prev => ({ ...prev, status: 'polling' }));
    startStatusPolling(stampId);

    // クリーンアップ
    return () => {
      if (pollingInterval) {
        clearInterval(pollingInterval);
      }
    };
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
          </div>
        </div>
      </header>

      {/* メインコンテンツ */}
      <main className="max-w-4xl mx-auto py-12 px-4 sm:px-6 lg:px-8">
        <div className="bg-white rounded-lg shadow p-8">
          <div className="text-center">
            <h2 className="text-2xl font-bold text-gray-900 mb-8">
              申請進捗状況
            </h2>

            {/* プログレスインジケータ */}
            <div className="mb-8">
              {state.status === 'error' ? (
                <div className="w-16 h-16 mx-auto mb-4 bg-red-100 rounded-full flex items-center justify-center">
                  <svg className="w-8 h-8 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </div>
              ) : state.status === 'completed' ? (
                <div className="w-16 h-16 mx-auto mb-4 bg-green-100 rounded-full flex items-center justify-center">
                  <svg className="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                </div>
              ) : (
                <div className="w-16 h-16 mx-auto mb-4">
                  <div className="animate-spin rounded-full h-16 w-16 border-4 border-blue-200 border-t-blue-600"></div>
                </div>
              )}
            </div>

            {/* ステータスメッセージ */}
            <div className="mb-8">
              {state.status === 'error' ? (
                <div>
                  <p className="text-lg text-red-700 mb-2">エラーが発生しました</p>
                  {state.error && (
                    <p className="text-sm text-red-600">{state.error}</p>
                  )}
                </div>
              ) : state.status === 'completed' ? (
                <div>
                  <p className="text-lg text-green-700 mb-2">申請が完了しました！</p>
                  <p className="text-sm text-gray-600">成功画面に移動します...</p>
                </div>
              ) : (
                <div>
                  <p className="text-lg text-gray-700 mb-2">
                    LINE Creators Market に申請中...
                  </p>
                  <p className="text-sm text-gray-600">
                    {state.retryCount > 0 && `再試行 ${state.retryCount}回目 - `}
                    しばらくお待ちください
                  </p>
                </div>
              )}
            </div>

            {/* プロセスログ */}
            {(state.status === 'polling' || state.status === 'completed') && (
              <div className="bg-gray-50 border border-gray-200 rounded-md p-6 mb-8">
                <div className="text-sm text-gray-700">
                  <p className="mb-4 font-semibold text-gray-900">📋 申請プロセス</p>
                  <div className="text-left space-y-2">
                    {SUBMISSION_STEPS.map((step, index) => (
                      <div
                        key={index}
                        className={`flex items-center ${
                          index <= state.currentStep 
                            ? 'text-green-700' 
                            : 'text-gray-400'
                        }`}
                      >
                        <div className="mr-3">
                          {index < state.currentStep ? (
                            <svg className="w-4 h-4 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                            </svg>
                          ) : index === state.currentStep ? (
                            <div className="w-4 h-4 border-2 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
                          ) : (
                            <div className="w-4 h-4 border-2 border-gray-300 rounded-full"></div>
                          )}
                        </div>
                        <span className={index === state.currentStep ? 'font-semibold' : ''}>
                          {step}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* エラー時のアクションボタン */}
            {state.status === 'error' && (
              <div className="space-x-4">
                <button
                  onClick={() => router.push('/dashboard')}
                  className="px-6 py-3 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors"
                >
                  ダッシュボードに戻る
                </button>
                <button
                  onClick={() => {
                    setState(prev => ({ ...prev, status: 'polling', error: undefined }));
                    startStatusPolling(stampId as string);
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
                ⚠️ 申請処理中はブラウザを閉じないでください。処理には数分かかる場合があります。
              </p>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
} 