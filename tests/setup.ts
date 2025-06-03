import { initializeApp, cert, getApps, deleteApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

// Firestore エミュレータの設定
process.env.FIRESTORE_EMULATOR_HOST = 'localhost:8080';
process.env.GCLOUD_PROJECT = 'line-stamp-test';

// テスト用のFirebase Admin初期化
const initTestFirebase = () => {
  // 既存のアプリがあれば削除
  const apps = getApps();
  if (apps.length > 0) {
    return apps[0];
  }

  // テスト用のアプリを初期化
  const app = initializeApp({
    projectId: 'line-stamp-test',
  }, 'test-app');

  return app;
};

// グローバルセットアップ
beforeAll(async () => {
  // Firebase Admin初期化
  initTestFirebase();
  
  // エミュレータとの接続確認
  const db = getFirestore();
  await db.doc('test/connection').set({ connected: true });
  await db.doc('test/connection').delete();
  
  console.log('Integration test environment initialized');
});

// 各テスト後のクリーンアップ
afterEach(async () => {
  const db = getFirestore();
  
  // テストデータをクリーンアップ
  const collections = ['users', 'stamps', 'images', 'presets', 'token_transactions'];
  
  for (const collectionName of collections) {
    const collection = db.collection(collectionName);
    const snapshot = await collection.get();
    
    const batch = db.batch();
    snapshot.docs.forEach(doc => {
      batch.delete(doc.ref);
    });
    
    if (!snapshot.empty) {
      await batch.commit();
    }
  }
});

// 全テスト後のクリーンアップ
afterAll(async () => {
  const apps = getApps();
  await Promise.all(apps.map(app => deleteApp(app)));
  console.log('Integration test environment cleaned up');
});

// タイムアウト延長
jest.setTimeout(30000); 