import request from 'supertest';
import express from 'express';

// モック関数を事前定義
const mockStripeCreate = jest.fn();
const mockVerifyIdToken = jest.fn();

jest.mock('../../utils/firebaseAdmin', () => ({
  auth: {
    verifyIdToken: mockVerifyIdToken,
  },
}));

jest.mock('../../utils/stripeClient', () => ({
  stripe: {
    checkout: {
      sessions: {
        create: mockStripeCreate,
      },
    },
  },
}));

// モック設定後にインポート
import tokensRoutes from '../tokens';

const app = express();
app.use(express.json());
app.use('/tokens', tokensRoutes);

describe('POST /tokens/checkout-session', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // デフォルトで認証成功をモック
    mockVerifyIdToken.mockResolvedValue({ uid: 'test-uid-123' });
  });

  it('1.2.1-01 正常系：tokenPackage="40tokens" を渡す → Stripe モックの checkout.sessions.create が呼ばれ、sessionId を返す', async () => {
    const mockSessionId = 'cs_test_session_id_123';
    mockStripeCreate.mockResolvedValue({
      id: mockSessionId,
    });

    const response = await request(app)
      .post('/tokens/checkout-session')
      .set('Authorization', 'Bearer valid-token')
      .send({ tokenPackage: '40tokens' });

    expect(response.status).toBe(200);
    expect(response.body.sessionId).toBe(mockSessionId);
    expect(mockStripeCreate).toHaveBeenCalledWith({
      payment_method_types: ['card'],
      line_items: [
        {
          price_data: {
            currency: 'jpy',
            product_data: {
              name: '40トークンパック',
              description: '標準的なパック。スタンプ8枚作成可能',
            },
            unit_amount: 1000,
          },
          quantity: 1,
        },
      ],
      mode: 'payment',
      success_url: 'http://localhost:3000/dashboard?payment=success',
      cancel_url: 'http://localhost:3000/purchase?payment=cancel',
      metadata: {
        userId: 'test-uid-123',
        tokenPackage: '40tokens',
      },
    });
  });

  it('1.2.1-02 異常系：不正な tokenPackage → HTTP 400 を返す', async () => {
    const response = await request(app)
      .post('/tokens/checkout-session')
      .set('Authorization', 'Bearer valid-token')
      .send({ tokenPackage: 'invalid-package' });

    expect(response.status).toBe(400);
    expect(response.body).toEqual({
      error: 'Bad Request',
      message: 'Invalid token package',
    });
    expect(mockStripeCreate).not.toHaveBeenCalled();
  });

  it('認証エラー → HTTP 401 を返す', async () => {
    mockVerifyIdToken.mockRejectedValue(new Error('Invalid token'));

    const response = await request(app)
      .post('/tokens/checkout-session')
      .send({ tokenPackage: '40tokens' });

    expect(response.status).toBe(401);
    expect(mockStripeCreate).not.toHaveBeenCalled();
  });

  it('Stripe エラー → HTTP 500 を返す', async () => {
    mockStripeCreate.mockRejectedValue(new Error('Stripe error'));

    const response = await request(app)
      .post('/tokens/checkout-session')
      .set('Authorization', 'Bearer valid-token')
      .send({ tokenPackage: '40tokens' });

    expect(response.status).toBe(500);
    expect(response.body).toEqual({
      error: 'Internal Server Error',
      message: 'Failed to create checkout session',
    });
  });
}); 