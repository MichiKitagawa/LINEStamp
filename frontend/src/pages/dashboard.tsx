import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import { useAuth } from '@/hooks/useAuth';
import { apiClient } from '@/utils/apiClient';
import { UserProfile, SessionResponse } from '@/types/auth';
import { TokenBalance } from '@/types/tokens';

export default function DashboardPage() {
  const { user, loading: authLoading, logout } = useAuth();
  const router = useRouter();
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [pendingStamps, setPendingStamps] = useState<any[]>([]);
  const [hasPendingSubmission, setHasPendingSubmission] = useState(false);

  useEffect(() => {
    if (!authLoading && !user) {
      router.push('/login');
      return;
    }

    if (user) {
      // モック認証の場合はAPI呼び出しをスキップ
      if (typeof window !== 'undefined' && localStorage.getItem('mockAuthUser')) {
        // モックユーザーの場合は直接ユーザー情報を設定
        setUserProfile({
          uid: user.uid,
          email: user.email || '',
          displayName: user.displayName || '',
          photoURL: user.photoURL,
          tokenBalance: 10, // モック用のデフォルトトークン残数
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        });
        setLoading(false);
        // モックユーザーでもスタンプ状況は確認
        fetchUserStamps();
      } else {
        fetchUserProfile();
        fetchUserStamps();
      }
    }
  }, [user, authLoading, router]);

  useEffect(() => {
    // 決済成功メッセージの表示
    if (router.query['payment'] === 'success') {
      setSuccessMessage('決済が完了しました！トークンが追加されました。');
      // URLから決済パラメータを削除
      router.replace('/dashboard', undefined, { shallow: true });
    }
  }, [router]);

  const fetchUserProfile = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await apiClient.get<SessionResponse>('/auth/session');
      setUserProfile(response.user);
    } catch (error) {
      console.error('ユーザー情報取得エラー:', error);
      setError('ユーザー情報の取得に失敗しました。');
    } finally {
      setLoading(false);
    }
  };

  const fetchUserStamps = async () => {
    try {
      const response = await apiClient.get<{ userId: string; stamps: any[] }>('/stamps/status');
      const stamps = response.stamps || [];
      setPendingStamps(stamps);
      
      // 申請中・申請済みのスタンプがあるかチェック
      const hasActivSubmission = stamps.some((stamp: any) => 
        stamp.status === 'submitting' || stamp.status === 'submitted'
      );
      setHasPendingSubmission(hasActivSubmission);
    } catch (error) {
      console.error('スタンプ一覧取得エラー:', error);
    }
  };

  const fetchTokenBalance = async () => {
    try {
      const response = await apiClient.get<TokenBalance>('/tokens/balance');
      if (userProfile) {
        setUserProfile({
          ...userProfile,
          tokenBalance: response.balance,
        });
      }
    } catch (error) {
      console.error('トークン残数取得エラー:', error);
    }
  };

  const handleLogout = async () => {
    try {
      await logout();
      router.push('/login');
    } catch (error) {
      console.error('ログアウトエラー:', error);
    }
  };

  const handlePurchaseTokens = () => {
    router.push('/purchase');
  };

  const handleCreateStamp = () => {
    if (!userProfile || userProfile.tokenBalance < 5) {
      router.push('/purchase');
      return;
    }
    
    // 申請中・申請済みのスタンプがある場合は警告
    if (hasPendingSubmission) {
      return;
    }
    
    router.push('/upload');
  };

  const handleRefreshBalance = () => {
    fetchTokenBalance();
    fetchUserStamps(); // スタンプ状況も更新
  };

  if (authLoading || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="text-danger-600 mb-4">⚠️ {error}</div>
          <button
            onClick={fetchUserProfile}
            className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700"
          >
            再試行
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <h1 className="text-xl font-semibold text-gray-900">
              LINE スタンプ自動生成システム
            </h1>
            <div className="flex items-center space-x-4">
              <div className="flex items-center space-x-2">
                <img
                  src={userProfile?.photoURL || '/default-avatar.png'}
                  alt="プロフィール画像"
                  className="h-8 w-8 rounded-full"
                />
                <span className="text-sm text-gray-700">
                  {userProfile?.displayName || user?.displayName || 'ユーザー'}
                </span>
              </div>
              <button
                onClick={handleLogout}
                className="text-sm text-gray-500 hover:text-gray-700"
              >
                ログアウト
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Success Message */}
          {successMessage && (
            <div className="lg:col-span-3 bg-success-50 border border-success-200 text-success-800 px-4 py-3 rounded-lg">
              <div className="flex justify-between items-center">
                <span>✅ {successMessage}</span>
                <button
                  onClick={() => setSuccessMessage(null)}
                  className="text-success-600 hover:text-success-800"
                >
                  ✕
                </button>
              </div>
            </div>
          )}

          {/* Token Balance Card */}
          <div className="lg:col-span-1">
            <div className="bg-white rounded-lg shadow-md p-6">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-lg font-medium text-gray-900">
                  トークン残数
                </h2>
                <button
                  onClick={handleRefreshBalance}
                  className="text-gray-400 hover:text-gray-600"
                  title="残数を更新"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                </button>
              </div>
              <div className="text-center">
                <div className="text-4xl font-bold text-primary-600 mb-2">
                  {userProfile?.tokenBalance || 0}
                </div>
                <div className="text-sm text-gray-500 mb-4">
                  枚
                </div>
                <button
                  onClick={handlePurchaseTokens}
                  className="w-full px-4 py-2 bg-secondary-600 text-white rounded-lg hover:bg-secondary-700 transition-colors duration-200"
                >
                  トークンを購入
                </button>
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="lg:col-span-2">
            <div className="space-y-6">
              {/* Create Stamp Card */}
              <div className="bg-white rounded-lg shadow-md p-6">
                <h2 className="text-lg font-medium text-gray-900 mb-4">
                  スタンプ作成
                </h2>
                
                {/* 申請中・申請済みスタンプがある場合の警告 */}
                {hasPendingSubmission && (
                  <div className="mb-6 bg-orange-50 border border-orange-200 rounded-lg p-4">
                    <div className="flex">
                      <div className="flex-shrink-0">
                        <svg className="h-5 w-5 text-orange-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
                        </svg>
                      </div>
                      <div className="ml-3">
                        <h3 className="text-sm font-medium text-orange-800">
                          ⚠️ 申請待ちのスタンプがあります
                        </h3>
                        <p className="text-sm text-orange-700 mt-1">
                          現在申請中または審査待ちのスタンプがあります。<br />
                          <strong>新しいスタンプの作成は、審査結果が届いてから行ってください。</strong><br />
                          重複申請は推奨されません。
                        </p>
                      </div>
                    </div>
                  </div>
                )}
                
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-gray-600 mb-2">
                      オリジナル画像からスタンプを作成
                    </p>
                    <p className="text-sm text-gray-500">
                      必要トークン: 5枚/画像 (最大8枚)
                    </p>
                  </div>
                  <button
                    onClick={handleCreateStamp}
                    disabled={!userProfile || userProfile.tokenBalance < 5 || hasPendingSubmission}
                    className="px-6 py-3 bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors duration-200"
                  >
                    {!userProfile || userProfile.tokenBalance < 5
                      ? 'トークン不足'
                      : hasPendingSubmission
                      ? '申請待ちあり'
                      : 'スタンプ作成を始める'}
                  </button>
                </div>
                
                {!userProfile || userProfile.tokenBalance < 5 ? (
                  <div className="mt-4 p-3 bg-warning-50 border border-warning-200 rounded-lg">
                    <p className="text-sm text-warning-800">
                      スタンプ作成にはトークンが必要です。まずはトークンを購入してください。
                    </p>
                  </div>
                ) : null}
              </div>

              {/* Features Info */}
              <div className="bg-white rounded-lg shadow-md p-6">
                <h2 className="text-lg font-medium text-gray-900 mb-4">
                  サービス機能
                </h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="flex items-start space-x-3">
                    <div className="flex-shrink-0 mt-1">
                      <div className="w-2 h-2 bg-success-500 rounded-full"></div>
                    </div>
                    <div>
                      <h3 className="font-medium text-gray-900">AI画像生成</h3>
                      <p className="text-sm text-gray-600">
                        アップロードした画像を元にスタンプ用に最適化
                      </p>
                    </div>
                  </div>
                  <div className="flex items-start space-x-3">
                    <div className="flex-shrink-0 mt-1">
                      <div className="w-2 h-2 bg-success-500 rounded-full"></div>
                    </div>
                    <div>
                      <h3 className="font-medium text-gray-900">自動申請</h3>
                      <p className="text-sm text-gray-600">
                        LINE Creators Marketへの申請を自動化
                      </p>
                    </div>
                  </div>
                  <div className="flex items-start space-x-3">
                    <div className="flex-shrink-0 mt-1">
                      <div className="w-2 h-2 bg-success-500 rounded-full"></div>
                    </div>
                    <div>
                      <h3 className="font-medium text-gray-900">進捗追跡</h3>
                      <p className="text-sm text-gray-600">
                        申請状況をリアルタイムで確認
                      </p>
                    </div>
                  </div>
                  <div className="flex items-start space-x-3">
                    <div className="flex-shrink-0 mt-1">
                      <div className="w-2 h-2 bg-success-500 rounded-full"></div>
                    </div>
                    <div>
                      <h3 className="font-medium text-gray-900">エラー対応</h3>
                      <p className="text-sm text-gray-600">
                        失敗時の自動再試行とエラー復旧
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Pending Stamps Status */}
              {pendingStamps.length > 0 && (
                <div className="bg-white rounded-lg shadow-md p-6">
                  <h2 className="text-lg font-medium text-gray-900 mb-4">
                    スタンプ申請状況
                  </h2>
                  <div className="space-y-3">
                    {pendingStamps
                      .filter((stamp: any) => 
                        stamp.status === 'submitting' || 
                        stamp.status === 'submitted' || 
                        stamp.status === 'failed' ||
                        stamp.status === 'session_expired'
                      )
                      .slice(0, 5) // 最新5件まで表示
                      .map((stamp: any) => (
                        <div 
                          key={stamp.stampId}
                          className={`flex items-center justify-between p-3 border rounded-lg ${
                            stamp.status === 'submitted' 
                              ? 'border-green-200 bg-green-50' 
                              : stamp.status === 'submitting'
                              ? 'border-blue-200 bg-blue-50'
                              : 'border-red-200 bg-red-50'
                          }`}
                        >
                          <div className="flex items-center">
                            <div className={`w-3 h-3 rounded-full mr-3 ${
                              stamp.status === 'submitted' 
                                ? 'bg-green-500' 
                                : stamp.status === 'submitting'
                                ? 'bg-blue-500 animate-pulse'
                                : 'bg-red-500'
                            }`}></div>
                            <div>
                              <p className="text-sm font-medium text-gray-900">
                                スタンプID: {stamp.stampId.slice(0, 8)}...
                              </p>
                              <p className="text-xs text-gray-600">
                                {stamp.status === 'submitted' && '申請完了 - 審査待ち'}
                                {stamp.status === 'submitting' && '申請中...'}
                                {stamp.status === 'failed' && '申請失敗'}
                                {stamp.status === 'session_expired' && 'セッション期限切れ'}
                              </p>
                            </div>
                          </div>
                          <div className="text-xs text-gray-500">
                            {new Date(stamp.updatedAt).toLocaleDateString('ja-JP')}
                          </div>
                        </div>
                      ))
                    }
                  </div>
                  {pendingStamps.filter((stamp: any) => 
                    stamp.status === 'submitting' || stamp.status === 'submitted'
                  ).length > 0 && (
                    <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                      <p className="text-sm text-blue-700">
                        💡 審査結果はLINE Creators Marketから通知されます。通常1〜7営業日かかります。
                      </p>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
} 