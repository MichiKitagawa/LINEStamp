import request from 'supertest';
import express from 'express';
import { getFirestore } from 'firebase-admin/firestore';

// バックエンドのルーターをインポート
import authRouter from '../../backend/src/routes/auth';
import tokensRouter from '../../backend/src/routes/tokens';

// ミドルウェア
import { verifyIdToken } from '../../backend/src/middleware/verifyIdToken';

// Express アプリをセットアップ
const createTestApp = () => {
  const app = express();
  app.use(express.json());
  app.use(express.raw({ type: 'application/octet-stream', limit: '1mb' }));
  
  // ルーターを設定
  app.use('/auth', authRouter);
  app.use('/tokens', tokensRouter);
  
  return app;
};

// 認証ミドルウェアのモック
jest.mock('../../backend/src/middleware/verifyIdToken', () => ({
  verifyIdToken: jest.fn(),
}));

// Stripe モック
jest.mock('stripe', () => {
  return jest.fn().mockImplementation(() => ({
    checkout: {
      sessions: {
        create: jest.fn().mockResolvedValue({
          id: 'cs_test_session_id',
          url: 'https://checkout.stripe.com/test'
        }),
      },
    },
    webhooks: {
      constructEvent: jest.fn().mockReturnValue({
        type: 'checkout.session.completed',
        data: {
          object: {
            id: 'cs_test_session_id',
            payment_status: 'paid',
            metadata: {
              userId: 'test-uid',
              tokenPackage: '40tokens'
            }
          }
        }
      }),
    },
  }));
});

const mockVerifyIdToken = verifyIdToken as jest.MockedFunction<typeof verifyIdToken>;

describe('2.1 認証→トークン購入→残高確認フロー', () => {
  let app: express.Application;
  let db: FirebaseFirestore.Firestore;
  const testUid = 'test-integration-user-id';

  beforeAll(() => {
    app = createTestApp();
    db = getFirestore();
  });

  beforeEach(() => {
    // 認証ミドルウェアのモック設定
    mockVerifyIdToken.mockImplementation(async (req: any, _res: any, next: any) => {
      req.uid = testUid;
      next();
    });
  });

  it('2.1-01〜2.1-06: 完全なフローの実行', async () => {
    // 2.1-01: Firestore エミュレータは既に起動済み（setup.tsで確認）
    
    // 2.1-02: Firebase Auth モックでテスト用ユーザーを作成
    // (認証ミドルウェアのモックで代替)
    
    // 2.1-03: 有効 JWT で GET /auth/session → ユーザー初期化
    const sessionResponse = await request(app)
      .get('/auth/session')
      .set('Authorization', 'Bearer test-token');

    expect(sessionResponse.status).toBe(200);
    expect(sessionResponse.body.uid).toBe(testUid);
    expect(sessionResponse.body.tokenBalance).toBe(0);

    // Firestoreにユーザーが作成されていることを確認
    const userDoc = await db.collection('users').doc(testUid).get();
    expect(userDoc.exists).toBe(true);
    expect(userDoc.data()?.tokenBalance).toBe(0);

    // 2.1-04: POST /tokens/checkout-session で sessionId を受け取る
    const checkoutResponse = await request(app)
      .post('/tokens/checkout-session')
      .set('Authorization', 'Bearer test-token')
      .send({ tokenPackage: '40tokens' });

    expect(checkoutResponse.status).toBe(200);
    expect(checkoutResponse.body.sessionId).toBe('cs_test_session_id');

    // 2.1-05: 署名検証なしで POST /webhook/stripe イベントを送信
    const webhookResponse = await request(app)
      .post('/webhook/stripe')
      .set('stripe-signature', 'test-signature')
      .send({
        type: 'checkout.session.completed',
        data: {
          object: {
            id: 'cs_test_session_id',
            payment_status: 'paid',
            metadata: {
              userId: testUid,
              tokenPackage: '40tokens'
            }
          }
        }
      });

    expect(webhookResponse.status).toBe(200);

    // tokenBalance が 40 になることを確認
    const updatedUserDoc = await db.collection('users').doc(testUid).get();
    expect(updatedUserDoc.data()?.tokenBalance).toBe(40);

    // token_transactions にレコードが作成されることを確認
    const transactionsQuery = await db
      .collection('token_transactions')
      .where('userId', '==', testUid)
      .get();
    expect(transactionsQuery.docs.length).toBe(1);
    expect(transactionsQuery.docs[0].data().amount).toBe(40);
    expect(transactionsQuery.docs[0].data().type).toBe('purchase');

    // 2.1-06: GET /tokens/balance で balance = 40 が返る
    const balanceResponse = await request(app)
      .get('/tokens/balance')
      .set('Authorization', 'Bearer test-token');

    expect(balanceResponse.status).toBe(200);
    expect(balanceResponse.body.balance).toBe(40);
  });

  it('エラーケース: 無効なtokenPackage', async () => {
    const checkoutResponse = await request(app)
      .post('/tokens/checkout-session')
      .set('Authorization', 'Bearer test-token')
      .send({ tokenPackage: 'invalid-package' });

    expect(checkoutResponse.status).toBe(400);
    expect(checkoutResponse.body.error).toBe('Bad Request');
  });

  it('エラーケース: 認証なしでのアクセス', async () => {
    // 認証ミドルウェアを無効なレスポンスに変更
    mockVerifyIdToken.mockImplementation(async (_req: any, res: any, _next: any) => {
      res.status(401).json({ error: 'Unauthorized' });
    });

    const balanceResponse = await request(app)
      .get('/tokens/balance');

    expect(balanceResponse.status).toBe(401);
  });
}); 