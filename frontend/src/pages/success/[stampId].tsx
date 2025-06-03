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

interface SuccessPageState {
  status: 'loading' | 'loaded' | 'error';
  stampData?: StampStatusResponse;
  error?: string;
}

export default function SuccessPage() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const { stampId } = router.query;
  
  const [state, setState] = useState<SuccessPageState>({
    status: 'loading'
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
        stampData: data,
      });

    } catch (error) {
      console.error('Status fetch error:', error);
      setState({
        status: 'error',
        error: error instanceof Error ? error.message : '不明なエラー'
      });
    }
  };

  // ダッシュボードへ戻る
  const handleBackToDashboard = () => {
    router.push('/dashboard');
  };

  // 新しいスタンプ作成
  const handleCreateNewStamp = () => {
    router.push('/upload');
  };

  // 初期化処理
  useEffect(() => {
    if (authLoading || !user || !stampId) {
      return;
    }

    if (typeof stampId !== 'string') {
      setState({
        status: 'error',
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
            
            {state.status === 'loading' && (
              <div>
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
                <h2 className="text-2xl font-bold text-gray-900 mb-4">
                  情報を読み込み中...
                </h2>
              </div>
            )}

            {state.status === 'error' && (
              <>
                <div className="w-16 h-16 mx-auto mb-6 bg-red-100 rounded-full flex items-center justify-center">
                  <svg className="w-8 h-8 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </div>
                
                <h2 className="text-2xl font-bold text-red-700 mb-4">
                  エラーが発生しました
                </h2>
                
                <p className="text-gray-600 mb-6">{state.error}</p>

                <div className="space-x-4">
                  <button
                    onClick={handleBackToDashboard}
                    className="px-6 py-3 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors"
                  >
                    ダッシュボードに戻る
                  </button>
                </div>
              </>
            )}

            {state.status === 'loaded' && (
              <>
                {/* 成功アイコン */}
                <div className="w-20 h-20 mx-auto mb-6 bg-green-100 rounded-full flex items-center justify-center">
                  <svg className="w-12 h-12 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                </div>

                <h2 className="text-3xl font-bold text-green-700 mb-4">
                  🎉 申請完了！
                </h2>
                
                <div className="mb-8">
                  <p className="text-lg text-gray-700 mb-4">
                    LINE Creators Market への申請が正常に完了しました！
                  </p>
                  <p className="text-gray-600 mb-6">
                    申請が受理されるまで数日かかる場合があります。<br />
                    LINE Creators Market からの通知をお待ちください。
                  </p>
                </div>

                {/* 申請詳細情報 */}
                <div className="bg-green-50 border border-green-200 rounded-md p-6 mb-8 max-w-md mx-auto">
                  <div className="text-sm text-green-800">
                    <p className="mb-2 font-semibold">📋 申請詳細</p>
                    <div className="text-left space-y-1">
                      <p><strong>スタンプID:</strong> {stampId}</p>
                      <p><strong>申請ステータス:</strong> {state.stampData?.status}</p>
                      {state.stampData?.retryCount && state.stampData.retryCount > 0 && (
                        <p><strong>再試行回数:</strong> {state.stampData.retryCount}回</p>
                      )}
                      <p><strong>申請完了日時:</strong> {new Date(state.stampData?.updatedAt || '').toLocaleString('ja-JP')}</p>
                    </div>
                  </div>
                </div>

                {/* アクションボタン */}
                <div className="space-y-4">
                  <div className="space-x-4">
                    <button
                      onClick={handleCreateNewStamp}
                      className="px-8 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                    >
                      新しいスタンプを作成
                    </button>
                    <button
                      onClick={handleBackToDashboard}
                      className="px-6 py-3 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors"
                    >
                      ダッシュボードへ戻る
                    </button>
                  </div>
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
                💡 <strong>次のステップ:</strong><br />
                • LINE Creators Market からの審査結果通知をお待ちください<br />
                • 審査には通常1〜7営業日かかります<br />
                • 承認されると、LINEスタンプショップで販売開始されます
              </p>
            </div>
          </div>
        </div>

        {/* 追加情報 */}
        <div className="mt-4 bg-yellow-50 border border-yellow-200 rounded-md p-4">
          <div className="flex">
            <div className="flex-shrink-0">
              <svg className="h-5 w-5 text-yellow-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
              </svg>
            </div>
            <div className="ml-3">
              <p className="text-sm text-yellow-700">
                ⚠️ 申請後の変更・キャンセルはできません。
                新しいバージョンを作成したい場合は、新規スタンプとして申請してください。
              </p>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
} 