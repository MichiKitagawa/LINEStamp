import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import { useAuth } from '@/hooks/useAuth';

interface ConsumeTokensResponse {
  success: boolean;
  remainingBalance: number;
}

interface GenerateStampResponse {
  stampId: string;
  status: string;
}

interface StampStatusResponse {
  stampId: string;
  status: string;
  retryCount: number;
  presetId?: string;
  createdAt: string;
  updatedAt: string;
}

interface GeneratingPageState {
  status: 'loading' | 'consuming_tokens' | 'generating' | 'completed' | 'error';
  message: string;
  error?: string;
}

export default function GeneratingPage() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const { stampId } = router.query;
  
  const [state, setState] = useState<GeneratingPageState>({
    status: 'loading',
    message: 'プロセスを準備中...'
  });
  
  const [pollingInterval, setPollingInterval] = useState<NodeJS.Timeout | null>(null);

  // トークン消費とスタンプ生成開始
  const startGeneration = async (stampId: string) => {
    try {
      setState({
        status: 'consuming_tokens',
        message: 'トークンを消費中...'
      });

      // Step 1: トークンを消費（5トークン × 8画像 = 40トークン）
      const consumeResponse = await fetch('/api/tokens/consume', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${await user?.getIdToken()}`,
        },
        body: JSON.stringify({
          stampId,
          amount: 40, // 5トークン × 8画像
        }),
      });

      if (!consumeResponse.ok) {
        const errorData = await consumeResponse.json();
        throw new Error(errorData.message || 'トークンの消費に失敗しました');
      }

      const consumeData: ConsumeTokensResponse = await consumeResponse.json();
      console.log('Tokens consumed successfully:', consumeData);

      setState({
        status: 'generating',
        message: 'スタンプを生成中...'
      });

      // Step 2: スタンプ生成を開始
      const generateResponse = await fetch('/api/stamps/generate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${await user?.getIdToken()}`,
        },
        body: JSON.stringify({ stampId }),
      });

      if (!generateResponse.ok) {
        const errorData = await generateResponse.json();
        throw new Error(errorData.message || 'スタンプ生成の開始に失敗しました');
      }

      const generateData: GenerateStampResponse = await generateResponse.json();
      console.log('Stamp generation started:', generateData);

      // Step 3: ステータスをポーリング開始
      startStatusPolling(stampId);

    } catch (error) {
      console.error('Generation start error:', error);
      setState({
        status: 'error',
        message: 'エラーが発生しました',
        error: error instanceof Error ? error.message : '不明なエラー'
      });
    }
  };

  // ステータスポーリング
  const startStatusPolling = (stampId: string) => {
    const pollStatus = async () => {
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
        console.log('Current status:', data.status);

        if (data.status === 'generated') {
          // 生成完了 → プレビュー画面へ遷移
          if (pollingInterval) {
            clearInterval(pollingInterval);
          }
          setState({
            status: 'completed',
            message: '生成が完了しました！プレビュー画面に移動します...'
          });
          
          setTimeout(() => {
            router.push(`/preview/${stampId}`);
          }, 2000);

        } else if (data.status === 'failed') {
          // 生成失敗 → エラー画面へ遷移
          if (pollingInterval) {
            clearInterval(pollingInterval);
          }
          router.push(`/error/${stampId}`);

        } else if (data.status === 'generating') {
          // 生成中 → 継続してポーリング
          setState({
            status: 'generating',
            message: 'スタンプを生成中です...しばらくお待ちください'
          });
        }

      } catch (error) {
        console.error('Status polling error:', error);
        setState({
          status: 'error',
          message: 'ステータスの確認でエラーが発生しました',
          error: error instanceof Error ? error.message : '不明なエラー'
        });
        
        if (pollingInterval) {
          clearInterval(pollingInterval);
        }
      }
    };

    // 1秒間隔でポーリング
    const interval = setInterval(pollStatus, 1000);
    setPollingInterval(interval);
    
    // 初回実行
    pollStatus();
  };

  // 初期化処理
  useEffect(() => {
    if (authLoading || !user || !stampId) {
      return;
    }

    if (typeof stampId !== 'string') {
      setState({
        status: 'error',
        message: '無効なスタンプIDです',
        error: 'Invalid stampId'
      });
      return;
    }

    startGeneration(stampId);

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
              スタンプ生成中
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
              <p className="text-lg text-gray-700 mb-2">{state.message}</p>
              
              {state.error && (
                <div className="bg-red-50 border border-red-200 rounded-md p-4 mt-4">
                  <div className="flex">
                    <div className="flex-shrink-0">
                      <svg className="h-5 w-5 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
                      </svg>
                    </div>
                    <div className="ml-3">
                      <p className="text-sm text-red-700">{state.error}</p>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* プロセス説明 */}
            {state.status !== 'error' && state.status !== 'completed' && (
              <div className="bg-blue-50 border border-blue-200 rounded-md p-4">
                <div className="text-sm text-blue-700">
                  <p className="mb-2">📋 処理の流れ</p>
                  <ol className="list-decimal list-inside text-left space-y-1">
                    <li className={state.status === 'consuming_tokens' ? 'font-semibold' : 'opacity-60'}>
                      トークンを消費（40トークン）
                    </li>
                    <li className={state.status === 'generating' ? 'font-semibold' : 'opacity-60'}>
                      AIがスタンプ画像を生成（8枚）
                    </li>
                    <li className="opacity-60">プレビュー画面で確認</li>
                  </ol>
                </div>
              </div>
            )}

            {/* アクションボタン */}
            {state.status === 'error' && (
              <div className="mt-8 space-x-4">
                <button
                  onClick={() => router.push('/dashboard')}
                  className="px-6 py-3 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors"
                >
                  ダッシュボードに戻る
                </button>
                <button
                  onClick={() => startGeneration(stampId as string)}
                  className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                >
                  再試行
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
                ⚠️ 生成処理中はブラウザを閉じないでください。処理には数分かかる場合があります。
              </p>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
} 