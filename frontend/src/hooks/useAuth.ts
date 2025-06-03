import { useEffect, useState } from 'react';
import { User, onAuthStateChanged, signInWithPopup, signOut } from 'firebase/auth';
import { auth, googleProvider } from '@/utils/firebaseClient';

interface AuthState {
  user: User | null;
  loading: boolean;
  error: string | null;
}

interface AuthActions {
  signInWithGoogle: () => Promise<void>;
  logout: () => Promise<void>;
  clearError: () => void;
}

export interface UseAuthReturn extends AuthState, AuthActions {}

// モックユーザーの型定義
interface MockUser {
  uid: string;
  email: string;
  displayName: string;
}

// モックユーザーをFirebase Userライクなオブジェクトに変換
const createMockFirebaseUser = (mockUser: MockUser): User => {
  return {
    uid: mockUser.uid,
    email: mockUser.email,
    displayName: mockUser.displayName,
    emailVerified: true,
    isAnonymous: false,
    metadata: {} as any,
    providerData: [],
    refreshToken: '',
    tenantId: null,
    delete: async () => {},
    getIdToken: async () => 'mock-id-token',
    getIdTokenResult: async () => ({} as any),
    reload: async () => {},
    toJSON: () => ({}),
    phoneNumber: null,
    photoURL: null,
    providerId: 'mock'
  } as User;
};

export const useAuth = (): UseAuthReturn => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // E2Eテスト用のモック認証チェック
    const checkMockAuth = () => {
      if (typeof window !== 'undefined') {
        const mockUser = localStorage.getItem('mockAuthUser');
        if (mockUser) {
          try {
            const parsedUser = JSON.parse(mockUser) as MockUser;
            const firebaseUser = createMockFirebaseUser(parsedUser);
            setUser(firebaseUser);
            setLoading(false);
            return true;
          } catch (error) {
            console.error('モックユーザーの解析に失敗:', error);
            localStorage.removeItem('mockAuthUser');
          }
        }
      }
      return false;
    };

    // モック認証が有効な場合は、Firebase認証は使用しない
    if (checkMockAuth()) {
      return;
    }

    // 通常のFirebase認証
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        // 開発環境でデバッグ情報を出力
        if (process.env.NODE_ENV === 'development') {
          console.log('🔐 認証状態変更検知:', {
            uid: user.uid,
            email: user.email,
            displayName: user.displayName,
          });
          
          try {
            // IDトークンを取得してテスト
            const token = await user.getIdToken();
            console.log('🎫 IDトークン取得成功:', {
              length: token.length,
              start: token.substring(0, 20) + '...',
            });
          } catch (tokenError) {
            console.error('❌ IDトークン取得エラー:', tokenError);
          }
        }
      }
      
      setUser(user);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const signInWithGoogle = async (): Promise<void> => {
    try {
      setLoading(true);
      setError(null);

      // E2Eテスト用のモック認証チェック
      if (typeof window !== 'undefined') {
        const mockUser = localStorage.getItem('mockAuthUser');
        if (mockUser) {
          const parsedUser = JSON.parse(mockUser) as MockUser;
          const firebaseUser = createMockFirebaseUser(parsedUser);
          setUser(firebaseUser);
          setLoading(false);
          return;
        }
      }

      // Firebase設定チェック
      if (process.env.NODE_ENV === 'development') {
        console.log('🚀 Google認証を開始...');
      }

      // 通常のGoogle認証
      const result = await signInWithPopup(auth, googleProvider);
      
      if (process.env.NODE_ENV === 'development') {
        console.log('✅ Google認証成功');
        console.log('🔍 認証結果:', {
          uid: result.user.uid,
          email: result.user.email,
          displayName: result.user.displayName,
        });
        
        try {
          // IDトークンの即座取得をテスト
          const token = await result.user.getIdToken();
          console.log('🎫 IDトークン即座取得成功:', {
            length: token.length,
            start: token.substring(0, 20) + '...',
          });
        } catch (tokenError) {
          console.error('❌ IDトークン即座取得エラー:', tokenError);
        }
      }
    } catch (error) {
      console.error('Google認証エラー:', error);
      
      // より詳細なエラー情報を表示
      if (error instanceof Error) {
        if (error.message.includes('auth/operation-not-allowed')) {
          setError('Google認証が有効になっていません。Firebase設定を確認してください。');
        } else if (error.message.includes('auth/unauthorized-domain')) {
          setError('このドメインからの認証は許可されていません。Firebase設定を確認してください。');
        } else if (error.message.includes('popup-closed-by-user')) {
          setError('ログインがキャンセルされました。');
        } else if (error.message.includes('popup-blocked')) {
          setError('ポップアップがブロックされました。ブラウザの設定を確認してください。');
        } else {
          setError(`ログインに失敗しました: ${error.message}`);
        }
      } else {
        setError('ログインに失敗しました。もう一度お試しください。');
      }
    } finally {
      setLoading(false);
    }
  };

  const logout = async (): Promise<void> => {
    try {
      setLoading(true);
      setError(null);

      // モック認証の場合はlocalStorageをクリア
      if (typeof window !== 'undefined') {
        const mockUser = localStorage.getItem('mockAuthUser');
        if (mockUser) {
          localStorage.removeItem('mockAuthUser');
          setUser(null);
          setLoading(false);
          return;
        }
      }

      // 通常のFirebaseログアウト
      await signOut(auth);
    } catch (error) {
      console.error('ログアウトエラー:', error);
      setError('ログアウトに失敗しました。もう一度お試しください。');
    } finally {
      setLoading(false);
    }
  };

  const clearError = (): void => {
    setError(null);
  };

  return {
    user,
    loading,
    error,
    signInWithGoogle,
    logout,
    clearError,
  };
}; 