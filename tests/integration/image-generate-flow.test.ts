import request from 'supertest';
import express from 'express';
import { getFirestore } from 'firebase-admin/firestore';
import path from 'path';
import fs from 'fs';

// バックエンドのルーターをインポート
import imagesRouter from '../../backend/src/routes/images';
import stampsRouter from '../../backend/src/routes/stamps';
import tokensRouter from '../../backend/src/routes/tokens';

// ミドルウェア
import { verifyIdToken } from '../../backend/src/middleware/verifyIdToken';

// Express アプリをセットアップ
const createTestApp = () => {
  const app = express();
  app.use(express.json());
  
  // ルーターを設定
  app.use('/images', imagesRouter);
  app.use('/stamps', stampsRouter);
  app.use('/tokens', tokensRouter);
  
  return app;
};

// 認証ミドルウェアのモック
jest.mock('../../backend/src/middleware/verifyIdToken', () => ({
  verifyIdToken: jest.fn(),
}));

// Firebase Storage モック
jest.mock('firebase-admin/storage', () => ({
  getStorage: jest.fn(() => ({
    bucket: jest.fn(() => ({
      file: jest.fn(() => ({
        save: jest.fn().mockResolvedValue(undefined),
        getSignedUrl: jest.fn().mockResolvedValue(['https://storage.googleapis.com/test-bucket/test-file.png']),
        makePublic: jest.fn().mockResolvedValue(undefined),
        publicUrl: jest.fn().mockReturnValue('https://storage.googleapis.com/test-bucket/test-file.png'),
      })),
    })),
  })),
}));

// 画像生成サービスのモック
jest.mock('../../backend/src/services/imageGeneratorMock', () => ({
  imageGeneratorService: {
    generateStampImages: jest.fn().mockImplementation(async (stampId: string) => {
      // モック画像URL生成
      const processedImages = [];
      for (let i = 0; i < 8; i++) {
        processedImages.push({
          stampId,
          type: 'processed',
          url: `https://storage.googleapis.com/test-bucket/processed-${i}.png`,
          sequence: i,
          createdAt: new Date(),
        });
      }
      return processedImages;
    }),
  },
}));

const mockVerifyIdToken = verifyIdToken as jest.MockedFunction<typeof verifyIdToken>;

describe('2.2 画像アップロード→スタンプ生成→ステータス取得フロー', () => {
  let app: express.Application;
  let db: FirebaseFirestore.Firestore;
  const testUid = 'test-integration-user-id';

  beforeAll(() => {
    app = createTestApp();
    db = getFirestore();
  });

  beforeEach(async () => {
    // 認証ミドルウェアのモック設定
    mockVerifyIdToken.mockImplementation(async (req: any, _res: any, next: any) => {
      req.uid = testUid;
      next();
    });

    // テスト用ユーザーを事前作成
    await db.collection('users').doc(testUid).set({
      uid: testUid,
      displayName: 'Test User',
      email: 'test@example.com',
      tokenBalance: 100,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
  });

  it('2.2-01〜2.2-04: 完全なフローの実行', async () => {
    // 2.2-01: Firestore エミュレータは既に起動済み（setup.tsで確認）
    
    // 2.2-02: valid な画像ファイルを3枚用意し、POST /images/upload を呼び出す
    
    // テスト用の画像ファイルを作成（ダミーバイナリデータ）
    const createTestImageBuffer = (size: number = 1024) => {
      return Buffer.alloc(size, 'test-image-data');
    };

    const uploadResponse = await request(app)
      .post('/images/upload')
      .set('Authorization', 'Bearer test-token')
      .attach('images', createTestImageBuffer(1024), 'test1.png')
      .attach('images', createTestImageBuffer(2048), 'test2.png')
      .attach('images', createTestImageBuffer(1536), 'test3.png');

    expect(uploadResponse.status).toBe(200);
    expect(uploadResponse.body.uploadedCount).toBe(3);
    expect(uploadResponse.body.stampId).toBeDefined();

    const stampId = uploadResponse.body.stampId;

    // Firestore: images/type="original" が 3 件作成される
    const originalImagesQuery = await db
      .collection('images')
      .where('stampId', '==', stampId)
      .where('type', '==', 'original')
      .get();
    expect(originalImagesQuery.docs.length).toBe(3);

    // stamps/{stampId}.status が "generating" に更新される
    const stampDoc = await db.collection('stamps').doc(stampId).get();
    expect(stampDoc.exists).toBe(true);
    expect(stampDoc.data()?.status).toBe('generating');
    expect(stampDoc.data()?.userId).toBe(testUid);

    // 2.2-03: POST /stamps/generate を呼び出し、モックジェネレーターで即座に status="generated" に更新される
    const generateResponse = await request(app)
      .post('/stamps/generate')
      .set('Authorization', 'Bearer test-token')
      .send({ stampId });

    expect(generateResponse.status).toBe(200);
    expect(generateResponse.body.stampId).toBe(stampId);
    expect(generateResponse.body.status).toBe('generating');

    // 生成処理の完了を待つ（非同期処理のため少し待機）
    await new Promise(resolve => setTimeout(resolve, 100));

    // Firestore: images/type="processed" が 8 件作成される
    const processedImagesQuery = await db
      .collection('images')
      .where('stampId', '==', stampId)
      .where('type', '==', 'processed')
      .get();
    expect(processedImagesQuery.docs.length).toBe(8);

    // 2.2-04: GET /stamps/{stampId}/status → status="generated" を返すことを確認
    const statusResponse = await request(app)
      .get(`/stamps/${stampId}/status`)
      .set('Authorization', 'Bearer test-token');

    expect(statusResponse.status).toBe(200);
    expect(statusResponse.body.stampId).toBe(stampId);
    expect(statusResponse.body.status).toBe('generated');
  });

  it('エラーケース: 無効なファイル形式', async () => {
    const uploadResponse = await request(app)
      .post('/images/upload')
      .set('Authorization', 'Bearer test-token')
      .attach('images', Buffer.from('test'), 'test.txt'); // 無効な形式

    expect(uploadResponse.status).toBe(400);
    expect(uploadResponse.body.error).toBe('Bad Request');
  });

  it('エラーケース: ファイルサイズ超過', async () => {
    // 5MB + 1 バイトのファイル
    const largeFile = Buffer.alloc(5 * 1024 * 1024 + 1, 'x');
    
    const uploadResponse = await request(app)
      .post('/images/upload')
      .set('Authorization', 'Bearer test-token')
      .attach('images', largeFile, 'large.png');

    expect(uploadResponse.status).toBe(400);
  });

  it('エラーケース: 無効なstampIdでの生成', async () => {
    const generateResponse = await request(app)
      .post('/stamps/generate')
      .set('Authorization', 'Bearer test-token')
      .send({ stampId: 'non-existent-stamp-id' });

    expect(generateResponse.status).toBe(404);
  });

  it('エラーケース: トークン不足', async () => {
    // トークン残高を0に設定
    await db.collection('users').doc(testUid).update({
      tokenBalance: 0,
    });

    // トークン消費テスト
    const consumeResponse = await request(app)
      .post('/tokens/consume')
      .set('Authorization', 'Bearer test-token')
      .send({ stampId: 'test-stamp-id', amount: 40 });

    expect(consumeResponse.status).toBe(400);
    expect(consumeResponse.body.error).toBe('Bad Request');
    expect(consumeResponse.body.message).toBe('Insufficient token balance');
  });
}); 