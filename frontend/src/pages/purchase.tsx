import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import Script from 'next/script';
import { useAuth } from '@/hooks/useAuth';
import { apiClient } from '@/utils/apiClient';
import { TOKEN_PACKAGES, CheckoutSessionResponse } from '@/types/tokens';

export default function PurchasePage() {
  const { user, loading: authLoading } = useAuth();
  const [selectedPackage, setSelectedPackage] = useState<string>('200tokens');
  const [creatingSession, setCreatingSession] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [stripeLoaded, setStripeLoaded] = useState(false);
  const router = useRouter();

  useEffect(() => {
    if (!authLoading && !user) {
      router.push('/login');
    }
  }, [user, authLoading, router]);

  useEffect(() => {
    // 決済キャンセル時のメッセージ表示
    if (router.query['payment'] === 'cancel') {
      setError('決済がキャンセルされました。');
    }
  }, [router.query]);

  const handleStripeLoad = () => {
    console.log('🔄 Stripe.js loaded successfully');
    setStripeLoaded(true);
  };

  const handlePurchase = async () => {
    if (!selectedPackage) return;

    if (!stripeLoaded) {
      setError('決済システムの読み込み中です。少々お待ちください。');
      return;
    }

    const stripe = (window as any).Stripe;
    if (!stripe || typeof stripe !== 'function') {
      setError('決済システムの初期化に失敗しました。ページを再読み込みしてください。');
      return;
    }

    try {
      setCreatingSession(true);
      setError(null);

      const response = await apiClient.post<CheckoutSessionResponse>(
        '/tokens/checkout-session',
        { tokenPackage: selectedPackage }
      );

      // Stripe Checkoutページにリダイレクト
      const stripeInstance = stripe(process.env['NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY']);
      const { error } = await stripeInstance.redirectToCheckout({
        sessionId: response.sessionId,
      });

      if (error) {
        throw new Error(error.message);
      }
    } catch (error) {
      console.error('Purchase error:', error);
      setError('決済処理の開始に失敗しました。もう一度お試しください。');
    } finally {
      setCreatingSession(false);
    }
  };

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('ja-JP', {
      style: 'currency',
      currency: 'JPY',
    }).format(price);
  };

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Stripe.js スクリプトの読み込み */}
      <Script
        src="https://js.stripe.com/v3/"
        onLoad={handleStripeLoad}
        onError={() => {
          console.error('Failed to load Stripe.js');
          setError('決済システムの読み込みに失敗しました。ページを再読み込みしてください。');
        }}
      />

      {/* Header */}
      <header className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <h1 className="text-xl font-semibold text-gray-900">
              トークン購入
            </h1>
            <button
              onClick={() => router.push('/dashboard')}
              className="text-gray-600 hover:text-gray-800"
            >
              ← ダッシュボードに戻る
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="space-y-8">
          {/* Error Message */}
          {error && (
            <div className="bg-danger-50 border border-danger-200 text-danger-800 px-4 py-3 rounded-lg">
              <div className="flex justify-between items-center">
                <span>{error}</span>
                <button
                  onClick={() => setError(null)}
                  className="text-danger-600 hover:text-danger-800"
                >
                  ✕
                </button>
              </div>
            </div>
          )}

          {/* Package Selection */}
          <div className="bg-white rounded-lg shadow-md p-6">
            <h2 className="text-2xl font-bold text-gray-900 mb-6">
              トークンパッケージを選択
            </h2>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {Object.values(TOKEN_PACKAGES).map((pkg) => (
                <div
                  key={pkg.id}
                  className={`relative rounded-lg border-2 p-6 cursor-pointer transition-all duration-200 ${
                    selectedPackage === pkg.id
                      ? 'border-primary-500 bg-primary-50'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                  onClick={() => setSelectedPackage(pkg.id)}
                >
                  <div className="text-center">
                    <input
                      type="radio"
                      name="tokenPackage"
                      value={pkg.id}
                      checked={selectedPackage === pkg.id}
                      onChange={(e) => setSelectedPackage(e.target.value)}
                      className="sr-only"
                    />
                    
                    <div className="mb-4">
                      <h3 className="text-lg font-semibold text-gray-900">
                        {pkg.name}
                      </h3>
                      <div className="text-3xl font-bold text-primary-600 mt-2">
                        {pkg.tokens}
                        <span className="text-sm text-gray-500 ml-1">トークン</span>
                      </div>
                      <div className="text-xl font-semibold text-gray-900 mt-1">
                        {formatPrice(pkg.price)}
                      </div>
                    </div>
                    
                    <p className="text-sm text-gray-600 mb-4">
                      {pkg.description}
                    </p>
                    
                    <div className="text-xs text-gray-500">
                      1トークンあたり {formatPrice(pkg.price / pkg.tokens)}
                    </div>
                    
                    {selectedPackage === pkg.id && (
                      <div className="absolute top-2 right-2">
                        <div className="w-6 h-6 bg-primary-500 rounded-full flex items-center justify-center">
                          <svg className="w-4 h-4 text-white" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                          </svg>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Purchase Button */}
          <div className="bg-white rounded-lg shadow-md p-6">
            <div className="text-center">
              <button
                onClick={handlePurchase}
                disabled={!selectedPackage || creatingSession || !stripeLoaded}
                className="w-full max-w-md px-8 py-4 bg-primary-600 text-white text-lg font-semibold rounded-lg hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors duration-200"
              >
                {creatingSession ? (
                  <div className="flex items-center justify-center">
                    <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-2"></div>
                    決済ページに移動中...
                  </div>
                ) : !stripeLoaded ? (
                  <div className="flex items-center justify-center">
                    <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-2"></div>
                    決済システム読み込み中...
                  </div>
                ) : (
                  `${TOKEN_PACKAGES[selectedPackage]?.name || ''} を購入する`
                )}
              </button>
              
              <p className="text-sm text-gray-500 mt-4">
                安全なStripe決済を使用しています
              </p>
            </div>
          </div>

          {/* Info */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
            <h3 className="font-semibold text-blue-900 mb-2">
              💡 トークンについて
            </h3>
            <ul className="text-sm text-blue-800 space-y-1">
              <li>• 1枚のスタンプ作成に5トークンが必要です</li>
              <li>• 1つのスタンプセットには最大8枚まで含められます</li>
              <li>• トークンに有効期限はありません</li>
              <li>• 決済完了後、即座にトークンが追加されます</li>
            </ul>
          </div>
        </div>
      </main>
    </div>
  );
} 