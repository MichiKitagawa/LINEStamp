import admin from 'firebase-admin';
import { getFirestore } from 'firebase-admin/firestore';
import { getAuth } from 'firebase-admin/auth';
import { getStorage } from 'firebase-admin/storage';
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';

// 環境変数を確実に読み込む（基本設定用）
dotenv.config();

// デバッグ用：環境変数の読み込み状況を確認
console.log('🔧 環境変数読み込み状況:');
console.log('  NODE_ENV:', process.env['NODE_ENV']);

// システム時刻の確認
console.log('🕐 システム時刻確認:');
const currentTime = new Date();
console.log('  現在時刻 (UTC):', currentTime.toISOString());
console.log('  現在時刻 (Local):', currentTime.toLocaleString());
console.log('  Unix timestamp:', Math.floor(currentTime.getTime() / 1000));

// テスト環境用のモックオブジェクト
const createMockFirestore = () => ({
  collection: () => ({}),
  batch: () => ({}),
  runTransaction: () => Promise.resolve(),
  doc: () => ({}),
});

const createMockAuth = () => ({
  verifyIdToken: () => Promise.resolve({}),
  getUser: () => Promise.resolve({}),
});

const createMockStorage = () => ({
  bucket: () => ({}),
});

// サービスアカウントJSONファイルの検索と読み込み
const findServiceAccountFile = (): string | null => {
  // プロジェクトルートディレクトリのパス
  const projectRoot = path.resolve(__dirname, '../../../');
  
  console.log('🔍 サービスアカウントファイル検索:');
  console.log('  検索パス:', projectRoot);
  
  try {
    // ディレクトリ内のファイル一覧を取得
    const files = fs.readdirSync(projectRoot);
    
    // Firebase サービスアカウントJSONファイルを検索
    const serviceAccountFile = files.find(file => 
      file.includes('firebase-adminsdk') && 
      file.endsWith('.json') &&
      file.includes('line-stamp-gen-dev')
    );
    
    if (serviceAccountFile) {
      const fullPath = path.join(projectRoot, serviceAccountFile);
      console.log('  ✅ サービスアカウントファイル発見:', serviceAccountFile);
      console.log('  📂 フルパス:', fullPath);
      return fullPath;
    } else {
      console.log('  ❌ サービスアカウントファイルが見つかりません');
      console.log('  📋 利用可能なファイル:', files.filter(f => f.endsWith('.json')));
      return null;
    }
  } catch (error) {
    console.error('  ❌ ファイル検索エラー:', error);
    return null;
  }
};

// サービスアカウント情報の読み込みと検証
const loadServiceAccount = (filePath: string): any => {
  try {
    console.log('📖 サービスアカウントファイル読み込み中...');
    const serviceAccountJson = fs.readFileSync(filePath, 'utf8');
    const serviceAccount = JSON.parse(serviceAccountJson);
    
    console.log('🔍 サービスアカウント情報検証:');
    console.log('  Project ID:', serviceAccount.project_id);
    console.log('  Client Email:', serviceAccount.client_email);
    console.log('  Private Key ID:', serviceAccount.private_key_id);
    console.log('  Private Key Length:', serviceAccount.private_key ? serviceAccount.private_key.length : 0);
    
    // 必須フィールドの確認
    const requiredFields = ['project_id', 'private_key', 'client_email'];
    const missingFields = requiredFields.filter(field => !serviceAccount[field]);
    
    if (missingFields.length > 0) {
      throw new Error(`必須フィールドが不足: ${missingFields.join(', ')}`);
    }
    
    // 特殊文字の確認
    const privateKey = serviceAccount.private_key;
    const specialChars = ['%', '/', '+'];
    const foundSpecialChars = specialChars.filter(char => privateKey.includes(char));
    
    if (foundSpecialChars.length > 0) {
      console.log('  ⚠️ Private keyに特殊文字発見:', foundSpecialChars.join(', '));
      console.log('  💡 JSONファイルから直接読み込むため、特殊文字は問題ありません');
    } else {
      console.log('  ✅ Private keyに特殊文字なし');
    }
    
    console.log('  ✅ サービスアカウント情報の読み込み成功');
    return serviceAccount;
    
  } catch (error) {
    console.error('❌ サービスアカウントファイル読み込みエラー:', error);
    throw error;
  }
};

// Firebase Admin SDKの初期化処理
const initializeFirebaseAdmin = () => {
  // すでに初期化済みの場合はスキップ
  if (admin.apps.length > 0) {
    console.log('✅ Firebase Admin SDK already initialized');
    return true;
  }

  console.log('🔧 Firebase Admin SDK 初期化開始...');
  
  // サービスアカウントファイルを検索
  const serviceAccountPath = findServiceAccountFile();
  if (!serviceAccountPath) {
    console.error('❌ サービスアカウントファイルが見つかりません');
    console.error('💡 以下のファイルをプロジェクトルートに配置してください:');
    console.error('   - line-stamp-gen-dev-firebase-adminsdk-*.json');
    return false;
  }
  
  try {
    // サービスアカウント情報を読み込み
    const serviceAccount = loadServiceAccount(serviceAccountPath);
    
    console.log('📋 Firebase初期化パラメータ:');
    console.log('  Project ID:', serviceAccount.project_id);
    console.log('  Client Email:', serviceAccount.client_email);
    console.log('  Storage Bucket:', serviceAccount.project_id + '.firebasestorage.app');

    const initOptions: admin.AppOptions = {
      credential: admin.credential.cert(serviceAccount),
      projectId: serviceAccount.project_id,
      storageBucket: serviceAccount.project_id + '.firebasestorage.app'
    };

    // Firebase Admin SDK初期化
    admin.initializeApp(initOptions);
    
    console.log('✅ Firebase Admin SDK initialized successfully');
    console.log('  Apps count:', admin.apps.length);
    
    // 初期化成功後の追加検証
    console.log('🔐 Firebase Admin SDK 設定検証:');
    const app = admin.app();
    console.log('  App name:', app.name);
    console.log('  Options project ID:', app.options.projectId);
    
    return true;
  } catch (error) {
    console.error('❌ Firebase Admin SDK initialization failed:', error);
    
    if (error instanceof Error) {
      console.error('  Error name:', error.name);
      console.error('  Error message:', error.message);
      console.error('  Error stack:', error.stack);
      
      // よくあるエラーパターンの説明
      if (error.message.includes('private_key')) {
        console.error('💡 Private Key の形式に問題がある可能性があります');
        console.error('   - JSONファイルが正しく生成されているか確認してください');
        console.error('   - Firebase Consoleから再ダウンロードを試してください');
      }
      
      if (error.message.includes('project_id')) {
        console.error('💡 Project ID が正しくない可能性があります');
        console.error('   - Firebase Console で正しいProject IDを確認してください');
      }

      if (error.message.includes('client_email')) {
        console.error('💡 Client Email が正しくない可能性があります');
        console.error('   - サービスアカウントのメールアドレスを確認してください');
      }
    }
    
    return false;
  }
};

// 実際の初期化実行
const isInitialized = initializeFirebaseAdmin();

// Firebase サービスの取得
let firestore: any;
let auth: any;
let storage: any;

if (process.env['NODE_ENV'] === 'test') {
  console.log('🧪 テスト環境：モックサービスを使用');
  firestore = createMockFirestore();
  auth = createMockAuth();
  storage = createMockStorage();
} else if (isInitialized) {
  console.log('🔥 本番/開発環境：実Firebaseサービスを使用');
  firestore = getFirestore();
  auth = getAuth();
  storage = getStorage();
  
  console.log('🔥 Firebase サービス状況:');
  console.log('  Firestore:', firestore ? '✓ 利用可能' : '✗ 無効');
  console.log('  Auth:', auth ? '✓ 利用可能' : '✗ 無効');
  console.log('  Storage:', storage ? '✓ 利用可能' : '✗ 無効');
} else {
  console.warn('⚠️  Firebase初期化に失敗：サービスは無効化されます');
  firestore = null;
  auth = null;
  storage = null;
}

export { firestore, auth, storage, admin };
export default admin; 