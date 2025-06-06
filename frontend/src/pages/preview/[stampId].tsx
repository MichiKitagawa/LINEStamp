import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import { useAuth } from '@/hooks/useAuth';

interface ProcessedImage {
  id: string;
  url: string;
  sequence: number;
  filename: string;
}

interface PreviewStampResponse {
  stampId: string;
  processedImages: ProcessedImage[];
  mainImage?: ProcessedImage;
  tabImage?: ProcessedImage;
}

interface SubmitStampResponse {
  stampId: string;
  status: string;
}

interface PreviewPageState {
  status: 'loading' | 'loaded' | 'submitting' | 'error';
  images: ProcessedImage[];
  mainImage?: ProcessedImage;
  tabImage?: ProcessedImage;
  error?: string;
}

export default function PreviewPage() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const { stampId } = router.query;
  
  const [state, setState] = useState<PreviewPageState>({
    status: 'loading',
    images: []
  });

  // プレビュー画像を取得
  const fetchPreviewImages = async (stampId: string) => {
    try {
      const response = await fetch(`${process.env['NEXT_PUBLIC_API_BASE_URL']}/stamps/${stampId}/preview`, {
        headers: {
          'Authorization': `Bearer ${await user?.getIdToken()}`,
        },
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'プレビュー画像の取得に失敗しました');
      }

      const data: PreviewStampResponse = await response.json();
      
      setState({
        status: 'loaded',
        images: data.processedImages,
        ...(data.mainImage && { mainImage: data.mainImage }),
        ...(data.tabImage && { tabImage: data.tabImage }),
      });

    } catch (error) {
      console.error('Preview fetch error:', error);
      setState({
        status: 'error',
        images: [],
        error: error instanceof Error ? error.message : '不明なエラー'
      });
    }
  };

  // 申請を開始
  const handleSubmit = async () => {
    if (!stampId || typeof stampId !== 'string') return;

    setState(prev => ({ ...prev, status: 'submitting' }));

    try {
      // 申請前に最新ステータスを確認
      const statusResponse = await fetch(`${process.env['NEXT_PUBLIC_API_BASE_URL']}/stamps/${stampId}/status`, {
        headers: {
          'Authorization': `Bearer ${await user?.getIdToken()}`,
        },
      });

      if (statusResponse.ok) {
        const statusData = await statusResponse.json();
        
        // 既に申請済みの場合は適切な画面に遷移
        if (statusData.status === 'submitting') {
          router.push(`/status/${stampId}`);
          return;
        } else if (statusData.status === 'submitted') {
          router.push(`/success/${stampId}`);
          return;
        } else if (statusData.status !== 'generated') {
          throw new Error(`Invalid status: ${statusData.status}. Can only submit from generated status.`);
        }
      }

      const response = await fetch(`${process.env['NEXT_PUBLIC_API_BASE_URL']}/stamps/submit`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${await user?.getIdToken()}`,
        },
        body: JSON.stringify({ stampId }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || '申請の開始に失敗しました');
      }

      const data: SubmitStampResponse = await response.json();
      console.log('Submission started:', data);

      // 申請進捗画面へ遷移
      router.push(`/status/${stampId}`);

    } catch (error) {
      console.error('Submission start error:', error);
      setState(prev => ({
        ...prev,
        status: 'loaded',
        error: error instanceof Error ? error.message : '申請の開始でエラーが発生しました'
      }));
    }
  };

  // ダウンロード状態管理
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const [isDownloadingAll, setIsDownloadingAll] = useState(false);

  // 個別画像ダウンロード（改善版）
  const downloadImage = async (url: string, filename: string, imageId?: string) => {
    // 重複実行防止
    if (downloadingId === imageId) {
      return;
    }

    try {
      if (imageId) {
        setDownloadingId(imageId);
      }

      console.log(`Starting download: ${filename} from ${url}`);
      
      // プロキシ経由でダウンロードを試行（CORS回避）
      const proxyUrl = `/api/download-proxy?url=${encodeURIComponent(url)}`;
      let response: Response;
      
      try {
        // まずプロキシ経由を試行
        response = await fetch(proxyUrl);
        if (!response.ok) {
          throw new Error(`Proxy download failed: ${response.status}`);
        }
      } catch (proxyError) {
        console.warn('Proxy download failed, trying direct download:', proxyError);
        // プロキシが失敗した場合は直接ダウンロードを試行
        response = await fetch(url, {
          mode: 'cors',
          credentials: 'omit',
        });
        
        if (!response.ok) {
          throw new Error(`Direct download failed: ${response.status} ${response.statusText}`);
        }
      }
      
      const blob = await response.blob();
      
      // blobが空でないかチェック
      if (blob.size === 0) {
        throw new Error('Downloaded file is empty');
      }
      
      const downloadUrl = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = downloadUrl;
      link.download = filename;
      
      // より確実なダウンロード実行
      document.body.appendChild(link);
      link.click();
      
      // クリーンアップ
      setTimeout(() => {
        document.body.removeChild(link);
        window.URL.revokeObjectURL(downloadUrl);
      }, 100);
      
      console.log(`Download completed: ${filename}`);
      
    } catch (error) {
      console.error('Download failed for', filename, ':', error);
      alert(`ダウンロードに失敗しました: ${filename}\n\n${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      if (imageId) {
        setDownloadingId(null);
      }
    }
  };

  // 全画像の一括ダウンロード（改善版）
  const downloadAllImages = async () => {
    if (isDownloadingAll) {
      return; // 重複実行防止
    }

    try {
      setIsDownloadingAll(true);
      let downloadCount = 0;
      const totalImages = state.images.length + (state.mainImage ? 1 : 0) + (state.tabImage ? 1 : 0);
      
      console.log(`Starting bulk download of ${totalImages} images`);
      
      // スタンプ画像をダウンロード
      for (let i = 0; i < state.images.length; i++) {
        const image = state.images[i];
        if (!image) continue;
        
        try {
          await downloadImage(image.url, `stamp_${image.sequence}.png`);
          downloadCount++;
          await new Promise(resolve => setTimeout(resolve, 800)); // 間隔を長く
        } catch (error) {
          console.error(`Failed to download stamp ${image.sequence}:`, error);
        }
      }
      
      // メイン画像をダウンロード
      if (state.mainImage) {
        try {
          await downloadImage(state.mainImage.url, 'main.png');
          downloadCount++;
          await new Promise(resolve => setTimeout(resolve, 800));
        } catch (error) {
          console.error('Failed to download main image:', error);
        }
      }
      
      // タブ画像をダウンロード
      if (state.tabImage) {
        try {
          await downloadImage(state.tabImage.url, 'tab.png');
          downloadCount++;
        } catch (error) {
          console.error('Failed to download tab image:', error);
        }
      }
      
      alert(`ダウンロード完了: ${downloadCount}/${totalImages} 枚の画像をダウンロードしました`);
      
    } catch (error) {
      console.error('Bulk download error:', error);
      alert('一括ダウンロードでエラーが発生しました');
    } finally {
      setIsDownloadingAll(false);
    }
  };

  // 初期化処理
  useEffect(() => {
    if (authLoading || !user || !stampId) {
      return;
    }

    if (typeof stampId !== 'string') {
      setState({
        status: 'error',
        images: [],
        error: '無効なスタンプIDです'
      });
      return;
    }

    fetchPreviewImages(stampId);
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
                onClick={() => router.push('/dashboard')}
                className="text-gray-600 hover:text-gray-900"
              >
                ダッシュボード
              </button>
            </nav>
          </div>
        </div>
      </header>

      {/* メインコンテンツ */}
      <main className="max-w-6xl mx-auto py-12 px-4 sm:px-6 lg:px-8">
        <div className="bg-white rounded-lg shadow p-8">
          <div className="text-center mb-8">
            <h2 className="text-2xl font-bold text-gray-900 mb-2">
              スタンププレビュー
            </h2>
            <p className="text-gray-600">
              生成されたスタンプを確認してLINE Creators Marketに申請します
            </p>
          </div>

          {state.status === 'loading' && (
            <div className="text-center py-12">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
              <p className="mt-4 text-gray-600">プレビュー画像を読み込み中...</p>
            </div>
          )}

          {state.status === 'error' && (
            <div className="text-center py-12">
              <div className="bg-red-50 border border-red-200 rounded-md p-4 mb-6">
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
              <div className="space-x-4">
                <button
                  onClick={() => router.push('/dashboard')}
                  className="px-6 py-3 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors"
                >
                  ダッシュボードに戻る
                </button>
                <button
                  onClick={() => router.push('/upload')}
                  className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                >
                  再アップロード
                </button>
              </div>
            </div>
          )}

          {(state.status === 'loaded' || state.status === 'submitting') && (
            <>
              {/* メイン画像表示 */}
              {state.mainImage && (
                <div className="mb-8">
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">メイン画像</h3>
                  <div className="flex justify-center">
                    <div className="bg-gray-100 rounded-lg p-4 w-48 h-48 flex items-center justify-center">
                      <img
                        src={state.mainImage.url}
                        alt={`メイン画像`}
                        className="max-w-full max-h-full object-contain"
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* スタンプ画像グリッド */}
              <div className="mb-8">
                <div className="flex justify-between items-center mb-4">
                  <h3 className="text-lg font-semibold text-gray-900">
                    スタンプセット ({state.images.length}枚)
                  </h3>
                  {state.images.length > 0 && (
                    <button
                      onClick={downloadAllImages}
                      disabled={isDownloadingAll}
                      className={`px-4 py-2 rounded-lg transition-colors text-sm ${
                        isDownloadingAll
                          ? 'bg-gray-400 text-gray-700 cursor-not-allowed'
                          : 'bg-blue-600 text-white hover:bg-blue-700'
                      }`}
                    >
                      {isDownloadingAll ? '⏳ ダウンロード中...' : '📥 全画像をダウンロード'}
                    </button>
                  )}
                </div>
                
                {state.images.length === 0 ? (
                  <div className="text-center py-8">
                    <p className="text-gray-500 mb-4">生成された画像がありません</p>
                    <button
                      onClick={() => router.push('/upload')}
                      className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                    >
                      再アップロード
                    </button>
                  </div>
                ) : (
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    {state.images.map((image) => (
                      <div key={image.id} className="bg-gray-100 rounded-lg p-3 aspect-square flex flex-col">
                        <div className="flex-1 flex items-center justify-center">
                          <img
                            src={image.url}
                            alt={`スタンプ ${image.sequence}`}
                            className="max-w-full max-h-full object-contain"
                          />
                        </div>
                        <button
                          onClick={() => downloadImage(image.url, `stamp_${image.sequence}.png`, image.id)}
                          disabled={downloadingId === image.id}
                          className={`mt-2 px-3 py-1 rounded text-xs transition-colors ${
                            downloadingId === image.id
                              ? 'bg-gray-400 text-gray-700 cursor-not-allowed'
                              : 'bg-gray-600 text-white hover:bg-gray-700'
                          }`}
                        >
                          {downloadingId === image.id ? '⏳ ダウンロード中...' : '⬇ ダウンロード'}
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* LINE用画像セクション */}
              <div className="mb-8">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">
                  LINE用画像
                </h3>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* メイン画像 */}
                  {state.mainImage && (
                    <div className="bg-gray-100 rounded-lg p-4">
                      <h4 className="text-sm font-medium text-gray-700 mb-2">
                        メイン画像 (96×74px)
                      </h4>
                      <div className="flex items-center justify-center h-32 bg-white rounded border-2 border-dashed border-gray-300">
                        <img
                          src={state.mainImage.url}
                          alt="メイン画像"
                          className="max-w-full max-h-full object-contain"
                        />
                      </div>
                      <button
                        onClick={() => downloadImage(state.mainImage!.url, 'main.png', `main_${state.mainImage!.id}`)}
                        disabled={downloadingId === `main_${state.mainImage!.id}`}
                        className={`mt-2 w-full px-3 py-1 rounded text-xs transition-colors ${
                          downloadingId === `main_${state.mainImage!.id}`
                            ? 'bg-gray-400 text-gray-700 cursor-not-allowed'
                            : 'bg-gray-600 text-white hover:bg-gray-700'
                        }`}
                      >
                        {downloadingId === `main_${state.mainImage!.id}` ? '⏳ ダウンロード中...' : '⬇ ダウンロード'}
                      </button>
                    </div>
                  )}
                  
                  {/* タブ画像 */}
                  {state.tabImage && (
                    <div className="bg-gray-100 rounded-lg p-4">
                      <h4 className="text-sm font-medium text-gray-700 mb-2">
                        タブ画像 (240×240px)
                      </h4>
                      <div className="flex items-center justify-center h-32 bg-white rounded border-2 border-dashed border-gray-300">
                        <img
                          src={state.tabImage.url}
                          alt="タブ画像"
                          className="max-w-full max-h-full object-contain"
                        />
                      </div>
                      <button
                        onClick={() => downloadImage(state.tabImage!.url, 'tab.png', `tab_${state.tabImage!.id}`)}
                        disabled={downloadingId === `tab_${state.tabImage!.id}`}
                        className={`mt-2 w-full px-3 py-1 rounded text-xs transition-colors ${
                          downloadingId === `tab_${state.tabImage!.id}`
                            ? 'bg-gray-400 text-gray-700 cursor-not-allowed'
                            : 'bg-gray-600 text-white hover:bg-gray-700'
                        }`}
                      >
                        {downloadingId === `tab_${state.tabImage!.id}` ? '⏳ ダウンロード中...' : '⬇ ダウンロード'}
                      </button>
                    </div>
                  )}
                </div>
              </div>

              {/* エラーメッセージ */}
              {state.error && (
                <div className="bg-red-50 border border-red-200 rounded-md p-4 mb-6">
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

              {/* アクションボタン */}
              {state.images.length > 0 && (
                <div className="text-center">
                  <button
                    onClick={handleSubmit}
                    disabled={state.status === 'submitting'}
                    className="px-8 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {state.status === 'submitting' ? (
                      <>
                        <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white inline" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 714 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                        申請中...
                      </>
                    ) : (
                      'LINE Creators Marketに申請'
                    )}
                  </button>
                </div>
              )}
            </>
          )}
        </div>

        {/* 注意事項 */}
        <div className="mt-8 space-y-4">
          {/* ダウンロードに関する説明 */}
          <div className="bg-yellow-50 border border-yellow-200 rounded-md p-4">
            <div className="flex">
              <div className="flex-shrink-0">
                <svg className="h-5 w-5 text-yellow-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
                </svg>
              </div>
              <div className="ml-3">
                <h4 className="text-sm font-medium text-yellow-800 mb-1">
                  📥 画像ダウンロードについて
                </h4>
                <p className="text-sm text-yellow-700">
                  <strong>申請が失敗した時に個人で申請を行えるようにするため、画像をダウンロードしておくことをおすすめします。</strong>
                  <br />
                  各画像を個別にダウンロードするか、「全画像をダウンロード」ボタンで一括取得できます。
                </p>
              </div>
            </div>
          </div>

          {/* 既存の申請に関する注意事項 */}
          <div className="bg-blue-50 border border-blue-200 rounded-md p-4">
            <div className="flex">
              <div className="flex-shrink-0">
                <svg className="h-5 w-5 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <div className="ml-3">
                <p className="text-sm text-blue-700">
                  💡 申請を開始すると、スタンプ作成フローが完了まで進みます。申請後はLINE Creators Marketでの審査が開始されます。
                </p>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
} 