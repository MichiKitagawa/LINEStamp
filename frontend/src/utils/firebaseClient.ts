import { initializeApp, getApps, getApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';

// Firebase設定
const firebaseConfig = {
  apiKey: process.env['NEXT_PUBLIC_FIREBASE_API_KEY'] || '',
  authDomain: process.env['NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN'] || '',
  projectId: process.env['NEXT_PUBLIC_FIREBASE_PROJECT_ID'] || '',
  storageBucket: process.env['NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET'] || '',
  messagingSenderId: process.env['NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID'] || '',
  appId: process.env['NEXT_PUBLIC_FIREBASE_APP_ID'] || '',
};

// 開発環境でのデバッグログ
if (process.env.NODE_ENV === 'development') {
  console.log('🔥 Firebase設定:', {
    apiKey: firebaseConfig.apiKey ? '設定済み' : '未設定',
    authDomain: firebaseConfig.authDomain ? '設定済み' : '未設定',
    projectId: firebaseConfig.projectId ? '設定済み' : '未設定',
    storageBucket: firebaseConfig.storageBucket ? '設定済み' : '未設定',
    messagingSenderId: firebaseConfig.messagingSenderId ? '設定済み' : '未設定',
    appId: firebaseConfig.appId ? '設定済み' : '未設定',
  });
  
  // 設定が不完全な場合の警告
  const missingConfigs = Object.entries(firebaseConfig)
    .filter(([key, value]) => !value)
    .map(([key]) => key);
  
  if (missingConfigs.length > 0) {
    console.warn('⚠️ 以下のFirebase環境変数が設定されていません:', missingConfigs);
    console.warn('ℹ️ 認証機能を使用するには、.env.localファイルにFirebase設定を追加してください');
  }
}

// Firebase アプリを初期化（重複初期化を防ぐ）
const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();

// Firebase サービスを初期化
export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app);
export const googleProvider = new GoogleAuthProvider();

// Google認証プロバイダーの設定
googleProvider.setCustomParameters({
  prompt: 'select_account',
});

export default app; 