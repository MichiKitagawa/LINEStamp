import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import { useAuth } from '@/hooks/useAuth';
import { apiClient } from '@/utils/apiClient';
import { UserProfile, SessionResponse } from '@/types/auth';

export default function DashboardPage() {
  const { user, loading: authLoading, logout } = useAuth();
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  useEffect(() => {
    if (!authLoading && !user) {
      router.push('/login');
      return;
    }

    if (user) {
      fetchUserProfile();
    }
  }, [user, authLoading, router]);

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
    router.push('/upload');
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
                  {userProfile?.displayName || 'ユーザー'}
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
          {/* Token Balance Card */}
          <div className="lg:col-span-1">
            <div className="bg-white rounded-lg shadow-md p-6">
              <h2 className="text-lg font-medium text-gray-900 mb-4">
                トークン残数
              </h2>
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
                    disabled={!userProfile || userProfile.tokenBalance < 5}
                    className="px-6 py-3 bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors duration-200"
                  >
                    {!userProfile || userProfile.tokenBalance < 5
                      ? 'トークン不足'
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
            </div>
          </div>
        </div>
      </main>
    </div>
  );
} 