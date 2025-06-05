import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';
import Image from 'next/image';
import { useAuth } from '@/hooks/useAuth';
import { 
  Preset, 
  PresetListResponse, 
  SetPresetResponse 
} from '@/types/images';

export default function PresetPage() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const [presets, setPresets] = useState<Preset[]>([]);
  const [selectedPresetId, setSelectedPresetId] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [applying, setApplying] = useState(false);
  const [error, setError] = useState<string>('');
  
  // URLからstampIdを取得
  const { stampId } = router.query;

  // 認証チェック
  useEffect(() => {
    if (!authLoading && !user) {
      router.push('/login');
    }
  }, [user, authLoading, router]);

  // プリセット一覧取得
  useEffect(() => {
    const fetchPresets = async () => {
      if (!user) return;

      try {
        setLoading(true);
        const token = await user.getIdToken();
        const response = await fetch(`${process.env['NEXT_PUBLIC_API_BASE_URL']}/presets/list`, {
          headers: {
            'Authorization': `Bearer ${token}`,
          },
        });

        if (response.ok) {
          const data: PresetListResponse = await response.json();
          setPresets(data.presets);
          
          // デフォルトで最初のプリセットを選択
          if (data.presets.length > 0 && data.presets[0]) {
            setSelectedPresetId(data.presets[0].id);
          }
        } else {
          setError('プリセットの取得に失敗しました');
        }
      } catch (error) {
        console.error('Error fetching presets:', error);
        setError('ネットワークエラーが発生しました');
      } finally {
        setLoading(false);
      }
    };

    fetchPresets();
  }, [user]);

  // プリセット適用
  const handleApplyPreset = async () => {
    if (!user || !stampId || !selectedPresetId) return;

    setApplying(true);
    setError('');

    try {
      const token = await user.getIdToken();
      const response = await fetch(`${process.env['NEXT_PUBLIC_API_BASE_URL']}/stamps/set-preset`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          stampId,
          presetId: selectedPresetId,
        }),
      });

      if (response.ok) {
        const data: SetPresetResponse = await response.json();
        console.log('Preset applied successfully:', data);
        
        // 生成画面へ遷移
        router.push(`/generating?stampId=${data.stampId}`);
      } else {
        const errorData = await response.json();
        if (errorData.message && errorData.message.includes('Insufficient tokens')) {
          setError('トークンが不足しています。40トークン必要です。トークンを購入してから再度お試しください。');
        } else {
          setError(errorData.message || 'プリセットの適用に失敗しました');
        }
      }
    } catch (error) {
      console.error('Apply preset error:', error);
      setError('ネットワークエラーが発生しました');
    } finally {
      setApplying(false);
    }
  };

  // プリセット用の背景色とアイコンを取得するヘルパー関数
  const getPresetBackground = (presetId: string): string => {
    switch (presetId) {
      case 'colorful-pop':
        return 'bg-gradient-to-br from-pink-400 via-purple-500 to-blue-500';
      case 'simple-white':
        return 'bg-gradient-to-br from-gray-600 to-gray-800';
      case 'vintage-retro':
        return 'bg-gradient-to-br from-yellow-600 via-orange-500 to-red-500';
      default:
        return 'bg-gradient-to-br from-blue-400 to-purple-500';
    }
  };

  const getPresetIcon = (presetId: string): string => {
    switch (presetId) {
      case 'colorful-pop':
        return '🌈';
      case 'simple-white':
        return '⚪';
      case 'vintage-retro':
        return '📼';
      default:
        return '🎨';
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

  if (!stampId) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-900 mb-4">
            エラー
          </h1>
          <p className="text-gray-600 mb-4">
            スタンプIDが指定されていません
          </p>
          <button
            onClick={() => router.push('/dashboard')}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            ダッシュボードへ戻る
          </button>
        </div>
      </div>
    );
  }

  return (
    <>
      <Head>
        <title>プリセット選択 | LINEスタンプ自動生成</title>
      </Head>

      <div className="min-h-screen bg-gray-50 py-8">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-8">
            <h1 className="text-3xl font-bold text-gray-900 mb-4">
              スタンプのスタイルを選択
            </h1>
            <p className="text-gray-600">
              お好みのスタイルを選択して、スタンプの雰囲気を決めましょう
            </p>
          </div>

          {/* エラー表示 */}
          {error && (
            <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-md">
              <p className="text-red-800">{error}</p>
            </div>
          )}

          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="text-lg text-gray-600">プリセットを読み込み中...</div>
            </div>
          ) : (
            <>
              {/* プリセット一覧 */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
                {presets.map((preset) => (
                  <div
                    key={preset.id}
                    className={`bg-white rounded-lg shadow-md overflow-hidden cursor-pointer transition-all duration-200 ${
                      selectedPresetId === preset.id
                        ? 'ring-2 ring-blue-500 shadow-lg transform scale-105'
                        : 'hover:shadow-lg hover:scale-105'
                    }`}
                    onClick={() => setSelectedPresetId(preset.id)}
                  >
                    {/* プリセットサムネイル */}
                    <div className="aspect-video relative bg-gray-100">
                      {preset.thumbnailUrl ? (
                        <Image
                          src={preset.thumbnailUrl}
                          alt={preset.label}
                          fill
                          className="object-cover"
                        />
                      ) : (
                        <div className={`w-full h-full flex items-center justify-center ${getPresetBackground(preset.id)}`}>
                          <div className="text-white text-4xl">{getPresetIcon(preset.id)}</div>
                        </div>
                      )}
                      
                      {/* 選択状態のオーバーレイ */}
                      {selectedPresetId === preset.id && (
                        <div className="absolute inset-0 bg-blue-500 bg-opacity-20 flex items-center justify-center">
                          <div className="bg-blue-500 text-white rounded-full p-2">
                            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                            </svg>
                          </div>
                        </div>
                      )}
                    </div>

                    {/* プリセット情報 */}
                    <div className="p-4">
                      <h3 className="text-lg font-semibold text-gray-900 mb-2">
                        {preset.label}
                      </h3>
                      <p className="text-sm text-gray-600">
                        {preset.description}
                      </p>
                    </div>
                  </div>
                ))}
              </div>

              {/* 選択されたプリセットの詳細 */}
              {selectedPresetId && (
                <div className="bg-white rounded-lg shadow p-6 mb-8">
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">
                    選択されたスタイル
                  </h3>
                  {(() => {
                    const selectedPreset = presets.find(p => p.id === selectedPresetId);
                    return selectedPreset ? (
                      <div className="flex items-center space-x-4">
                        <div className={`w-16 h-16 rounded-lg flex items-center justify-center ${getPresetBackground(selectedPreset.id)}`}>
                          <div className="text-white text-2xl">{getPresetIcon(selectedPreset.id)}</div>
                        </div>
                        <div>
                          <h4 className="font-medium text-gray-900">
                            {selectedPreset.label}
                          </h4>
                          <p className="text-sm text-gray-600">
                            {selectedPreset.description}
                          </p>
                        </div>
                      </div>
                    ) : null;
                  })()}
                </div>
              )}

              {/* 適用ボタン */}
              <div className="text-center">
                <button
                  onClick={handleApplyPreset}
                  disabled={!selectedPresetId || applying}
                  className={`px-8 py-3 rounded-lg font-medium transition-colors ${
                    selectedPresetId && !applying
                      ? 'bg-blue-600 text-white hover:bg-blue-700'
                      : 'bg-gray-300 text-gray-500 cursor-not-allowed'
                  }`}
                >
                  {applying ? (
                    <span className="flex items-center">
                      <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      適用中...
                    </span>
                  ) : (
                    'このプリセットで生成'
                  )}
                </button>
                
                {!selectedPresetId && (
                  <p className="text-sm text-gray-500 mt-2">
                    プリセットを選択してください
                  </p>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </>
  );
} 