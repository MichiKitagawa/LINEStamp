import { useState, useRef, useCallback, useEffect } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';
import Image from 'next/image';
import { useAuth } from '@/hooks/useAuth';
import { 
  ImageFile, 
  UploadResponse, 
  UPLOAD_VALIDATION, 
  validateImageFile, 
  createImagePreview, 
  formatFileSize 
} from '@/types/images';

export default function UploadPage() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const [images, setImages] = useState<ImageFile[]>([]);
  const [dragActive, setDragActive] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [tokenBalance, setTokenBalance] = useState<number>(0);
  const [loadingBalance, setLoadingBalance] = useState(true);
  const [error, setError] = useState<string>('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  // 認証チェック
  useEffect(() => {
    if (!authLoading && !user) {
      router.push('/login');
    }
  }, [user, authLoading, router]);

  // トークン残数取得
  useEffect(() => {
    const fetchTokenBalance = async () => {
      if (!user) return;

      try {
        setLoadingBalance(true);
        const token = await user.getIdToken();
        const response = await fetch(`${process.env['NEXT_PUBLIC_API_BASE_URL']}/tokens/balance`, {
          headers: {
            'Authorization': `Bearer ${token}`,
          },
        });

        if (response.ok) {
          const data = await response.json();
          setTokenBalance(data.balance);
        } else {
          console.error('Failed to fetch token balance');
        }
      } catch (error) {
        console.error('Error fetching token balance:', error);
      } finally {
        setLoadingBalance(false);
      }
    };

    fetchTokenBalance();
  }, [user]);

  // ドラッグ&ドロップハンドラー
  const handleDrag = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  }, []);

  const handleDrop = useCallback(async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    const files = Array.from(e.dataTransfer.files);
    await processFiles(files);
  }, []);

  // ファイル選択ハンドラー
  const handleFileSelect = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    await processFiles(files);
  }, []);

  // ファイル処理
  const processFiles = async (files: File[]) => {
    setError('');

    // ファイル数チェック
    const totalFiles = images.length + files.length;
    if (totalFiles > UPLOAD_VALIDATION.MAX_FILES) {
      setError(`最大${UPLOAD_VALIDATION.MAX_FILES}枚まで選択できます`);
      return;
    }

    const validFiles: ImageFile[] = [];
    
    for (const file of files) {
      // バリデーション
      const validation = validateImageFile(file);
      if (!validation.isValid) {
        setError(validation.error || 'ファイルが無効です');
        continue;
      }

      // プレビュー画像生成
      try {
        const preview = await createImagePreview(file);
        validFiles.push({
          file,
          preview,
          id: Math.random().toString(36).substring(2),
        });
      } catch (error) {
        console.error('Failed to create preview:', error);
      }
    }

    setImages(prev => [...prev, ...validFiles]);
  };

  // 画像削除
  const removeImage = (id: string) => {
    setImages(prev => prev.filter(img => img.id !== id));
  };

  // 必要トークン数計算
  const requiredTokens = images.length * 5;
  const canUpload = images.length >= UPLOAD_VALIDATION.MIN_FILES && tokenBalance >= requiredTokens;

  // アップロード実行
  const handleUpload = async () => {
    if (!user || !canUpload) return;

    setUploading(true);
    setError('');

    try {
      const token = await user.getIdToken();
      const formData = new FormData();
      
      images.forEach((image) => {
        formData.append('images', image.file);
      });

      const response = await fetch(`${process.env['NEXT_PUBLIC_API_BASE_URL']}/images/upload`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
        body: formData,
      });

      if (response.ok) {
        const data: UploadResponse = await response.json();
        console.log('Upload successful:', data);
        
        // プリセット選択画面へ遷移
        router.push(`/preset?stampId=${data.stampId}`);
      } else {
        const errorData = await response.json();
        setError(errorData.message || 'アップロードに失敗しました');
      }
    } catch (error) {
      console.error('Upload error:', error);
      setError('ネットワークエラーが発生しました');
    } finally {
      setUploading(false);
    }
  };

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-lg">読み込み中...</div>
      </div>
    );
  }

  if (!user) {
    return null;
  }

  return (
    <>
      <Head>
        <title>画像アップロード | LINEスタンプ自動生成</title>
      </Head>

      <div className="min-h-screen bg-gray-50 py-8">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-8">
            <h1 className="text-3xl font-bold text-gray-900 mb-4">
              画像をアップロード
            </h1>
            <p className="text-gray-600">
              PNG・JPEGファイルを{UPLOAD_VALIDATION.MIN_FILES}〜{UPLOAD_VALIDATION.MAX_FILES}枚選択してください
            </p>
          </div>

          {/* トークン残数表示 */}
          <div className="bg-white rounded-lg shadow p-6 mb-6">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-semibold text-gray-900">トークン残数</h2>
                {loadingBalance ? (
                  <p className="text-gray-600">読み込み中...</p>
                ) : (
                  <p className="text-2xl font-bold text-blue-600">{tokenBalance} トークン</p>
                )}
              </div>
              <div className="text-right">
                <p className="text-sm text-gray-600">必要トークン数</p>
                <p className="text-lg font-semibold text-gray-900">
                  {requiredTokens} トークン
                </p>
                <p className="text-xs text-gray-500">
                  1枚あたり5トークン
                </p>
              </div>
            </div>
            
            {tokenBalance < requiredTokens && images.length > 0 && (
              <div className="mt-4 p-4 bg-yellow-50 border border-yellow-200 rounded-md">
                <p className="text-yellow-800">
                  トークンが不足しています。
                  <button
                    onClick={() => router.push('/purchase')}
                    className="ml-2 text-yellow-800 underline hover:text-yellow-900"
                  >
                    トークンを購入する
                  </button>
                </p>
              </div>
            )}
          </div>

          {/* ドラッグ&ドロップエリア */}
          <div
            className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors mb-6 ${
              dragActive
                ? 'border-blue-400 bg-blue-50'
                : 'border-gray-300 bg-white hover:border-gray-400'
            }`}
            onDragEnter={handleDrag}
            onDragLeave={handleDrag}
            onDragOver={handleDrag}
            onDrop={handleDrop}
          >
            <input
              ref={fileInputRef}
              type="file"
              multiple
              accept=".png,.jpg,.jpeg,image/png,image/jpeg"
              onChange={handleFileSelect}
              className="hidden"
            />
            
            <div className="text-gray-600">
              <svg
                className="mx-auto h-12 w-12 text-gray-400 mb-4"
                stroke="currentColor"
                fill="none"
                viewBox="0 0 48 48"
              >
                <path
                  d="M28 8H12a4 4 0 00-4 4v20m32-12v8m0 0v8a4 4 0 01-4 4H12a4 4 0 01-4-4v-4m32-4l-3.172-3.172a4 4 0 00-5.656 0L28 28M8 32l9.172-9.172a4 4 0 015.656 0L28 28m0 0l4 4m4-24h8m-4-4v8m-12 4h.02"
                  strokeWidth={2}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
              <p className="text-lg mb-2">
                ここに画像をドラッグ&ドロップするか
              </p>
              <button
                onClick={() => fileInputRef.current?.click()}
                className="text-blue-600 hover:text-blue-700 font-medium"
              >
                ファイルを選択
              </button>
              <p className="text-sm text-gray-500 mt-2">
                PNG、JPEG形式、最大{UPLOAD_VALIDATION.MAX_FILE_SIZE / (1024 * 1024)}MB
              </p>
            </div>
          </div>

          {/* エラー表示 */}
          {error && (
            <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-md">
              <p className="text-red-800">{error}</p>
            </div>
          )}

          {/* 選択された画像一覧 */}
          {images.length > 0 && (
            <div className="bg-white rounded-lg shadow p-6 mb-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">
                選択された画像 ({images.length}枚)
              </h3>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
                {images.map((image) => (
                  <div key={image.id} className="relative group">
                    <div className="aspect-square relative bg-gray-100 rounded-lg overflow-hidden">
                      <Image
                        src={image.preview}
                        alt={image.file.name}
                        fill
                        className="object-cover"
                      />
                    </div>
                    <button
                      onClick={() => removeImage(image.id)}
                      className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full w-6 h-6 flex items-center justify-center text-sm hover:bg-red-600 transition-colors"
                    >
                      ×
                    </button>
                    <div className="mt-2">
                      <p className="text-sm font-medium text-gray-900 truncate">
                        {image.file.name}
                      </p>
                      <p className="text-xs text-gray-500">
                        {formatFileSize(image.file.size)}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* アップロードボタン */}
          <div className="text-center">
            <button
              onClick={handleUpload}
              disabled={!canUpload || uploading}
              className={`px-8 py-3 rounded-lg font-medium transition-colors ${
                canUpload && !uploading
                  ? 'bg-blue-600 text-white hover:bg-blue-700'
                  : 'bg-gray-300 text-gray-500 cursor-not-allowed'
              }`}
            >
              {uploading ? (
                <span className="flex items-center">
                  <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  アップロード中...
                </span>
              ) : (
                '次へ（スタイル選択）'
              )}
            </button>
            
            {!canUpload && images.length === 0 && (
              <p className="text-sm text-gray-500 mt-2">
                最低{UPLOAD_VALIDATION.MIN_FILES}枚の画像を選択してください
              </p>
            )}
            
            {!canUpload && images.length > 0 && tokenBalance >= requiredTokens && (
              <p className="text-sm text-gray-500 mt-2">
                {images.length < UPLOAD_VALIDATION.MIN_FILES 
                  ? `あと${UPLOAD_VALIDATION.MIN_FILES - images.length}枚選択してください`
                  : '準備完了'
                }
              </p>
            )}
          </div>
        </div>
      </div>
    </>
  );
} 