#!/usr/bin/env node

/**
 * Firestore エミュレータ用初期データ投入スクリプト
 * プリセットデータやテスト用ユーザーデータを設定します
 */

const admin = require('firebase-admin');

// Firestore エミュレータに接続
process.env.FIRESTORE_EMULATOR_HOST = 'localhost:8080';

// Firebase Admin SDK を初期化
admin.initializeApp({
  projectId: 'demo-line-stamp',
});

const db = admin.firestore();

// プリセットデータ
const presets = [
  {
    id: 'preset-cute-animals',
    label: 'かわいい動物',
    description: '動物キャラクターのスタンプテンプレート',
    thumbnailUrl: '/presets/cute-animals/thumbnail.png',
    config: {
      style: 'cute',
      theme: 'animals',
      backgroundColor: '#FFE4E1',
      borderStyle: 'rounded',
      textFont: 'Comic Sans MS',
      textColor: '#333333'
    },
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
    updatedAt: admin.firestore.FieldValue.serverTimestamp()
  },
  {
    id: 'preset-simple-emoji',
    label: 'シンプル絵文字',
    description: 'シンプルで使いやすい絵文字スタイル',
    thumbnailUrl: '/presets/simple-emoji/thumbnail.png',
    config: {
      style: 'simple',
      theme: 'emoji',
      backgroundColor: '#FFFFFF',
      borderStyle: 'none',
      textFont: 'Arial',
      textColor: '#000000'
    },
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
    updatedAt: admin.firestore.FieldValue.serverTimestamp()
  },
  {
    id: 'preset-line-friends',
    label: 'LINEフレンズ風',
    description: 'LINEフレンズのようなキャラクタースタイル',
    thumbnailUrl: '/presets/line-friends/thumbnail.png',
    config: {
      style: 'line-friends',
      theme: 'characters',
      backgroundColor: '#F0F8FF',
      borderStyle: 'soft',
      textFont: 'Helvetica',
      textColor: '#2E8B57'
    },
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
    updatedAt: admin.firestore.FieldValue.serverTimestamp()
  },
  {
    id: 'preset-business',
    label: 'ビジネス用',
    description: 'ビジネスシーンで使えるフォーマルなスタンプ',
    thumbnailUrl: '/presets/business/thumbnail.png',
    config: {
      style: 'formal',
      theme: 'business',
      backgroundColor: '#F5F5F5',
      borderStyle: 'square',
      textFont: 'Times New Roman',
      textColor: '#1C1C1C'
    },
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
    updatedAt: admin.firestore.FieldValue.serverTimestamp()
  }
];

// テスト用ユーザーデータ
const testUsers = [
  {
    id: 'test-user-1',
    displayName: 'テストユーザー1',
    email: 'test1@example.com',
    tokenBalance: 100,
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
    updatedAt: admin.firestore.FieldValue.serverTimestamp()
  },
  {
    id: 'test-user-2',
    displayName: 'テストユーザー2',
    email: 'test2@example.com',
    tokenBalance: 50,
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
    updatedAt: admin.firestore.FieldValue.serverTimestamp()
  }
];

// テスト用スタンプデータ
const testStamps = [
  {
    id: 'test-stamp-1',
    userId: 'test-user-1',
    title: 'テストスタンプ1',
    description: 'テスト用のスタンプです',
    status: 'generated',
    presetId: 'preset-cute-animals',
    presetConfig: presets[0].config,
    retryCount: 0,
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
    updatedAt: admin.firestore.FieldValue.serverTimestamp()
  }
];

async function seedData() {
  try {
    console.log('🌱 初期データの投入を開始します...');

    // プリセットデータの投入
    console.log('📝 プリセットデータを投入中...');
    const batch1 = db.batch();
    presets.forEach(preset => {
      const ref = db.collection('presets').doc(preset.id);
      batch1.set(ref, preset);
    });
    await batch1.commit();
    console.log(`✅ ${presets.length}件のプリセットデータを投入しました`);

    // テストユーザーデータの投入
    console.log('👤 テストユーザーデータを投入中...');
    const batch2 = db.batch();
    testUsers.forEach(user => {
      const ref = db.collection('users').doc(user.id);
      batch2.set(ref, user);
    });
    await batch2.commit();
    console.log(`✅ ${testUsers.length}件のテストユーザーデータを投入しました`);

    // テストスタンプデータの投入
    console.log('🎨 テストスタンプデータを投入中...');
    const batch3 = db.batch();
    testStamps.forEach(stamp => {
      const ref = db.collection('stamps').doc(stamp.id);
      batch3.set(ref, stamp);
    });
    await batch3.commit();
    console.log(`✅ ${testStamps.length}件のテストスタンプデータを投入しました`);

    console.log('🎉 初期データの投入が完了しました！');
    
    console.log('\n📋 投入されたデータ:');
    console.log(`- プリセット: ${presets.length}件`);
    console.log(`- テストユーザー: ${testUsers.length}件`);
    console.log(`- テストスタンプ: ${testStamps.length}件`);
    
    console.log('\n🌐 Firestore エミュレータUI: http://localhost:4000');
    console.log('上記URLでデータの確認ができます。');

  } catch (error) {
    console.error('❌ データ投入中にエラーが発生しました:', error);
    process.exit(1);
  }
}

// スクリプト実行
if (require.main === module) {
  seedData()
    .then(() => {
      console.log('\n✨ スクリプトが正常に完了しました');
      process.exit(0);
    })
    .catch(error => {
      console.error('❌ スクリプト実行中にエラーが発生しました:', error);
      process.exit(1);
    });
}

module.exports = { seedData }; 