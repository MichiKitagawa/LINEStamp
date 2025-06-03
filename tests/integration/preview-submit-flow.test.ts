import request from 'supertest';
import express from 'express';
import { getFirestore } from 'firebase-admin/firestore';

// バックエンドのルーターをインポート
import stampsRouter from '../../backend/src/routes/stamps';

// ミドルウェア
import { verifyIdToken } from '../../backend/src/middleware/verifyIdToken';

// Express アプリをセットアップ
const createTestApp = () => {
  const app = express();
  app.use(express.json());
  
  // ルーターを設定
  app.use('/stamps', stampsRouter);
  
  return app;
};

// 認証ミドルウェアのモック
jest.mock('../../backend/src/middleware/verifyIdToken', () => ({
  verifyIdToken: jest.fn(),
}));

// Puppeteer 申請サービスのモック
jest.mock('../../backend/src/services/puppeteerMock', () => ({
  puppeteerSubmissionService: {
    submitStamp: jest.fn().mockImplementation(async (stampId: string) => {
      // 非同期処理をモック
      return new Promise((resolve) => {
        setTimeout(() => {
          resolve({ success: true, status: 'submitted' });
        }, 50);
      });
    }),
  },
}));

const mockVerifyIdToken = verifyIdToken as jest.MockedFunction<typeof verifyIdToken>;

describe('2.3 プレビュー取得→申請→再申請フロー', () => {
  let app: express.Application;
  let db: FirebaseFirestore.Firestore;
  const testUid = 'test-integration-user-id';
  const testStampId = 'test-stamp-id-integration';

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

  it('2.3-01〜2.3-04: 完全なフローの実行', async () => {
    // 2.3-01: stamps/{stampId} と images/type="processed" が8件存在する状態を作成
    
    // stamps ドキュメント作成
    await db.collection('stamps').doc(testStampId).set({
      stampId: testStampId,
      userId: testUid,
      status: 'generated',
      retryCount: 0,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    // processed images を8件作成
    const batch = db.batch();
    for (let i = 0; i < 8; i++) {
      const imageRef = db.collection('images').doc();
      batch.set(imageRef, {
        stampId: testStampId,
        type: 'processed',
        url: `https://storage.googleapis.com/test-bucket/processed-${i}.png`,
        sequence: i,
        createdAt: new Date(),
      });
    }
    await batch.commit();

    // 2.3-02: GET /stamps/{stampId}/preview → 8 件の画像 URL を返す
    const previewResponse = await request(app)
      .get(`/stamps/${testStampId}/preview`)
      .set('Authorization', 'Bearer test-token');

    expect(previewResponse.status).toBe(200);
    expect(previewResponse.body.images).toHaveLength(8);
    expect(previewResponse.body.images[0].url).toContain('processed-0.png');
    expect(previewResponse.body.images[7].url).toContain('processed-7.png');

    // 2.3-03: POST /stamps/submit
    const submitResponse = await request(app)
      .post('/stamps/submit')
      .set('Authorization', 'Bearer test-token')
      .send({ stampId: testStampId });

    expect(submitResponse.status).toBe(200);
    expect(submitResponse.body.stampId).toBe(testStampId);
    expect(submitResponse.body.status).toBe('submitting');

    // stamps/{stampId}.status が "submitting" になることを確認
    let stampDoc = await db.collection('stamps').doc(testStampId).get();
    expect(stampDoc.data()?.status).toBe('submitting');

    // Puppeteer モック完了後に status="submitted" に更新されることを確認
    // 非同期処理の完了を待機
    await new Promise(resolve => setTimeout(resolve, 100));

    stampDoc = await db.collection('stamps').doc(testStampId).get();
    expect(stampDoc.data()?.status).toBe('submitted');

    // 2.3-04: 故意に stamps/{stampId}.status="failed" に更新し、POST /stamps/retry
    await db.collection('stamps').doc(testStampId).update({
      status: 'failed',
      retryCount: 0,
    });

    const retryResponse = await request(app)
      .post('/stamps/retry')
      .set('Authorization', 'Bearer test-token')
      .send({ stampId: testStampId });

    expect(retryResponse.status).toBe(200);
    expect(retryResponse.body.stampId).toBe(testStampId);
    expect(retryResponse.body.status).toBe('submitting');
    expect(retryResponse.body.retryCount).toBe(1);

    // retryCount = 1、status="submitting" → Puppeteer モックで再度 status="submitted" になる
    stampDoc = await db.collection('stamps').doc(testStampId).get();
    expect(stampDoc.data()?.status).toBe('submitting');
    expect(stampDoc.data()?.retryCount).toBe(1);

    // 再試行処理の完了を待機
    await new Promise(resolve => setTimeout(resolve, 100));

    stampDoc = await db.collection('stamps').doc(testStampId).get();
    expect(stampDoc.data()?.status).toBe('submitted');
  });

  it('エラーケース: プレビュー - 画像が存在しない', async () => {
    // stamps ドキュメントのみ作成（processed images なし）
    await db.collection('stamps').doc(testStampId).set({
      stampId: testStampId,
      userId: testUid,
      status: 'generated',
      retryCount: 0,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const previewResponse = await request(app)
      .get(`/stamps/${testStampId}/preview`)
      .set('Authorization', 'Bearer test-token');

    expect(previewResponse.status).toBe(200);
    expect(previewResponse.body.images).toHaveLength(0);
  });

  it('エラーケース: 申請 - 無効なステータス', async () => {
    // status="pending_upload" のスタンプを作成
    await db.collection('stamps').doc(testStampId).set({
      stampId: testStampId,
      userId: testUid,
      status: 'pending_upload',
      retryCount: 0,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const submitResponse = await request(app)
      .post('/stamps/submit')
      .set('Authorization', 'Bearer test-token')
      .send({ stampId: testStampId });

    expect(submitResponse.status).toBe(400);
    expect(submitResponse.body.error).toBe('Bad Request');
    expect(submitResponse.body.message).toBe('Stamp is not ready for submission');
  });

  it('エラーケース: 再申請 - 無効なステータス', async () => {
    // status="generated" のスタンプを作成
    await db.collection('stamps').doc(testStampId).set({
      stampId: testStampId,
      userId: testUid,
      status: 'generated',
      retryCount: 0,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const retryResponse = await request(app)
      .post('/stamps/retry')
      .set('Authorization', 'Bearer test-token')
      .send({ stampId: testStampId });

    expect(retryResponse.status).toBe(400);
    expect(retryResponse.body.error).toBe('Bad Request');
    expect(retryResponse.body.message).toBe('Stamp is not in failed state');
  });

  it('エラーケース: 存在しないスタンプID', async () => {
    const nonExistentStampId = 'non-existent-stamp-id';

    const previewResponse = await request(app)
      .get(`/stamps/${nonExistentStampId}/preview`)
      .set('Authorization', 'Bearer test-token');

    expect(previewResponse.status).toBe(404);

    const submitResponse = await request(app)
      .post('/stamps/submit')
      .set('Authorization', 'Bearer test-token')
      .send({ stampId: nonExistentStampId });

    expect(submitResponse.status).toBe(404);

    const retryResponse = await request(app)
      .post('/stamps/retry')
      .set('Authorization', 'Bearer test-token')
      .send({ stampId: nonExistentStampId });

    expect(retryResponse.status).toBe(404);
  });

  it('エラーケース: 権限なし - 他ユーザーのスタンプ', async () => {
    const otherUserId = 'other-user-id';
    
    // 他ユーザーのスタンプを作成
    await db.collection('stamps').doc(testStampId).set({
      stampId: testStampId,
      userId: otherUserId,
      status: 'generated',
      retryCount: 0,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const previewResponse = await request(app)
      .get(`/stamps/${testStampId}/preview`)
      .set('Authorization', 'Bearer test-token');

    expect(previewResponse.status).toBe(403);

    const submitResponse = await request(app)
      .post('/stamps/submit')
      .set('Authorization', 'Bearer test-token')
      .send({ stampId: testStampId });

    expect(submitResponse.status).toBe(403);

    const retryResponse = await request(app)
      .post('/stamps/retry')
      .set('Authorization', 'Bearer test-token')
      .send({ stampId: testStampId });

    expect(retryResponse.status).toBe(403);
  });
}); 